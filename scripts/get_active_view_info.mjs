import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'get-active-view-info';
  await client.connect();

  const res = await client.sendCommand('get_active_view', {});
  console.log('當前使用者的 Active View:', res);

  if (res.data?.ViewId) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: res.data.ViewId });
    console.log('Active View 參數:', vInfo.data);

    const dims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: res.data.ViewId });
    console.log('Active View Dimensions:', dims.data?.Elements);
  }

  await client.disconnect();
}

main().catch(console.error);
