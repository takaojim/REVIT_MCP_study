import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 查詢 2FL 上所有現有的 Dimension 元素
  console.log('=== 1. 查詢 2FL 上現有的 Dimension 元素與其類型 ===');
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('2FL Dimensions 總數:', dimsRes.data?.Count);

  // 2. 查詢所有 DimensionTypes
  console.log('\n=== 2. 查詢專案中所有 Dimension Types ===');
  try {
    const typesRes = await client.sendCommand('list_dimension_types', {});
    console.log('list_dimension_types:', JSON.stringify(typesRes.data, null, 2));
  } catch (e) {
    console.log('list_dimension_types error:', e.message);
  }

  // 3. 逐一查詢 2FL 現有的每個 Dimension 的詳細資訊 (Type, Name, Value, Text)
  for (const d of dimsRes.data.Elements) {
    const elemInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`Dimension ID ${d.ElementId} (${d.Name}):`, JSON.stringify(elemInfo.data, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
