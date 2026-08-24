import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-grids';
  await client.connect();

  console.log('=== 查詢當前專案軸線資訊 (以 2FL ID: 695 為例) ===\n');

  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: 695, maxCount: 100 });
  console.log(`找到 ${gridsRes.data?.Elements?.length || 0} 條軸線:`);

  const vertGrids = [];
  const horizGrids = [];

  for (const g of gridsRes.data?.Elements || []) {
    const loc = await client.sendCommand('get_element_location', { elementId: g.ElementId });
    console.log(`- 軸線: "${g.Name}" (ID: ${g.ElementId})`, JSON.stringify(loc.data));
  }

  // 查詢 Dimension Types
  const allElements = await client.sendCommand('query_elements', { category: 'Dimensions', maxCount: 10 });
  console.log('\nDimensions:', allElements.data?.Count);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
