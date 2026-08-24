import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'analyze-walls-2fl';
  await client.connect();

  const viewId = 695; // 2FL

  console.log('=== 分析 2FL 視圖中所有牆體之幾何座標與空間分佈 ===\n');

  // 1. 查詢 2FL 上所有牆體
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];
  console.log(`2FL 共有 ${allWalls.length} 道牆體。`);

  const wallInfos = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_element_info', { elementId: w.ElementId });
    const lengthParam = info.data?.Parameters?.find(p => p.Name === '長度' || p.Name === 'Length')?.Value;
    const kind = info.data?.Type;
    wallInfos.push({
      id: w.ElementId,
      name: w.Name,
      type: kind,
      length: lengthParam
    });
  }

  // 查詢 2FL 上的房間資訊以掌握走廊與空間佈局
  const roomsRes = await client.sendCommand('get_rooms_by_level', { levelName: '2FL' });
  console.log(`\n2FL 共有 ${roomsRes.data?.Rooms?.length || 0} 個房間:`);
  for (const r of roomsRes.data?.Rooms || []) {
    console.log(`  - 房間 [${r.Number}] "${r.Name}" (ID: ${r.ElementId || r.RoomId})`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
