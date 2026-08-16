import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 查詢 2FL 視圖與作用中視圖 ===');
  const active = await client.sendCommand('get_active_view', {});
  console.log('Active View:', active.data);

  // Set active view to 2FL floor plan if not already
  const viewId = 695; // 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  // 測試建立北側連續柱線標註 (同一線段，points 陣列)
  const northPoints = [
    { x: -1691.74, y: 34000 }, // Grid G
    { x: 58.24, y: 34000 },    // Grid F
    { x: 8208.26, y: 34000 },  // Grid E
    { x: 19608.25, y: 34000 }, // Grid D
    { x: 31008.25, y: 34000 }, // Grid C
    { x: 40383.24, y: 34000 }, // Grid B
    { x: 47333.25, y: 34000 }  // Grid A
  ];

  console.log('\n=== 2. 測試建立北側同一線段連續串接標註 ===');
  const res = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: northPoints,
    startX: -1691.74,
    startY: 34000,
    endX: 47333.25,
    endY: 34000,
    offset: 0
  });

  console.log('Result:', JSON.stringify(res, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
