import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'position-a401-top-left';
  await client.connect();

  console.log('=== Positioning Viewports on Sheet A401 using sheet-top-left ===');

  // Sheet is 841 x 594 (A1)
  // Top Left: 剖面 1 -> Right=230, Down=150
  // Bottom Left: 剖面 3 -> Right=230, Down=420
  // Top Right: 剖面 2 -> Right=625, Down=150
  // Bottom Right: 剖面 4 -> Right=625, Down=420

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650365], // 剖面 1
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 230,
    offsetDownMm: 150
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650367], // 剖面 3
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 230,
    offsetDownMm: 420
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650366], // 剖面 2
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 625,
    offsetDownMm: 150
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [694074], // 剖面 4
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 625,
    offsetDownMm: 420
  });

  // Final check
  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('\n=== Final Sheet A401 Viewport Layout ===');
  for (const vp of details.data?.Viewports || []) {
    console.log(`- VP ${vp.ViewportId} (${vp.ViewName}): Center X=${vp.Center.X.toFixed(2)}, Y=${vp.Center.Y.toFixed(2)} mm | Outline: [MinX=${vp.Outline.MinX.toFixed(2)}, MaxX=${vp.Outline.MaxX.toFixed(2)}, MinY=${vp.Outline.MinY.toFixed(2)}, MaxY=${vp.Outline.MaxY.toFixed(2)}]`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
