import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-properties';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data?.ElementId || 8237;
  console.log(`當前視圖: ${viewRes.data?.Name} (${viewId})`);

  const dims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log(`視圖中的 Dimensions:`, dims.data?.Elements);

  for (const d of dims.data?.Elements || []) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`\nDimension ID ${d.ElementId} (${d.Name}):`, {
      Parameters: dInfo.data?.Parameters
    });
  }

  await client.disconnect();
}

main().catch(console.error);
