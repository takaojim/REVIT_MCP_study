import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-sheet-tb';
  await client.connect();

  const tbRes = await client.sendCommand('get_titleblocks', {});
  console.log('Title Blocks:', JSON.stringify(tbRes.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
