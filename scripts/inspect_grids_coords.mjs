import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids' });
  console.log('Grids Count:', gridsRes.data?.Count);

  const gridList = gridsRes.data.Elements;
  console.log('Grid list:', gridList);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
