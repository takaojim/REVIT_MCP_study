import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'calc-elevation-crops';
  await client.connect();

  console.log('=== Analyzing Elevation Crop Dimensions ===');

  // North (8157) current CropBox
  const northCrop = await client.sendCommand('shift_view_cropbox', { viewId: 8157, dx_mm: 0, dy_mm: 0 });
  console.log('North CropBox (mm):', JSON.stringify(northCrop.data?.NewCropBox_mm, null, 2));

  // West (8237) current CropBox
  const westCrop = await client.sendCommand('shift_view_cropbox', { viewId: 8237, dx_mm: 0, dy_mm: 0 });
  console.log('West CropBox (mm):', JSON.stringify(westCrop.data?.NewCropBox_mm, null, 2));

  // East (8176) current CropBox
  const eastCrop = await client.sendCommand('shift_view_cropbox', { viewId: 8176, dx_mm: 0, dy_mm: 0 });
  console.log('East CropBox (mm):', JSON.stringify(eastCrop.data?.NewCropBox_mm, null, 2));

  // South (98984) current CropBox
  const southCrop = await client.sendCommand('shift_view_cropbox', { viewId: 98984, dx_mm: 0, dy_mm: 0 });
  console.log('South CropBox (mm):', JSON.stringify(southCrop.data?.NewCropBox_mm, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
