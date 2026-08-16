import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  console.log('Total Rooms returned on 3FL:', roomsRes.data.TotalRooms);

  const rooms = [];
  for (const r of roomsRes.data.Rooms) {
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

  // De-duplicate rooms by ElementId
  const uniqueMap = new Map();
  for (const rm of rooms) {
    if (!uniqueMap.has(rm.elementId)) {
      uniqueMap.set(rm.elementId, rm);
    }
  }
  const uniqueRooms = Array.from(uniqueMap.values());
  console.log(`Unique rooms count on 3FL: ${uniqueRooms.length}`);

  // Sort algorithm:
  // Top-to-Bottom (Y descending), Left-to-Right (X ascending) with Y row tolerance
  // Let's cluster by Y rows (row tolerance e.g. 3000 mm)
  // First sort by CenterY descending
  uniqueRooms.sort((a, b) => b.centerY - a.centerY);

  // Group into rows
  const rowTolerance = 3000; // 3 meters
  const rows = [];
  for (const rm of uniqueRooms) {
    let placed = false;
    for (const row of rows) {
      // If within tolerance of row's average Y
      const avgY = row.reduce((sum, r) => sum + r.centerY, 0) / row.length;
      if (Math.abs(rm.centerY - avgY) <= rowTolerance) {
        row.push(rm);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([rm]);
    }
  }

  // Sort each row by CenterX ascending (Left to Right)
  // And sort rows by their average Y descending (Top to Bottom)
  rows.sort((a, b) => {
    const avgA = a.reduce((sum, r) => sum + r.centerY, 0) / a.length;
    const avgB = b.reduce((sum, r) => sum + r.centerY, 0) / b.length;
    return avgB - avgA;
  });

  rows.forEach(r => r.sort((a, b) => a.centerX - b.centerX));

  const sortedRooms = rows.flat();

  // Assign numbers starting from F301
  let index = 1;
  const plan = [];
  for (const rm of sortedRooms) {
    const numStr = String(index).padStart(2, '0');
    const newNumber = `F3${numStr}`; // F301, F302, ...
    plan.push({
      index,
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY)
    });
    index++;
  }

  console.log('\n=== 房間重新編號排序預覽 (Top-to-Bottom, Left-to-Right) ===');
  console.table(plan);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
