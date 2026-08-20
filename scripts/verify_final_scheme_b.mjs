import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rooms = roomsRes.data.Rooms || [];

  const targetRooms = rooms.filter(r => {
    const n = parseInt(r.Number.replace('F', ''));
    return n >= 201 && n <= 212;
  });

  targetRooms.sort((a,b) => parseInt(a.Number.replace('F','')) - parseInt(b.Number.replace('F','')));
  console.log('Final verified F201 ~ F212:');
  console.table(targetRooms.map(r => ({
    房號: r.Number,
    名稱: r.Name,
    ElementId: r.ElementId,
    面積: r.Area
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
