import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-elevation-crop-and-sheet';
  await client.connect();

  console.log('=== Step 1: Testing set_view_cropbox and add_views_to_sheet on Running Session ===');

  try {
    const res = await client.sendCommand('set_view_cropbox', {
      viewId: 8157, // 北
      active: true,
      visible: true
    });
    console.log('set_view_cropbox response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('set_view_cropbox error:', err.message);
  }

  try {
    const res = await client.sendCommand('add_views_to_sheet', {
      sheetId: 690575, // A301
      viewIds: [8176, 98984, 8237] // 東, 南, 西
    });
    console.log('add_views_to_sheet response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('add_views_to_sheet error:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
