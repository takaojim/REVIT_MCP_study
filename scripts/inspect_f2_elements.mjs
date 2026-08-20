import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('query_elements', {
    category: 'Rooms',
    maxCount: 5000,
    returnFields: ['編號', '名稱', '樓層', '面積']
  });

  const elements = roomsRes.data.Elements || [];
  const f201_210 = elements.filter(e => {
    const n = e['編號'];
    return n && n.startsWith('F2');
  });

  console.log(`Found ${f201_210.length} rooms starting with F2 in project:`);
  for (const r of f201_210.slice(0, 15)) {
    console.log(`ElementId: ${r.ElementId}, Name: "${r.Name}", Number: "${r['編號']}", Level: "${r['樓層']}", Area: "${r['面積']}"`);
  }

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
