import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-all-floors-fire';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  console.log(`=== 搜尋專案中所有包含 3FL, 4FL, 5FL 或 防火區劃 的視圖 ===`);

  const matchedViews = [];
  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const name = v.Name || '';
    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const sheetNum = getVal('圖紙號碼') || '';
    const sheetName = getVal('圖紙名稱') || '';
    const level = getVal('關聯的樓層') || '';

    if (
      name.includes('3FL') || name.includes('4FL') || name.includes('5FL') ||
      name.includes('3F') || name.includes('4F') || name.includes('5F') ||
      name.includes('防火') || typeName.includes('防火') || viewType.includes('建地')
    ) {
      matchedViews.push({
        id: v.ElementId,
        name,
        viewType,
        typeName,
        level,
        sheetNum,
        sheetName
      });
    }
  }

  for (const mv of matchedViews) {
    console.log(`ID: ${mv.id.toString().padEnd(8)} | 族群: "${mv.viewType.padEnd(10)}" | 類型: "${mv.typeName.padEnd(12)}" | 樓層: "${mv.level.padEnd(6)}" | 圖紙: "${mv.sheetNum} ${mv.sheetName}" | 名稱: "${mv.name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
