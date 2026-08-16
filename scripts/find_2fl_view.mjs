import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  // 1. Get all views
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const allViews = viewsRes.data.Elements;

  const plan2FL = allViews.filter(v => v.Name && (v.Name.includes('2FL') || v.Name.includes('2F')));
  console.log('2FL Views:', JSON.stringify(plan2FL, null, 2));

  // 2. Query Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids' });
  console.log('Grids Count:', gridsRes.data?.Count);
  console.log('Grids:', gridsRes.data?.Elements);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
