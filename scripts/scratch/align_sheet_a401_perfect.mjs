import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'align-a401-perfect';
  await client.connect();

  console.log('=== Iterative Precision Alignment of Sheet A401 Viewports ===');

  const targets = [
    { viewportId: 650365, name: '剖面 1', targetX: 230, targetY: 440 },
    { viewportId: 650367, name: '剖面 3', targetX: 230, targetY: 160 },
    { viewportId: 650366, name: '剖面 2', targetX: 625, targetY: 440 },
    { viewportId: 694074, name: '剖面 4', targetX: 625, targetY: 160 }
  ];

  for (let iter = 0; iter < 3; iter++) {
    const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
    const vps = details.data?.Viewports || [];

    for (const tgt of targets) {
      const vp = vps.find(v => v.ViewportId === tgt.viewportId);
      if (!vp) continue;

      const deltaX = tgt.targetX - vp.Center.X;
      const deltaY = tgt.targetY - vp.Center.Y;

      if (Math.abs(deltaX) > 1.0 || Math.abs(deltaY) > 1.0) {
        // Move viewport by delta
        // In position_viewports_on_sheet with sheet-top-left:
        // offsetRight increases X, offsetDown decreases Y
        await client.sendCommand('position_viewports_on_sheet', {
          viewportIds: [tgt.viewportId],
          sheetReference: 'sheet-top-left',
          viewAnchor: 'center',
          offsetRightMm: tgt.targetX + (tgt.targetX - vp.Center.X),
          offsetDownMm: (594 - tgt.targetY) - (tgt.targetY - vp.Center.Y)
        });
      }
    }
  }

  // Final check
  const finalDetails = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('\n=== Final Sheet A401 Status ===');
  for (const vp of finalDetails.data?.Viewports || []) {
    console.log(`- ${vp.ViewName} (VP ${vp.ViewportId}): Center X=${vp.Center.X.toFixed(2)}, Y=${vp.Center.Y.toFixed(2)} mm`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
