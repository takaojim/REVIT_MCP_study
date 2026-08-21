import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-345-views';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const list = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const name = v.Name || '';
    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const level = getVal('關聯的樓層') || '';

    if (name.includes('3') || name.includes('4') || name.includes('5') || level.includes('3') || level.includes('4') || level.includes('5')) {
      list.push({ id: v.ElementId, name, viewType, typeName, level });
    }
  }

  console.log(`=== 專案中所有與 3F/4F/5F 相關的視圖 (${list.length} 個) ===`);
  for (const item of list) {
    console.log(`ID: ${item.id.toString().padEnd(8)} | 族群: "${item.viewType.padEnd(10)}" | 類型: "${item.typeName.padEnd(12)}" | 樓層: "${item.level.padEnd(6)}" | 名稱: "${item.name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
