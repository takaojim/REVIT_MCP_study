import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'diagnose-lines-' + Date.now();
  await client.connect();

  const activeView = await client.sendCommand('get_active_view', {});
  console.log('當前開啟視圖:', activeView.data);

  // 查詢當前專案中所有視圖的線條與標註情況
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  console.log('\n=== 各視圖詳圖線 (Lines) 與 標註 (Dimensions) 統計 ===');
  for (const v of allViews) {
    if (v.Name.startsWith('{')) continue;
    const lRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.ElementId });
    const dRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.ElementId });
    const lineCount = lRes.data?.Count || 0;
    const dimCount = dRes.data?.Count || 0;
    if (lineCount > 0 || dimCount > 0) {
      console.log(`- 視圖: "${v.Name}" (ID: ${v.ElementId}) -> 詳圖線: ${lineCount} 條, 標註: ${dimCount} 個`);
    } else {
      // 檢查是否為平面圖卻沒有線
      const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
      const type = info.data?.Type || '';
      if (type.includes('平面') || info.data?.ViewType === 'FloorPlan') {
        console.log(`⚠️ 無線條視圖: "${v.Name}" (ID: ${v.ElementId}, Type: ${type}) -> 詳圖線: 0, 標註: 0`);
      }
    }
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
