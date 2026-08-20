import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const wtRes = await client.sendCommand('get_wall_types', {});
  console.log('Wall Types:', JSON.stringify(wtRes.data?.WallTypes?.map(w => w.Name), null, 2));

  const wallsRes = await client.sendCommand('query_elements', {
    category: 'Walls',
    maxCount: 200,
    returnFields: ['空間編號', '空間名稱', '底部約束', '長度', '不連續高度', '面積']
  });

  const wallNames = [...new Set(wallsRes.data?.Elements?.map(w => w.Name))];
  console.log('Sample Wall Instance Types in Model:', wallNames);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
