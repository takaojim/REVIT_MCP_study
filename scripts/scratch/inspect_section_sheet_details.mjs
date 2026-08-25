import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-section-sheet';
  await client.connect();

  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('Sheet 650359 Details:', JSON.stringify(details.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
