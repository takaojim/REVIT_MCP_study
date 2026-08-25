import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-dim-types';
  await client.connect();

  const res = await client.sendCommand('query_elements', { category: 'Dimensions', maxCount: 10000 });
  console.log('Query result:', res.data);

  // 找所有型式
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  console.log(`專案中共有 ${viewsRes.data?.Count || 0} 個視圖`);

  await client.disconnect();
}

main().catch(console.error);
