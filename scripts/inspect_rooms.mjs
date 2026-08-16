import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158;

  // 1. Get room info for each room on 3FL
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  console.log('--- Rooms on 3FL ---');
  for (const r of roomsRes.data.Rooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    console.log(`Room [${r.Name} - ${r.Number}] ID: ${r.ElementId}:`, JSON.stringify(info.data));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
