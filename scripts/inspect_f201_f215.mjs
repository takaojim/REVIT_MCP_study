import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];

  const targetRooms = rawRooms.filter(r => {
    const n = parseInt(r.Number.replace('F', ''));
    return n >= 201 && n <= 215;
  });

  const details = [];
  for (const r of targetRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    details.push({
      Number: r.Number,
      Name: r.Name,
      ElementId: r.ElementId,
      CenterX: Math.round(info.data?.CenterX),
      CenterY: Math.round(info.data?.CenterY),
      BBox: {
        MinX: Math.round(info.data?.BoundingBox?.MinX),
        MaxX: Math.round(info.data?.BoundingBox?.MaxX),
        MinY: Math.round(info.data?.BoundingBox?.MinY),
        MaxY: Math.round(info.data?.BoundingBox?.MaxY),
      }
    });
  }

  details.sort((a,b) => parseInt(a.Number.replace('F','')) - parseInt(b.Number.replace('F','')));
  console.log('Details of F201 ~ F215:');
  console.table(details);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
