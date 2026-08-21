import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-level-curves';
  await client.connect();

  const views = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  for (const v of views) {
    console.log(`\n=== 視圖: ${v.name} (${v.viewId}) ===`);
    const lRes = await client.sendCommand('query_elements', { category: 'Levels', viewId: v.viewId });
    console.log(`Levels 數量: ${lRes.data?.Elements?.length}`);

    const gRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: v.viewId });
    console.log(`Grids 數量: ${gRes.data?.Elements?.length}`);
    for (const g of gRes.data?.Elements || []) {
      console.log(`  Grid ${g.Name} (ID: ${g.ElementId})`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
