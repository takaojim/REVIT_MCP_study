import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-geometry';
  await client.connect();

  console.log('=== 檢查立面圖視圖方向與軸線幾何 ===\n');

  const views = [
    { id: 8157, name: '北' },
    { id: 8176, name: '東' },
    { id: 8237, name: '西' },
    { id: 98984, name: '南' }
  ];

  for (const v of views) {
    console.log(`\n========================================`);
    console.log(`視圖: ${v.name} (ID: ${v.id})`);
    console.log(`========================================`);

    await client.sendCommand('set_active_view', { viewId: v.id });

    // 取得視圖資訊
    const vInfo = await client.sendCommand('get_element_info', { elementId: v.id });
    console.log('視圖參數:', JSON.stringify(vInfo.data?.Parameters?.filter(p => p.Name.includes('向') || p.Name.includes('標高') || p.Name.includes('範圍') || p.Name.includes('邊界') || p.Name.includes('比例') || p.Name.includes('截斷')), null, 2));

    // 取得視圖中的 Grids
    const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: v.id });
    const grids = gridsRes.data?.Elements || [];
    console.log(`可見軸線 (${grids.length} 個):`);
    for (const g of grids) {
      const gInfo = await client.sendCommand('get_element_info', { elementId: g.ElementId });
      console.log(`  - 軸線 ${g.Name} (ID: ${g.ElementId}):`, JSON.stringify(gInfo.data?.Parameters?.filter(p => p.Name.includes('長度') || p.Name.includes('名稱') || p.Name.includes('標註')), null, 2));
    }
  }

  await client.disconnect();
}

main().catch(console.error);
