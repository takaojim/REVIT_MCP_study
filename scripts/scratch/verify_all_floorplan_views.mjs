import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'verify-fps';
  await client.connect();

  const targetNames = ['1FL', '2FL', '3FL', '4FL', '5FL', 'RFL', 'TRFL', 'GL'];
  const allViewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 5000 });

  const foundViews = [];
  for (const v of allViewsRes.data?.Elements || []) {
    if (targetNames.includes(v.Name)) {
      const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
      if (info.data?.Type === '樓板平面圖' || info.data?.Type === 'FloorPlan') {
        foundViews.push({ id: v.ElementId, name: v.Name, type: info.data?.Type });
        console.log(`Found FloorPlan: "${v.Name}" (ID: ${v.ElementId})`);
      }
    }
  }

  console.log(`\nFound ${foundViews.length} target floor plans.`);
  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
