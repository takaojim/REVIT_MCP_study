import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'position-a401-clean';
  await client.connect();

  console.log('=== Positioning Viewports on Sheet A401 ===');

  // Sheet is 841 x 594 (A1)
  // Let's position 剖面 1 & 剖面 3 at X=230mm from left
  // 剖面 1 (Top Left): from sheet-bottom-left, offsetRight=230, offsetDown=-440
  // 剖面 3 (Bottom Left): from sheet-bottom-left, offsetRight=230, offsetDown=-175
  // 剖面 2 (Top Right): from sheet-bottom-left, offsetRight=625, offsetDown=-440
  // 剖面 4 (Bottom Right): from sheet-bottom-left, offsetRight=625, offsetDown=-175

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650365], // 剖面 1
    sheetReference: 'sheet-bottom-left',
    viewAnchor: 'center',
    offsetRightMm: 230,
    offsetDownMm: -440
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650367], // 剖面 3
    sheetReference: 'sheet-bottom-left',
    viewAnchor: 'center',
    offsetRightMm: 230,
    offsetDownMm: -175
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650366], // 剖面 2
    sheetReference: 'sheet-bottom-left',
    viewAnchor: 'center',
    offsetRightMm: 625,
    offsetDownMm: -440
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [694074], // 剖面 4
    sheetReference: 'sheet-bottom-left',
    viewAnchor: 'center',
    offsetRightMm: 625,
    offsetDownMm: -175
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
