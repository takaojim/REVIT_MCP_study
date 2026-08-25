import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-section-1-3';
  await client.connect();

  console.log('=== Inspecting Section 1 & Section 3 Details ===');

  const s1Crop = await client.sendCommand('shift_view_cropbox', { viewId: 590271, dx_mm: 0, dy_mm: 0 });
  console.log('剖面 1 CropBox (mm):', JSON.stringify(s1Crop.data?.NewCropBox_mm, null, 2));

  const s3Crop = await client.sendCommand('shift_view_cropbox', { viewId: 624490, dx_mm: 0, dy_mm: 0 });
  console.log('剖面 3 CropBox (mm):', JSON.stringify(s3Crop.data?.NewCropBox_mm, null, 2));

  const s2Crop = await client.sendCommand('shift_view_cropbox', { viewId: 624109, dx_mm: 0, dy_mm: 0 });
  console.log('剖面 2 CropBox (mm):', JSON.stringify(s2Crop.data?.NewCropBox_mm, null, 2));

  const s4Crop = await client.sendCommand('shift_view_cropbox', { viewId: 693638, dx_mm: 0, dy_mm: 0 });
  console.log('剖面 4 CropBox (mm):', JSON.stringify(s4Crop.data?.NewCropBox_mm, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
