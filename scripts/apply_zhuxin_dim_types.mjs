import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318; // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  // 1. 北側：2110202 (柱心連續標註), 2110205 (總長) -> 上右
  const resNorth = await client.sendCommand('change_element_type', {
    elementIds: [2110202, 2110205],
    typeId: typeIdUpRight
  });
  console.log('北側變更結果:', resNorth.data);

  // 2. 西側：2110213 (柱心連續標註), 2110216 (總深) -> 下右
  const resWest = await client.sendCommand('change_element_type', {
    elementIds: [2110213, 2110216],
    typeId: typeIdDownRight
  });
  console.log('西側變更結果:', resWest.data);

  // 3. 南側：2110221 (柱心連續標註), 2110224 (總長) -> 下右
  const resSouth = await client.sendCommand('change_element_type', {
    elementIds: [2110221, 2110224],
    typeId: typeIdDownRight
  });
  console.log('南側變更結果:', resSouth.data);

  // 4. 東側：2110228 (柱心連續標註), 2110231 (總深) -> 上右
  const resEast = await client.sendCommand('change_element_type', {
    elementIds: [2110228, 2110231],
    typeId: typeIdUpRight
  });
  console.log('東側變更結果:', resEast.data);

  process.exit(0);
}

main().catch(err => {
  console.error('變更失敗:', err);
  process.exit(1);
});
