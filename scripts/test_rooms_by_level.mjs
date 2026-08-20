import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels' });
  const levels = levelsRes.data.Elements;

  for (const lvl of levels) {
    try {
      const res = await client.sendCommand('get_rooms_by_level', { level: lvl.Name });
      console.log(`Level ${lvl.Name}: ${res.data?.Rooms?.length || res.data?.Count || 0} placed rooms`);
    } catch (e) {
      console.log(`Level ${lvl.Name}: error ${e.message}`);
    }
  }

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
