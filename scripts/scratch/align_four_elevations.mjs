import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'align-four-elevations';
  await client.connect();

  console.log('=== Aligning CropBoxes for Four Elevations ===');

  // 1. Align South (98984) to Floor 624156 with padding 12000mm, then shift Y to match height
  console.log('\n1. Adjusting South (98984)...');
  await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 98984,
    elementId: 624156,
    padding_mm: 11000
  });

  // 2. Align East (8176) to Floor 624156 with padding 11000mm
  console.log('\n2. Adjusting East (8176)...');
  await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 8176,
    elementId: 624156,
    padding_mm: 11000
  });

  // Check readback on all 4 elevations
  console.log('\n=== CropBox Readback on All 4 Elevations ===');
  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西', id: 8237 }
  ];

  for (const e of elevs) {
    const shiftRes = await client.sendCommand('shift_view_cropbox', { viewId: e.id, dx_mm: 0, dy_mm: 0 });
    const min = shiftRes.data?.NewCropBox_mm?.Min;
    const max = shiftRes.data?.NewCropBox_mm?.Max;
    const w = (max.x - min.x) / 1000;
    const h = (max.y - min.y) / 1000;
    console.log(`View ${e.name} (${e.id}): Width = ${w.toFixed(2)} m, Height = ${h.toFixed(2)} m (Y: [${(min.y/1000).toFixed(2)}m, ${(max.y/1000).toFixed(2)}m])`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
