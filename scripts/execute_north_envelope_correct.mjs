import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-envelope-correct-' + Date.now();
  await client.connect();

  const viewId = 8157; // 北向立面

  // 1. 清除舊線條
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除視圖內舊詳圖線 (${oldLines.data?.Elements?.length || 0} 條)`);

  // 2. 實體外輪廓精確座標 (3D Model World Coordinates mm):
  // 左外牆面 (Grid D 實體外皮): X = 776.8 mm
  // 右外牆面 (Grid A 實體外皮): X = 16026.8 mm
  // 底面 (GL 地盤線): Z = 0.0 mm
  // 最高頂面 (TRFL / 女兒牆頂): Z = 19550.0 mm (或 18550.0 mm)
  const leftX = 776.8;
  const rightX = 16026.8;
  const bottomZ = 0.0;
  const topZ = 19550.0;

  // 5 個間距 (3,250 mm)
  const step5 = 3250.0;
  const blueLeftX = leftX - step5;     // -2,473.2 mm (對齊樓層標示圈)
  const blueRightX = rightX + step5;   // 19,276.8 mm
  const blueBottomZ = bottomZ - step5; // -3,250.0 mm
  const blueTopZ = topZ + step5;       // 22,800.0 mm (對齊軸線氣泡圈)

  console.log(`📌 實體外輪廓 (Step 0 紅線):`);
  console.log(`   左側實體外皮: X = ${leftX} mm`);
  console.log(`   右側實體外皮: X = ${rightX} mm`);
  console.log(`   底層 GL: Z = ${bottomZ} mm`);
  console.log(`   最高頂層: Z = ${topZ} mm`);

  console.log(`📌 5 個間距 (Step 5 藍線):`);
  console.log(`   左側齊頭藍線: X = ${blueLeftX} mm`);
  console.log(`   頂部齊頭藍線: Z = ${blueTopZ} mm`);

  const linesToDraw = [
    // 🔴 紅線 (Step 0: 實體外輪廓包絡線)
    { startX: leftX - 1000, startY: bottomZ, endX: rightX + 1000, endY: bottomZ, color: { r: 255, g: 0, b: 0 }, label: '紅線-GL底面' },
    { startX: leftX - 1000, startY: topZ, endX: rightX + 1000, endY: topZ, color: { r: 255, g: 0, b: 0 }, label: '紅線-最高頂面' },
    { startX: leftX, startY: bottomZ - 1000, endX: leftX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-左側實體外皮' },
    { startX: rightX, startY: bottomZ - 1000, endX: rightX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '紅線-右側實體外皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: blueLeftX - 1500, startY: blueTopZ, endX: blueRightX + 1500, endY: blueTopZ, color: { r: 0, g: 100, b: 255 }, label: '藍線-頂部氣泡齊頭線' },
    { startX: blueLeftX, startY: blueBottomZ - 1500, endX: blueLeftX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-左側樓層齊頭線' },
    { startX: blueLeftX - 1500, startY: blueBottomZ, endX: blueRightX + 1500, endY: blueBottomZ, color: { r: 0, g: 100, b: 255 }, label: '藍線-底部邊界' },
    { startX: blueRightX, startY: blueBottomZ - 1500, endX: blueRightX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });

  console.log(`✓ 4 條紅線 (Step 0) 與 4 條藍線 (Step 5) 繪製結果:`, lineRes.data);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
