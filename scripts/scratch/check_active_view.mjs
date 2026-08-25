import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-active-view';
  await client.connect();

  const activeView = await client.sendCommand('get_active_view', {});
  console.log('Active View:', JSON.stringify(activeView.data, null, 2));

  // Also query all grids and levels with get_element_info
  const grids = await client.sendCommand('get_all_grids', {});
  console.log('All Grids count:', grids.data?.Grids?.length || grids.data?.length);

  // Check dimensions currently in each elevation view
  const views = [8157, 8176, 98984, 8237];
  for (const vId of views) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: vId });
    console.log(`\nView ${vId} ("${vInfo.data?.Name}"):`);
    const cropBox = await client.sendCommand('shift_view_cropbox', { viewId: vId, dx_mm: 0, dy_mm: 0 });
    console.log('  CropBox:', JSON.stringify(cropBox.data?.NewCropBox_mm));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
