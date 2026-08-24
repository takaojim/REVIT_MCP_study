import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'draw-2fl-envelope-lines';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備在 2FL 繪製實體外框與 9 間距齊頭線 ===\n');

  // 1. 取得作用中視圖
  const viewRes = await client.sendCommand('get_active_view', {});
  const activeView = viewRes.data;
  const viewId = activeView.ElementId;
  console.log(`📌 視圖: "${activeView.Name}" (ID: ${viewId})`);

  // 2. 實體外框極值座標 (mm)
  const env = {
    minX: -5591.7,
    maxX: 47733.3,
    minY: -20236.3,
    maxY: 32513.7
  };

  // 3. 9 個間距齊頭線座標 (mm) (各向向外延伸 5,850 mm)
  const target9U = {
    leftX: env.minX - 5850.0,   // -11441.7 mm
    rightX: env.maxX + 5850.0,  // 53583.3 mm
    bottomY: env.minY - 5850.0, // -26086.3 mm
    topY: env.maxY + 5850.0     // 38363.7 mm
  };

  console.log(`📐 【紅色框】建物實體外框極值 (Physical Envelope):`);
  console.log(`   - 西側(Min X): ${env.minX.toFixed(1)} mm`);
  console.log(`   - 東側(Max X): ${env.maxX.toFixed(1)} mm`);
  console.log(`   - 南側(Min Y): ${env.minY.toFixed(1)} mm`);
  console.log(`   - 北側(Max Y): ${env.maxY.toFixed(1)} mm`);

  console.log(`\n📐 【藍色框】9 個間距氣泡齊頭線 (9-step Datum: 外擴 5,850 mm):`);
  console.log(`   - 西側(Left X):   ${target9U.leftX.toFixed(1)} mm`);
  console.log(`   - 東側(Right X):  ${target9U.rightX.toFixed(1)} mm`);
  console.log(`   - 南側(Bottom Y): ${target9U.bottomY.toFixed(1)} mm`);
  console.log(`   - 北側(Top Y):    ${target9U.topY.toFixed(1)} mm`);

  // 4. 構造 DetailLines 陣列
  const linesToDraw = [
    // --- 紅色實體外框 (4條邊) ---
    // 北邊
    { startX: env.minX, startY: env.maxY, endX: env.maxX, endY: env.maxY, color: { r: 255, g: 0, b: 0 }, label: '實體外框-北' },
    // 東邊
    { startX: env.maxX, startY: env.maxY, endX: env.maxX, endY: env.minY, color: { r: 255, g: 0, b: 0 }, label: '實體外框-東' },
    // 南邊
    { startX: env.maxX, startY: env.minY, endX: env.minX, endY: env.minY, color: { r: 255, g: 0, b: 0 }, label: '實體外框-南' },
    // 西邊
    { startX: env.minX, startY: env.minY, endX: env.minX, endY: env.maxY, color: { r: 255, g: 0, b: 0 }, label: '實體外框-西' },

    // --- 藍色 9 間距齊頭線框 (4條邊) ---
    // 北齊頭線
    { startX: target9U.leftX, startY: target9U.topY, endX: target9U.rightX, endY: target9U.topY, color: { r: 0, g: 100, b: 255 }, label: '9間距齊頭線-北' },
    // 東齊頭線
    { startX: target9U.rightX, startY: target9U.topY, endX: target9U.rightX, endY: target9U.bottomY, color: { r: 0, g: 100, b: 255 }, label: '9間距齊頭線-東' },
    // 南齊頭線
    { startX: target9U.rightX, startY: target9U.bottomY, endX: target9U.leftX, endY: target9U.bottomY, color: { r: 0, g: 100, b: 255 }, label: '9間距齊頭線-南' },
    // 西齊頭線
    { startX: target9U.leftX, startY: target9U.bottomY, endX: target9U.leftX, endY: target9U.topY, color: { r: 0, g: 100, b: 255 }, label: '9間距齊頭線-西' }
  ];

  console.log(`\n✏️ 正在呼叫 create_detail_lines 繪製線條...`);
  const drawRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });

  console.log('回傳結果:', JSON.stringify(drawRes, null, 2));

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
