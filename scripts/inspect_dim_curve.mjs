import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-curve';
  await client.connect();

  console.log('=== 查詢標註 2246297 與 2246298 的實際幾何位置 ===\n');

  // 取得北立面的 Dim
  const northDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: 8157 });
  console.log('北立面 Dimensions:', northDims.data?.Elements);

  for (const d of northDims.data?.Elements || []) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`Dim ${d.ElementId}:`, dInfo.data);
  }

  await client.disconnect();
}

main().catch(console.error);
