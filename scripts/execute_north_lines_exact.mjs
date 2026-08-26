import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-lines-exact-' + Date.now();
  await client.connect();

  const viewId = 8157; // 北向立面

  // 1. 清除該視圖舊有詳圖線
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }

  // 2. 精確投影座標計算 (View Origin X = 7324.9 mm, vRight = -X)
  // 實體外皮:
  // 左外皮 (D 軸外側): X_world = 776.8 mm -> u = 7324.9 - 776.8 = 6548.1 mm
  // 右外皮 (A 軸外側): X_world = 16026.8 mm -> u = 7324.9 - 16026.8 = -8701.9 mm
  // 底層 GL: Z_world = 0.0 mm -> v = 0.0 mm
  // 頂層 TRFL: Z_world = 18550.0 mm -> v = 18550.0 mm

  const uLeftRed = 6548.1;
  const uRightRed = -8701.9;
  const vBottomRed = 0.0;
  const vTopRed = 18550.0;

  // 5 間距 (3,250 mm)
  const step5 = 3250.0;
  const uLeftBlue = uLeftRed + step5;     // 9,798.1 mm (左側齊頭藍線)
  const uRightBlue = uRightRed - step5;   // -11,951.9 mm (右側藍線)
  const vBottomBlue = vBottomRed - step5; // -3,250.0 mm (底部藍線)
  const vTopBlue = vTopRed + step5;       // 21,800.0 mm (頂部齊頭藍線)

  const linesToDraw = [
    // 🔴 紅線 (Step 0: 精確實體外輪廓包絡框)
    { startX: uLeftRed + 1000, startY: vBottomRed, endX: uRightRed - 1000, endY: vBottomRed, color: { r: 255, g: 0, b: 0 }, label: '紅線-GL底面' },
    { startX: uLeftRed + 1000, startY: vTopRed, endX: uRightRed - 1000, endY: vTopRed, color: { r: 255, g: 0, b: 0 }, label: '紅線-TRFL頂面' },
    { startX: uLeftRed, startY: vBottomRed - 1000, endX: uLeftRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-左側實體外皮' },
    { startX: uRightRed, startY: vBottomRed - 1000, endX: uRightRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-右側實體外皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭基準線)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-頂部氣泡齊頭線' },
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-左側樓層齊頭線' },
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-底部邊界' },
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });

  console.log(`✓ 4 條紅線 (Step 0) 與 4 條藍線 (Step 5) 精確繪製完成:`, lineRes.data);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
