import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-345-dims';
  await client.connect();

  const floorViews = [
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: '5FL', viewId: 1334374 }
  ];

  for (const fv of floorViews) {
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fv.viewId });
    console.log(`視圖 ${fv.name} (ID: ${fv.viewId}): 有 ${dimQuery.data?.Count || 0} 個 Dimensions`);
    for (const d of dimQuery.data?.Elements || []) {
      console.log(`  - ID: ${d.ElementId}, Name: "${d.Name}"`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
