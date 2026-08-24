import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-sheet-viewports';
  await client.connect();

  console.log('=== Checking Active Sheet Details ===');
  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 690589 });
  console.log('Active Sheet Details:', JSON.stringify(details.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
