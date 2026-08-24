import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-a301-viewports';
  await client.connect();

  console.log('=== Checking Sheet A301 Details ===');
  const detailsA301 = await client.sendCommand('get_sheet_viewport_details', { sheetId: 690575 });
  console.log('Sheet A301 Details:', JSON.stringify(detailsA301.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
