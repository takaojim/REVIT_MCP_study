import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typesRes = await client.sendCommand('list_dimension_types', {});
  console.log('=== list_dimension_types output ===');
  console.log(JSON.stringify(typesRes.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
