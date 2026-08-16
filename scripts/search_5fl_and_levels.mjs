import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const allViews = viewsRes.data.Elements;

  console.log('=== All Views matching 5 or RF or Roof ===');
  const filtered = allViews.filter(v => v.Name && (v.Name.includes('5') || v.Name.includes('RF') || v.Name.includes('屋頂') || v.Name.includes('FL')));
  console.table(filtered);

  // Also query Levels in the document
  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels' });
  console.log('=== All Levels ===');
  console.table(levelsRes.data?.Elements);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
