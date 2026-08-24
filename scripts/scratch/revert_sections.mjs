import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'revert-sections-state';
  await client.connect();

  console.log('=== Step 1: Restoring Original CropBoxes for Section Views ===');

  // Let's restore CropBoxes by shift / align
  // 剖面 1: Min: (-12559, -1829), Max: (17713, 22504) -> Width 30272mm, Height 24333mm
  // 剖面 2: Min: (-22651, -9469), Max: (11688, 16205) -> Width 34339mm, Height 25674mm
  // 剖面 3: Min: (-15167, -9469), Max: (11688, 17051) -> Width 26855mm, Height 26520mm
  // 剖面 4: Min: (-13538, -11469), Max: (13538, 11469) -> Width 27077mm, Height 22938mm

  const originalStates = [
    { id: 590271, name: '剖面 1', padding: 12500, dy: -1000 },
    { id: 624109, name: '剖面 2', padding: 12500, dy: -1000 },
    { id: 624490, name: '剖面 3', padding: 12500, dy: -1000 },
    { id: 693638, name: '剖面 4', padding: 12500, dy: -1000 }
  ];

  // Restoring Viewport Centers on Sheet A401 (650359)
  console.log('\n=== Step 2: Restoring Viewport Positions on Sheet A401 ===');
  // 剖面 1: Center (197.01, 466.19)
  // 剖面 2: Center (584.69, 468.06)
  // 剖面 3: Center (218.96, 202.61)

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650365],
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 197.01,
    offsetDownMm: 594 - 466.19
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650366],
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 584.69,
    offsetDownMm: 594 - 468.06
  });

  await client.sendCommand('position_viewports_on_sheet', {
    viewportIds: [650367],
    sheetReference: 'sheet-top-left',
    viewAnchor: 'center',
    offsetRightMm: 218.96,
    offsetDownMm: 594 - 202.61
  });

  // Check if VP 694074 exists and move off or handle
  const a401Details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('Sheet A401 Status:', JSON.stringify(a401Details.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
