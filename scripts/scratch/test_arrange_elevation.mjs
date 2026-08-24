import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-arrange-elevation';
  await client.connect();

  console.log('Testing arrange_viewports_on_sheet with elevation views:');
  try {
    const res = await client.sendCommand('arrange_viewports_on_sheet', {
      sheetId: 690575,
      viewNames: ['東', '南', '西向立面(正立面)']
    });
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.log('Error from server:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
