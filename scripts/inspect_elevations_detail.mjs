import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevations-detail';
  await client.connect();

  console.log('=== 連線 Revit 成功，詳細檢查立面圖(建築立面) 視圖資訊 ===\n');

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

    // 取得視圖詳細資訊
    const vInfo = await client.sendCommand('get_element_info', { elementId: v.id });
    const params = vInfo.data?.Parameters || [];
    const scale = params.find(p => p.Name === '比例值 1:' || p.Name === '視圖比例')?.Value;
    console.log(`- 比例: ${scale}`);

    // 取得視圖中的 Grids
    const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: v.id });
    const grids = gridsRes.data?.Elements || [];
    console.log(`- 可見 Grids (${grids.length} 個): ${grids.map(g => `${g.Name}(${g.ElementId})`).join(', ')}`);

    // 取得視圖中的 Levels
    const levelsRes = await client.sendCommand('query_elements', { category: 'Levels', viewId: v.id });
    const levels = levelsRes.data?.Elements || [];
    console.log(`- 可見 Levels (${levels.length} 個): ${levels.map(l => `${l.Name}(${l.ElementId})`).join(', ')}`);

    // 取得現有 Dimensions
    const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    const dims = dimsRes.data?.Elements || [];
    console.log(`- 現有 Dimensions (${dims.length} 個): ${dims.map(d => `${d.Name}(${d.ElementId})`).join(', ')}`);

    for (const d of dims) {
      const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
      console.log(`  * Dim ${d.ElementId}: Name=${d.Name}, Type=${dInfo.data?.Type}`);
      const val = dInfo.data?.Parameters?.find(p => p.Name === '長度' || p.Name === '值' || p.Name === 'Value')?.Value;
      if (val) console.log(`    Value=${val}`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
