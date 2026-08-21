import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-site-plans';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const sitePlanViews = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const name = v.Name || '';

    if (viewType === '建地平面圖' || name.includes('防火區劃') || name.includes('籌設防火區劃圖')) {
      sitePlanViews.push({
        id: v.ElementId,
        name: name,
        viewType: viewType,
        scale: getVal('比例值 1:') || getVal('比例')
      });
    }
  }

  console.log(`=== 找到 ${sitePlanViews.length} 個相關視圖 ===`);
  for (const sv of sitePlanViews) {
    console.log(`ID: ${sv.id.toString().padEnd(8)} | Type: "${sv.viewType}" | Name: "${sv.name}" | Scale: 1:${sv.scale}`);
  }

  await client.disconnect();
}

main().catch(console.error);
