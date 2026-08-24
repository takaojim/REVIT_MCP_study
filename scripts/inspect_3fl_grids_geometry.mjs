import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'grid-curve-inspector';
  await client.connect();

  console.log('=== 取得當前 3FL 視圖與軸線真實幾何坐標 ===\n');

  // 1. 取得 3FL 視圖資訊
  const viewInfo = await client.sendCommand('get_active_view', {});
  console.log('當前使用中視圖:', viewInfo.data);
  const viewId = viewInfo.data?.ViewId || 428158;

  // 2. 取得視圖中所有 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId });
  console.log(`視圖中共有 ${gridsRes.data?.Count || 0} 條軸線:`);

  for (const g of gridsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`- 軸線 ID: ${g.ElementId} | 名稱: "${g.Name}" | 類型: ${info.data?.Type}`);
  }

  // 3. 查詢已存在的 Dimensions
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId });
  console.log(`\n視圖中目前存在的 Dimensions 數量: ${dimsRes.data?.Count || 0}`);
  for (const d of dimsRes.data?.Elements || []) {
    console.log(`  - Dimension ID: ${d.ElementId} | Name: "${d.Name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
