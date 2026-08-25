import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-tabc-type';
  await client.connect();

  const typeIdUpRight = 689724; // TABC-DIM_*/ S 2.5-柱心-上右
  const viewId = 624294; // 4FL

  console.log(`=== 將 4FL 上所有標註切換為型式: TABC-DIM_*/ S 2.5-柱心-上右 (ID: ${typeIdUpRight}) ===\n`);

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  const dims = dimsRes.data?.Elements || [];

  for (const d of dims) {
    const chg = await client.sendCommand('change_element_type', {
      elementId: d.ElementId,
      typeId: typeIdUpRight
    });
    console.log(`- 標註 ID ${d.ElementId}:`, chg.data?.Message || chg.error || 'OK');
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
