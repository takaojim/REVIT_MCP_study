import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-levels';
  await client.connect();

  const views = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  for (const v of views) {
    console.log(`\n=== 檢查視圖: ${v.name} (${v.viewId}) ===`);
    await client.sendCommand('set_active_view', { viewId: v.viewId });

    // 取得現有 Dimensions
    const dims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.viewId });
    console.log(`Dimensions 數量: ${dims.data?.Elements?.length}`);
    for (const d of dims.data?.Elements || []) {
      console.log(`  ID: ${d.ElementId}, Name: ${d.Name}`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
