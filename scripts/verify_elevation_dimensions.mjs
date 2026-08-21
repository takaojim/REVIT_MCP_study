import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'verify-elevation-dims';
  await client.connect();

  console.log('=== 驗證「立面圖(建築立面)」標註成果 ===\n');

  const views = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  for (const v of views) {
    const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.viewId });
    const dims = dimsRes.data?.Elements || [];
    console.log(`視圖 [${v.name}] (ID: ${v.viewId}) - 標註數量: ${dims.length}`);
    for (const d of dims) {
      const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
      const typeName = dInfo.data?.Type;
      const val = dInfo.data?.Parameters?.find(p => p.Name === '總長度' || p.Name === '值' || p.Name === 'Value')?.Value;
      const num = dInfo.data?.Parameters?.find(p => p.Name === '數量')?.Value;
      console.log(`  - 標註 ID: ${d.ElementId} | 型式: ${typeName} | 數值: ${val} mm | 區段數/數量: ${num}`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
