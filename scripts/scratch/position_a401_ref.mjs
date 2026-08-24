import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'position-a401-viewports-ref';
  await client.connect();

  console.log('=== Positioning Sheet A401 Viewports with sheetReference ===');

  const positions = [
    { viewportId: 650365, position: { x: 230, y: 445 } }, // 剖面 1 (Top Left)
    { viewportId: 650366, position: { x: 625, y: 445 } }, // 剖面 2 (Top Right)
    { viewportId: 650367, position: { x: 230, y: 175 } }, // 剖面 3 (Bottom Left)
    { viewportId: 694074, position: { x: 625, y: 175 } }  // 剖面 4 (Bottom Right)
  ];

  const posRes = await client.sendCommand('position_viewports_on_sheet', {
    sheetId: 650359,
    viewAnchor: 'center',
    sheetReference: 'sheet-bottom-left',
    viewportPositions: positions
  });

  console.log('Positioning result:', JSON.stringify(posRes.data, null, 2));

  // Check readback
  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('\n=== Final Sheet A401 Viewports ===');
  console.log(JSON.stringify(details.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
