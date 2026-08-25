import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-floorplans-5story';
  await client.connect();

  const allViewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const allViews = allViewsRes.data?.Elements || [];

  const mainFloorPlans = [];

  for (const v of allViews) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const name = info.data?.Name || v.Name;
    const viewType = info.data?.Type;
    const level = info.data?.Parameters?.find(p => p.Name === '關聯的樓層' || p.Name === 'Associated Level')?.Value;

    // Filter true architectural floor plans
    if (viewType === '樓板平面圖' || viewType === 'FloorPlan') {
      if (['1FL', '2FL', '3FL', '4FL', '5FL', 'RFL', 'TRFL', 'GL'].includes(name) || name.match(/^[1-6]FL$/)) {
        mainFloorPlans.push({
          id: v.ElementId,
          name: name,
          viewType: viewType,
          level: level
        });
      }
    }
  }

  console.log(`=== 找到 ${mainFloorPlans.length} 個主要樓板平面圖視圖 ===`);
  for (const fp of mainFloorPlans) {
    console.log(`- 視圖: "${fp.name}" (ID: ${fp.id}, Level: ${fp.level})`);
  }

  // 查詢所有 16 條軸線的方向與順序
  // 檢查垂直軸線 (A~H) 與水平軸線 (1~8)
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: mainFloorPlans[0]?.id, maxCount: 100 });
  console.log(`\n=== 軸線分析 (${gridsRes.data?.Elements?.length} 條) ===`);
  for (const g of gridsRes.data?.Elements || []) {
    const gInfo = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`  - 軸線 [${gInfo.data?.Name}] (ID: ${g.ElementId})`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
