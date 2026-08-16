import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewIds = [695, 699, 268791, 395061, 395092];
  for (const vid of viewIds) {
    // switch to view to inspect
    try {
      await client.sendCommand('set_active_view', { viewId: vid });
      const active = await client.sendCommand('get_active_view', {});
      console.log(`View ${vid}:`, JSON.stringify(active.data));
    } catch (e) {
      console.log(`View ${vid} error:`, e.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
