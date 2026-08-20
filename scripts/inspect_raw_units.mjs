import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const doorRes = await client.sendCommand('query_elements', {
    category: 'Doors',
    maxCount: 5,
    returnFields: ['樓層', '寬度', '高度', '粗略寬度', '粗略高度', '窗頂高度', '框總寬度']
  });
  console.log('Sample Doors raw:', doorRes.data.Elements);

  const wallRes = await client.sendCommand('query_elements', {
    category: 'Walls',
    maxCount: 5,
    returnFields: ['空間編號', '空間名稱', '底部約束', '長度', '不連續高度', '面積']
  });
  console.log('Sample Walls raw:', wallRes.data.Elements);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
