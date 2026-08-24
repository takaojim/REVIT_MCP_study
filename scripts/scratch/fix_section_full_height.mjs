import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'fix-section-full-height';
  await client.connect();

  console.log('=== Step 1: Setting Section Views to Full Building Extents ===');

  const sections = [
    { id: 590271, name: '剖面 1' },
    { id: 624109, name: '剖面 2' },
    { id: 624490, name: '剖面 3' },
    { id: 693638, name: '剖面 4' }
  ];

  for (const s of sections) {
    console.log(`\nAdjusting ${s.name} (${s.id})...`);
    // Align to Floor 624156 with 13000mm padding to cover all levels
    await client.sendCommand('align_view_cropbox_to_element', {
      viewId: s.id,
      elementId: 624156,
      padding_mm: 12500
    });
    // Shift vertically slightly to ensure roof and ground floor are perfectly centered
    await client.sendCommand('shift_view_cropbox', {
      viewId: s.id,
      dx_mm: 0,
      dy_mm: 1000
    });
  }

  // Check readback on all 4 section views
  console.log('\n=== Section Views CropBox Readback ===');
  for (const s of sections) {
    const cropRes = await client.sendCommand('shift_view_cropbox', { viewId: s.id, dx_mm: 0, dy_mm: 0 });
    const min = cropRes.data?.NewCropBox_mm?.Min;
    const max = cropRes.data?.NewCropBox_mm?.Max;
    const w = (max.x - min.x) / 1000;
    const h = (max.y - min.y) / 1000;
    console.log(`- ${s.name} (${s.id}): 寬度 ${w.toFixed(2)} m × 高度 ${h.toFixed(2)} m (X: [${(min.x/1000).toFixed(2)}m, ${(max.x/1000).toFixed(2)}m], Y: [${(min.y/1000).toFixed(2)}m, ${(max.y/1000).toFixed(2)}m])`);
  }

  // Align Viewports on Sheet A401 (650359)
  console.log('\n=== Step 2: Arranging Sheet A401 Viewports in 2x2 Grid ===');
  // 剖面 1 (Top Left): X=220, Y=430
  // 剖面 2 (Top Right): X=620, Y=430
  // 剖面 3 (Bottom Left): X=220, Y=160
  // 剖面 4 (Bottom Right): X=620, Y=160
  const layout = [
    { viewportId: 650365, x_mm: 220, y_mm: 430 },
    { viewportId: 650366, x_mm: 620, y_mm: 430 },
    { viewportId: 650367, x_mm: 220, y_mm: 160 },
    { viewportId: 694074, x_mm: 620, y_mm: 160 }
  ];

  for (const item of layout) {
    try {
      await client.sendCommand('position_viewports_on_sheet', {
        sheetId: 650359,
        viewportPositions: [{ viewportId: item.viewportId, position: { x: item.x_mm, y: item.y_mm } }]
      });
    } catch (e) {
      console.log(`Positioning VP ${item.viewportId}:`, e.message);
    }
  }

  // Final check Sheet A401
  const a401Details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('\n=== Final Sheet A401 Status ===');
  console.log(JSON.stringify(a401Details.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
