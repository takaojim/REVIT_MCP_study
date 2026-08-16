import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  const uniqueRooms = [];
  const seen = new Set();

  for (const r of roomsRes.data.Rooms) {
    if (!seen.has(r.Number)) {
      seen.add(r.Number);
      const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
      uniqueRooms.push(info.data);
    }
  }

  console.log('Unique Rooms on 3FL count:', uniqueRooms.length);
  console.log(JSON.stringify(uniqueRooms, null, 2));

  // Compute building bounding box based on placed rooms
  const minX = Math.min(...uniqueRooms.map(r => r.BoundingBox.MinX));
  const maxX = Math.max(...uniqueRooms.map(r => r.BoundingBox.MaxX));
  const minY = Math.min(...uniqueRooms.map(r => r.BoundingBox.MinY));
  const maxY = Math.max(...uniqueRooms.map(r => r.BoundingBox.MaxY));

  console.log(`\n=== 3FL 房間外包邊界 (Building Extent) ===`);
  console.log(`X: [${minX.toFixed(1)}, ${maxX.toFixed(1)}] (總寬度: ${(maxX - minX).toFixed(1)} mm)`);
  console.log(`Y: [${minY.toFixed(1)}, ${maxY.toFixed(1)}] (總深度: ${(maxY - minY).toFixed(1)} mm)`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
