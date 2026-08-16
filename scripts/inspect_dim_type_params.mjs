import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318;
  const typeIdDownRight = 2110326;

  console.log('=== 查詢 TABC-DIM_*/ S 2.5-柱心-上右 與 下右 之所有型式參數 ===');
  const infoUp = await client.sendCommand('get_element_info', { elementId: typeIdUpRight });
  console.log('--- 柱心-上右 參數 ---');
  console.log(JSON.stringify(infoUp.data?.Parameters, null, 2));

  const infoDown = await client.sendCommand('get_element_info', { elementId: typeIdDownRight });
  console.log('--- 柱心-下右 參數 ---');
  console.log(JSON.stringify(infoDown.data?.Parameters, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
