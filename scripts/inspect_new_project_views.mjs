import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-new-views';
  await client.connect();

  const allViewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const allViews = allViewsRes.data?.Elements || [];

  console.log(`=== 專案中共有 ${allViews.length} 個視圖 ===`);
  const floorPlans = [];

  for (const v of allViews) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const viewType = info.data?.Type || v.Type;
    const name = v.Name;
    if (viewType?.includes('樓板平面圖') || viewType?.includes('FloorPlan') || v.Category?.includes('視圖')) {
      if (['GL', '1FL', '2FL', '3FL', '4FL', '5FL', 'RFL', 'TRFL'].includes(name) || name.match(/^[1-6]FL$/) || name.includes('FL')) {
        floorPlans.push({ id: v.ElementId, name: name, type: viewType });
        console.log(`- 樓板平面圖: "${name}" (ID: ${v.ElementId}, Type: ${viewType})`);
      }
    }
  }

  // 查詢 16 條軸線的詳細資訊
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', maxCount: 100 });
  console.log(`\n=== 專案共有 ${gridsRes.data?.Elements?.length} 條軸線 ===`);
  for (const g of gridsRes.data?.Elements || []) {
    const gInfo = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`  - 軸線: "${g.Name}" (ID: ${g.ElementId})`);
  }

  // 查詢 Dimension Types
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];
  console.log(`\n=== 標註型式清單 (共 ${dimTypes.length} 種) ===`);
  for (const dt of dimTypes) {
    if (dt.DimensionTypeName.includes('柱心') || dt.DimensionTypeName.includes('TABC')) {
      console.log(`  - ID: ${dt.DimensionTypeId} | "${dt.DimensionTypeName}"`);
    }
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
