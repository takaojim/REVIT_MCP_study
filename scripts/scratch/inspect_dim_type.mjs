import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-type';
  await client.connect();

  const dInfo = await client.sendCommand('get_element_info', { elementId: 631741 });
  console.log('Dimension 631741 info:', JSON.stringify(dInfo.data, null, 2));

  // Also query all Grids in the project
  const gridsRes = await client.sendCommand('get_all_grids', {});
  console.log('Grids:', JSON.stringify(gridsRes.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
