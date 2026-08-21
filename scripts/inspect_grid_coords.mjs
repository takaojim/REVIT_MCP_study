import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-grid-curve-coords';
  await client.connect();

  console.log('=== 檢查北立面各軸線與 View 空間幾何 ===\n');

  const northViewId = 8157;
  await client.sendCommand('set_active_view', { viewId: northViewId });

  // 取得北立面中的所有 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: northViewId });
  const grids = gridsRes.data?.Elements || [];

  for (const g of grids) {
    const gInfo = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`軸線 ${g.Name} (ID: ${g.ElementId}):`, JSON.stringify(gInfo.data, null, 2));
  }

  await client.disconnect();
}

main().catch(console.error);
