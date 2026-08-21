import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'list-all-plan-views';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  console.log(`總共有 ${viewsRes.data?.Count || 0} 個視圖`);

  const planViews = [];
  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const subType = getVal('子專業') || getVal('視圖子分類') || getVal('視圖用途') || getVal('視圖群組') || '';
    const discipline = getVal('專業') || '';
    const viewName = v.Name || '';

    // 篩選各類 Plan 視圖或包含關鍵字的視圖
    planViews.push({
      id: v.ElementId,
      name: viewName,
      viewType,
      subType,
      discipline
    });
  }

  // 排序並打印
  planViews.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  
  console.log('\n=== 所有平面/視圖名稱列表 ===');
  for (const pv of planViews) {
    if (pv.name.includes('防火') || pv.name.includes('平面') || pv.name.includes('建') || pv.name.includes('FL')) {
      console.log(`ID: ${pv.id.toString().padEnd(8)} | Type: ${pv.viewType.padEnd(12)} | Sub: ${pv.subType.padEnd(12)} | Name: "${pv.name}"`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
