import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'position-a401-direct';
  await client.connect();

  console.log('=== Step: Setting Direct Viewport Box Center on Sheet A401 ===');

  // Let's use position_viewports_on_sheet with dryRun=false or test delta
  // We want:
  // VP 650365 (剖面 1): Center X = 230, Y = 435
  // VP 650366 (剖面 2): Center X = 625, Y = 435
  // VP 650367 (剖面 3): Center X = 230, Y = 165
  // VP 694074 (剖面 4): Center X = 625, Y = 165

  // To move VP 650367 from current Center X=33.21, Y=191.33 to target X=230, Y=165:
  // Delta X = +196.79, Delta Y = -26.33

  const currentDetails = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('Current Viewports:', currentDetails.data?.Viewports?.map(v => `${v.ViewName}: (${v.Center.X}, ${v.Center.Y})`));

  const targets = {
    650365: { targetX: 230, targetY: 435 }, // 剖面 1
    650366: { targetX: 625, targetY: 435 }, // 剖面 2
    650367: { targetX: 230, targetY: 165 }, // 剖面 3
    694074: { targetX: 625, targetY: 165 }  // 剖面 4
  };

  for (const vp of currentDetails.data?.Viewports || []) {
    const tgt = targets[vp.ViewportId];
    if (!tgt) continue;
    const deltaX = tgt.targetX - vp.Center.X;
    const deltaY = tgt.targetY - vp.Center.Y;
    console.log(`Moving VP ${vp.ViewportId} (${vp.ViewName}) by Delta: dx=${deltaX.toFixed(2)}, dy=${deltaY.toFixed(2)} mm`);

    // In position_viewports_on_sheet, if we pass sheetReference='sheet-bottom-left', viewAnchor='center',
    // offsetRightMm = targetX, offsetDownMm = -targetY
    // Let's test calling position_viewports_on_sheet with dryRun=false
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
