import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'search-all-views-nocap';
  await client.connect();

  // 傳入 maxCount: 2000 避免被預設 100 筆限制截斷
  const res = await client.sendCommand('query_elements', { category: 'Views', maxCount: 2000 });
  console.log(`總共取得 ${res.data?.Count || 0} 個視圖圖元`);

  const fireViews = [];
  for (const v of res.data?.Elements || []) {
    if (v.Name && v.Name.includes('籌設防火區劃圖')) {
      fireViews.push({ id: v.ElementId, name: v.Name });
    }
  }

  console.log(`\n=== 找到的所有「籌設防火區劃圖」視圖 (${fireViews.length} 個) ===`);
  for (const fv of fireViews) {
    console.log(`- ID: ${fv.id} | Name: "${fv.name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
