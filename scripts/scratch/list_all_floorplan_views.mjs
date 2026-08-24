import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'list-floor-plans';
  await client.connect();

  console.log('=== 查詢專案中所有樓板平面圖視圖 ===\n');

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const allViews = viewsRes.data?.Elements || [];

  const floorPlans = [];

  for (const v of allViews) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || '';

    const isFloorPlan = (
      info.data?.ViewType === 'FloorPlan' ||
      viewType === '樓板平面圖' ||
      typeName.includes('樓板平面圖') ||
      typeName.includes('建築平面圖') ||
      (viewType.includes('平面') && !viewType.includes('天花板') && !viewType.includes('結構') && !viewType.includes('建地平面圖') && !typeName.includes('防火區劃'))
    );

    // 排除樣板、從屬視圖花括號等
    if (isFloorPlan && !name.startsWith('{') && !info.data?.IsTemplate) {
      floorPlans.push({
        id: v.ElementId,
        name: name,
        scale: info.data?.Scale || 100,
        viewType: viewType || info.data?.ViewType
      });
    }
  }

  console.log(`=== 找到 ${floorPlans.length} 個「樓板平面圖」視圖 ===`);
  for (const fp of floorPlans) {
    console.log(`- ID: ${fp.id.toString().padEnd(8)} | 名稱: "${fp.name.padEnd(20)}" | 比例: 1:${fp.scale}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
