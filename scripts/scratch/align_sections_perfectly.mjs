import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'align-sections-perfectly';
  await client.connect();

  console.log('=== Step 1: Aligning Section Views CropBoxes to Building Elements ===');

  // Let's align 剖面 1 (590271) and 剖面 3 (624490) to Floor 624156 or similar
  const s1Res = await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 590271, // 剖面 1
    elementId: 624156,
    padding_mm: 2000
  });
  console.log('剖面 1 CropBox aligned:', JSON.stringify(s1Res.data?.NewCropBox_mm, null, 2));

  const s3Res = await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 624490, // 剖面 3
    elementId: 624156,
    padding_mm: 2000
  });
  console.log('剖面 3 CropBox aligned:', JSON.stringify(s3Res.data?.NewCropBox_mm, null, 2));

  const s2Res = await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 624109, // 剖面 2
    elementId: 624156,
    padding_mm: 2000
  });
  console.log('剖面 2 CropBox aligned:', JSON.stringify(s2Res.data?.NewCropBox_mm, null, 2));

  const s4Res = await client.sendCommand('align_view_cropbox_to_element', {
    viewId: 693638, // 剖面 4
    elementId: 624156,
    padding_mm: 2000
  });
  console.log('剖面 4 CropBox aligned:', JSON.stringify(s4Res.data?.NewCropBox_mm, null, 2));

  // Now call adjust_section_datums
  console.log('\n=== Step 2: Calling adjust_section_datums ===');
  const adjRes = await client.sendCommand('adjust_section_datums', {
    viewIds: [590271, 624109, 624490, 693638]
  });
  console.log('adjust_section_datums Result:', JSON.stringify(adjRes.data, null, 2));

  // Check Sheet A401 viewports
  console.log('\n=== Step 3: Sheet A401 Viewport Outlines ===');
  const a401 = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('Sheet A401:', JSON.stringify(a401.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
