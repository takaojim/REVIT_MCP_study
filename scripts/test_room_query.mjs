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
  console.log('Total rooms:', roomsRes.data?.Elements?.length);
  const sampleRooms = roomsRes.data.Elements.slice(0, 10);
  console.log('Sample rooms raw:', sampleRooms);

  // Check get_room_info
  const rInfo = await client.sendCommand('get_room_info', { roomId: sampleRooms[0].ElementId });
  console.log('Sample room info:', rInfo.data);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
