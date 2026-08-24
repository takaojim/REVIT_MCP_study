import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'plan-grid-diagnose';
  await client.connect();

  const viewInfo = await client.sendCommand('get_active_view', {});
  console.log('Active View:', viewInfo.data);
  const viewId = viewInfo.data?.ViewId || 428158;

  // 取得 3FL 中的所有 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId });
  console.log(`視圖 ID ${viewId} 中共有 ${gridsRes.data?.Count} 條軸線:`);

  for (const g of gridsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    const p = info.data?.Parameters || [];
    console.log(`- 軸線 ${g.Name} (ID: ${g.ElementId})`);
  }

  // 取得 3FL 中的所有牆體，計算建築物的真實現身範圍 (BoundingBox)
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId, maxCount: 1000 });
  console.log(`\n視圖中有 ${wallsRes.data?.Count || 0} 道牆`);

  await client.disconnect();
}

main().catch(console.error);
