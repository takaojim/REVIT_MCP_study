import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-sheet-a301';
  await client.connect();

  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 690575 });
  console.log('Sheet A301 Viewports:', JSON.stringify(details.data, null, 2));

  // If more viewports exist, let's position them in 2x2 grid
  const vps = details.data?.Viewports || [];
  console.log(`Current Viewport Count on A301: ${vps.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
