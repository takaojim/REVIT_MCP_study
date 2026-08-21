import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '4FL' });
  const rooms = roomsRes.data.Rooms || [];

  console.log(`4FL 共有 ${rooms.length} 間房間：`);
  const roomTypes = {};
  for (const r of rooms) {
    const isCorridor = r.Name.includes('走廊') || r.Name.includes('梯廳') || r.Name.includes('休閒區') || r.Name.includes('交誼');
    const category = isCorridor ? '公共動線/大廳' : '居室/浴廁/服務空間';
    roomTypes[category] = (roomTypes[category] || 0) + 1;
  }
  console.log('Room categories:', roomTypes);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
