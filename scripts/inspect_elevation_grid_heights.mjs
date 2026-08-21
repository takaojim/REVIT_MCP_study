import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-grid-heights';
  await client.connect();

  console.log('=== 查詢立面圖軸線端點與高程 ===\n');

  // 先查詢現有立面視圖中的所有 Dimensions（看看剛才建的在不在）
  const northViewId = 8157;
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: northViewId });
  console.log('北立面目前 Dimensions:', dimsRes.data?.Elements);

  // 取得北立面 CropBox 與 View 資訊
  const viewInfo = await client.sendCommand('get_element_info', { elementId: northViewId });
  console.log('北立面 View 參數:');
  for (const p of viewInfo.data?.Parameters || []) {
    if (p.Name.includes('標高') || p.Name.includes('高度') || p.Name.includes('裁剪') || p.Name.includes('邊界') || p.Name.includes('極值')) {
      console.log(`  - ${p.Name}: ${p.Value}`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
