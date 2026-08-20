import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const wallsRes = await client.sendCommand('query_elements', {
    category: 'Walls',
    maxCount: 10000,
    returnFields: ['空間編號', '空間名稱', '底部約束', '長度', '不連續高度', '面積']
  });

  const elements = wallsRes.data?.Elements || [];
  console.log('Total walls in model:', elements.length);

  const typeCounts = {};
  for (const w of elements) {
    typeCounts[w.Name] = (typeCounts[w.Name] || 0) + 1;
  }

  console.log('Wall counts by type:', JSON.stringify(typeCounts, null, 2));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
