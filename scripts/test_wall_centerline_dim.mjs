import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-wall-centerline-dim';
  await client.connect();

  const viewId = 695; // 2FL

  // 查詢兩道外牆
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 10 });
  const walls = wallsRes.data?.Elements || [];

  console.log(`測試以 create_dimension 傳入 2 道牆體 ID 建立標註...`);
  if (walls.length >= 2) {
    const w1 = walls[0].ElementId;
    const w2 = walls[1].ElementId;

    console.log(`嘗試標註牆體 ID: ${w1} 和 ${w2}`);
    const res = await client.sendCommand('create_dimension', {
      viewId: viewId,
      elementIds: [w1, w2],
      startX: 0,
      startY: 35000,
      endX: 50000,
      endY: 35000,
      dimensionTypeId: 2251126 // TABC-DIM_dot 牆心
    });
    console.log('建立結果:', res);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
