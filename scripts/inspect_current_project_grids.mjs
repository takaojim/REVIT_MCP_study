import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'grid-inspector';
  await client.connect();

  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', maxCount: 1000 });
  console.log(`專案中共有 ${gridsRes.data?.Count || 0} 條軸線:`);
  for (const g of gridsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`- ID: ${g.ElementId} | Name: "${g.Name}"`);
  }

  await client.disconnect();
}

main().catch(console.error);
