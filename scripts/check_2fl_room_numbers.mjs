import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', viewRes.data);

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL', includeUnnamed: true });
  console.log('Rooms on 2FL summary:', {
    Level: roomsRes.data.Level,
    TotalRooms: roomsRes.data.TotalRooms,
    RoomsWithName: roomsRes.data.RoomsWithName,
    RoomsWithoutName: roomsRes.data.RoomsWithoutName,
    TotalArea: roomsRes.data.TotalArea,
  });

  const rooms = roomsRes.data.Rooms || [];
  console.log(`First 15 rooms on 2FL:`);
  for (const r of rooms.slice(0, 15)) {
    console.log(`- Id: ${r.ElementId || r.RoomId}, Name: "${r.Name}", Number: "${r.Number}", Area: ${r.Area} m²`);
  }

  const unnumbered = rooms.filter(r => !r.Number || r.Number.trim() === '');
  const numbered = rooms.filter(r => r.Number && r.Number.trim() !== '');
  console.log(`Numbered count: ${numbered.length}, Unnumbered count: ${unnumbered.length}`);

  const numbers = rooms.map(r => r.Number).filter(Boolean);
  console.log('Sample numbers:', numbers.slice(0, 20));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
