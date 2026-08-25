import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'fine-tune-crops';
  await client.connect();

  // Fine-tune South (98984)
  await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 98984,
    elementId: 624156,
    padding_mm: 12500
  });
  await client.sendCommand('shift_view_cropbox', {
    viewId: 98984,
    dx_mm: 0,
    dy_mm: 1500
  });

  // Fine-tune East (8176)
  await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 8176,
    elementId: 624156,
    padding_mm: 12500
  });
  await client.sendCommand('shift_view_cropbox', {
    viewId: 8176,
    dx_mm: 0,
    dy_mm: 1500
  });

  // Read back all 4
  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西', id: 8237 }
  ];

  console.log('\n=== Final Elevation CropBox Summary ===');
  for (const e of elevs) {
    const shiftRes = await client.sendCommand('shift_view_cropbox', { viewId: e.id, dx_mm: 0, dy_mm: 0 });
    const min = shiftRes.data?.NewCropBox_mm?.Min;
    const max = shiftRes.data?.NewCropBox_mm?.Max;
    const w = (max.x - min.x) / 1000;
    const h = (max.y - min.y) / 1000;
    console.log(`- ${e.name}向立面 (ID: ${e.id}): 寬度 ${w.toFixed(2)} m × 高度 ${h.toFixed(2)} m (X: [${(min.x/1000).toFixed(2)}m, ${(max.x/1000).toFixed(2)}m], Y: [${(min.y/1000).toFixed(2)}m, ${(max.y/1000).toFixed(2)}m])`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
