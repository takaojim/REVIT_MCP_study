import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-walls-and-slices';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 查詢 2FL 上所有牆體
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];
  console.log(`收集到 ${allWalls.length} 道牆體。`);

  // 2. 測試建立東側 Layer 1, 2, 3，西側 Layer 1, 2, 3，南側 Layer 1, 2, 3
  // 透過 get_element_info 獲取每道牆的資訊
  console.log('正在解析牆體參數...');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
