import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'grid-info-inspector';
  await client.connect();

  const g1 = await client.sendCommand('get_element_info', { elementId: 192066 }); // Grid 1
  console.log('Grid 1 info:', JSON.stringify(g1.data, null, 2));

  const gA = await client.sendCommand('get_element_info', { elementId: 192192 }); // Grid A
  console.log('Grid A info:', JSON.stringify(gA.data, null, 2));

  await client.disconnect();
}

main().catch(console.error);
