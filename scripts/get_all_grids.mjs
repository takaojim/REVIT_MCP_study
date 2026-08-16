import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const grids = await client.sendCommand('get_all_grids', {});
  console.log('=== 全棟 Grid 軸線清單 (get_all_grids) ===');
  console.log(JSON.stringify(grids.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
