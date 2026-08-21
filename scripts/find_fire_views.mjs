import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-fire-views';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  console.log(`=== 專案中全部視圖 (${viewsRes.data?.Count || 0} 個) ===`);

  const fireViews = [];
  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const name = v.Name || '';
    const params = info.data?.Parameters || [];
    const viewTypeParam = params.find(p => p.Name === '視圖類型' || p.Name === 'View Type')?.Value;
    const subDiscipline = params.find(p => p.Name === '子專業' || p.Name === '視圖子分類' || p.Name === '視圖用途' || p.Name === '視圖名稱')?.Value;
    
    // 檢查名稱或參數是否包含 防火區劃, 建地, 建照, 平面圖
    const isMatch = name.includes('防火區劃') || name.includes('建地') || name.includes('建照');
    
    if (isMatch || name.includes('FL') || name.includes('平面')) {
      console.log(`ID: ${v.ElementId} | Name: "${name}" | Type: "${viewTypeParam || ''}"`);
      if (name.includes('防火區劃') || isMatch) {
        fireViews.push({ id: v.ElementId, name, params });
      }
    }
  }

  console.log(`\n=== 匹配到 "防火區劃" / "建照" / "建地" 的視圖 (${fireViews.length} 個) ===`);
  for (const fv of fireViews) {
    console.log(`- ID: ${fv.id} | Name: "${fv.name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
