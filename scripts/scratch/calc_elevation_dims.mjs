import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'manual-elevation-dims';
  await client.connect();

  console.log('=== Calculating Exact Elevation Dimensions for 4 Views ===');

  const elevs = [
    { name: '北', id: 8157, gridIds: [192066, 432966, 432630, 596080] }, // 1, 2, 3, 4
    { name: '南', id: 98984, gridIds: [596080, 432630, 432966, 192066] }, // 4, 3, 2, 1
    { name: '西向立面(正立面)', id: 8237, gridIds: [192192, 432845, 432924, 611573] }, // A, B, C, D
    { name: '東', id: 8176, gridIds: [611573, 432924, 432845, 192192] }  // D, C, B, A
  ];

  // Let's check CropBox of each view to get exact coordinates
  for (const e of elevs) {
    const cropRes = await client.sendCommand('shift_view_cropbox', { viewId: e.id, dx_mm: 0, dy_mm: 0 });
    console.log(`\nView ${e.name} (${e.id}) CropBox:`, JSON.stringify(cropRes.data?.NewCropBox_mm));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
