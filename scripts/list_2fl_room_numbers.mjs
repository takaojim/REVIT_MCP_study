import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL', includeUnnamed: true });
  const rooms = roomsRes.data.Rooms || [];

  const numbers = rooms.map(r => r.Number);
  console.log('All 2FL room numbers:', numbers.sort());

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
