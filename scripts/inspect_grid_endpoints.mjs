import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'grid-endpoints-inspector';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data?.ElementId;
  console.log('Active View:', viewRes.data);

  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId });
  for (const g of gridsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`\nGrid [${g.Name}] (ID: ${g.ElementId}):`);
    console.log('  Location:', JSON.stringify(info.data?.Location));
    console.log('  Geometry:', JSON.stringify(info.data?.Geometry));
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(console.error);
