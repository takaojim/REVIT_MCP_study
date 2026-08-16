import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL

  // 1. Query Stairs
  console.log('=== 1. 查詢 3FL 相關樓梯 ===');
  const stairsRes = await client.sendCommand('query_elements', { category: 'Stairs' });
  console.log('Stairs Count:', stairsRes.data?.Count);
  console.log('Stairs elements:', JSON.stringify(stairsRes.data?.Elements, null, 2));

  // 2. Query Stair Rooms
  console.log('\n=== 2. 查詢 3FL 安全梯/樓梯房間 ===');
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  const stairRooms = roomsRes.data.Rooms.filter(r => r.Name && (r.Name.includes('梯') || r.Name.includes('Stair')));

  for (const sr of stairRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: sr.ElementId });
    console.log(`樓梯房間 [${sr.Number}] ${sr.Name} (ID: ${sr.ElementId}):`, JSON.stringify(info.data, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
