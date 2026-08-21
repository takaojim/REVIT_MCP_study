import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-views';
  await client.connect();

  console.log('連線 Revit 成功，查詢所有視圖...');

  const res = await client.sendCommand('query_elements', { category: 'Views' });
  const views = res.data?.Elements || [];
  console.log(`總共找到 ${views.length} 個視圖圖元`);

  const elevationViews = [];
  for (const v of views) {
    // 檢查詳細資訊
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const params = info.data?.Parameters || [];
    const viewType = params.find(p => p.Name === '視圖類型' || p.Name === '類型')?.Value;
    const viewName = params.find(p => p.Name === '視圖名稱')?.Value || v.Name;
    const discipline = params.find(p => p.Name === '專業領域' || p.Name === 'Discipline')?.Value;
    const subDiscipline = params.find(p => p.Name === '子專業領域' || p.Name === '子領域' || p.Name === '視圖子類別')?.Value;
    const viewFamily = params.find(p => p.Name === '視圖族群' || p.Name === '族群')?.Value;
    const groupParam = params.find(p => p.Name.includes('立面') || p.Value?.includes('立面') || p.Value?.includes('建築立面'));

    // Check if name or parameters contain '立面' or if it is an Elevation view
    const isElevation = viewType?.includes('立面') || viewFamily?.includes('立面') || viewName?.includes('立面') || groupParam;
    
    // Print all parameters if relevant
    const allParamStrings = params.map(p => `${p.Name}=${p.Value}`).join(', ');
    if (allParamStrings.includes('立面') || isElevation) {
      elevationViews.push({
        id: v.ElementId,
        name: viewName,
        type: viewType,
        family: viewFamily,
        allParams: params
      });
    }
  }

  console.log(`\n=== 找到 ${elevationViews.length} 個立面相關視圖 ===`);
  for (const ev of elevationViews) {
    console.log(`ID: ${ev.id}, Name: ${ev.name}, Type: ${ev.type}, Family: ${ev.family}`);
    for (const p of ev.allParams) {
      if (p.Value && (p.Value.includes('立面') || p.Name.includes('立面') || p.Name.includes('專案圖元分類') || p.Name.includes('次分類') || p.Name.includes('比例'))) {
        console.log(`   - ${p.Name}: ${p.Value}`);
      }
    }
  }

  await client.disconnect();
}

main().catch(console.error);
