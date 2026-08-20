import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];

  const targetIds = [1647770, 1647771, 1647830, 1647824, 1647825]; // 教具室, 醫材儲藏室, 樓梯等
  for (const r of rawRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    if (r.Name.includes('教具') || r.Name.includes('醫材') || r.Name.includes('B201') || r.Number.startsWith('F20')) {
      console.log(`Room [${r.Number}] "${r.Name}" (ID: ${r.ElementId}): Center = (${Math.round(info.data?.CenterX)}, ${Math.round(info.data?.CenterY)}), BoundingBox =`, info.data?.BoundingBox);
    }
  }

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
