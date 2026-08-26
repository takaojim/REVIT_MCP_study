import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-envelope-perfect-final-' + Date.now();
  await client.connect();

  const viewId = 8157; // 北向立面

  // 1. 清除舊線條
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除舊詳圖線 (${oldLines.data?.Elements?.length || 0} 條)`);

  // 2. 視圖原點與投影轉換參數:
  // View Origin: X = 7324.9 mm, vRight = -X
  // Target Left Wall: X = 776.8 mm -> u = 7324.9 - 776.8 = 6548.1 mm
  // Target Right Wall: X = 16026.8 mm -> u = 7324.9 - 16026.8 = -8701.9 mm
  // Target GL: Z = 0.0 mm -> v = 0.0 mm
  // Target Top Tower: Z = 19550.0 mm -> v = 19550.0 mm (女兒牆頂)

  const uLeft = 6548.1;
  const uRight = -8701.9;
  const vBottom = 0.0;
  const vTop = 18550.0; // TRFL

  const step5 = 3250.0;
  const uLeftBlue = uLeft + step5;     // 9798.1 mm (貼齊左側樓層標示圈)
  const uRightBlue = uRight - step5;   // -11951.9 mm
  const vBottomBlue = vBottom - step5; // -3250.0 mm
  const vTopBlue = vTop + step5;       // 21800.0 mm (貼齊頂部軸號氣泡圓圈)

  const linesToDraw = [
    // 🔴 紅線 (Step 0: 精確貼合外皮)
    { startX: uLeft + 1000, startY: vBottom, endX: uRight - 1000, endY: vBottom, color: { r: 255, g: 0, b: 0 }, label: '紅線-GL底面' },
    { startX: uLeft + 1000, startY: vTop, endX: uRight - 1000, endY: vTop, color: { r: 255, g: 0, b: 0 }, label: '紅線-最高頂面TRFL' },
    { startX: uLeft, startY: vBottom - 1000, endX: uLeft, endY: vTop + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-左側實體外牆皮' },
    { startX: uRight, startY: vBottom - 1000, endX: uRight, endY: vTop + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-右側實體外牆皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-頂部氣泡齊頭線' },
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-左側樓層齊頭線' },
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-底部邊界' },
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });

  console.log(`✓ 4 條紅線 (Step 0) 與 4 條藍線 (Step 5) 繪製完成:`, lineRes.data);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
