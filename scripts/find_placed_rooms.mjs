import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('query_elements', {
    category: 'Rooms',
    maxCount: 2000,
    returnFields: ['編號', '名稱', '樓層', '周長', '面積']
  });
  
  const allRooms = roomsRes.data?.Elements || [];
  console.log('Total room elements:', allRooms.length);

  // Check some rooms that have valid area or inspect which ones are placed
  let placedCount = 0;
  const placedRooms = [];

  for (let i = 0; i < allRooms.length; i++) {
    const r = allRooms[i];
    const rInfo = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    if (rInfo.data && rInfo.data.Area > 0 && rInfo.data.BoundingBox) {
      placedCount++;
      placedRooms.push(rInfo.data);
    }
  }

  console.log(`Placed rooms with Area > 0: ${placedCount} / ${allRooms.length}`);
  console.log('Sample placed rooms:', placedRooms.slice(0, 5));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
