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
  const rawPartitionWalls = wallsRes.data.Elements.filter(w => w.Name.includes('廁所隔牆') || w.Name.includes('TYPE') || w.Name.includes('輕隔間'));
  console.log('Partition walls count:', rawPartitionWalls.length);

  for (const w of rawPartitionWalls.slice(0, 5)) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    console.log('Sample partition wall:', w.ElementId, w.Name, info.data);
  }

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
