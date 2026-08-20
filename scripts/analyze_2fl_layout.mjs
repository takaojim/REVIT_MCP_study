import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];

  const rooms = [];
  for (const r of rawRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    rooms.push({
      elementId: r.ElementId,
      name: r.Name,
      oldNumber: r.Number,
      area: r.Area,
      centerX: info.data?.CenterX ?? r.CenterX,
      centerY: info.data?.CenterY ?? r.CenterY,
      bbox: info.data?.BoundingBox
    });
  }

  // 去重
  const uniqueRooms = Array.from(new Map(rooms.map(r => [r.elementId, r])).values());
  console.log(`Total unique placed rooms on 2FL: ${uniqueRooms.length}`);

  // Let's analyze major zones / bays on 2FL
  // On 2FL:
  // North Zone (Y > 20000):
  // West-to-East bays:
  // Bay 1: 教具室 (top, Y~29358) + 醫材儲藏室 (bottom, Y~25329) [X ~ 0]
  // Bay 2: 寢室 B201 (top, Y~27950) + 浴廁 (bottom, Y~24464) [X ~ 5000]
  // Bay 3: 寢室 B202 (top, Y~29258) + 浴廁 (bottom, Y~24740) [X ~ 8500]
  // Bay 4: 寢室 B203 (top, Y~25935) + 浴廁 (bottom, Y~24464) [X ~ 12000]
  // ... etc.

  // Let's see: How to formalize Scheme B?
  // We divide the floor into major horizontal wings/zones by Y bands (or corridor separators):
  // 1. North Wing (Y >= 20000)
  // 2. Middle Wing / Public Area (10000 <= Y < 20000)
  // 3. South-East / Core / Hall (0 <= Y < 10000)
  // 4. South Wing (Y < 0)

  // Within each wing, group into X bays (or column grids).
  // Within each bay, sort by Y descending (Top room first -> Bottom room / attached bath second)!

  console.log('Room Y distribution:', 
    uniqueRooms.map(r => ({ name: r.name, x: Math.round(r.centerX), y: Math.round(r.centerY) }))
      .sort((a,b) => b.y - a.y)
  );

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
