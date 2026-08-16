import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  // 查詢目前 2FL 上的 Dimensions
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('2FL 現有 Dimensions 數量:', dimsRes.data?.Count);
  console.log('Dimensions:', dimsRes.data?.Elements);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
