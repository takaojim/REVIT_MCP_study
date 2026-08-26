import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-elevation-steps';
  await client.connect();

  console.log('=== Step 0: Ensure Standard TABC Dimension Types ===');
  const dimTypesRes = await client.sendCommand('ensure_dimension_types', {});
  const topTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('上右'))?.DimensionTypeId || 689724;
  const leftTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('下右'))?.DimensionTypeId || 689732;

  console.log('\n=== Step 1: Draw Step 0 Red Box (Envelope) & Step 5 Blue Box (Offset 5 Modules) ===');
  const activeViewRes = await client.sendCommand('get_active_view', {});
  const viewId = activeViewRes.data?.ElementId || 8157;
  console.log(`Active View: ${activeViewRes.data?.Name} (ID: ${viewId})`);

  const boxRes = await client.sendCommand('draw_elevation_envelope_boxes', {
    viewId: viewId,
    stepModules: 5,
    spacingMm: 650.0,
    groundElevationMm: -150.0
  });

  console.log('Box Calculation & Drawing Result:', JSON.stringify(boxRes.data, null, 2));

  console.log('\n=== Step 2: Auto Dimension Grids (Top) and Levels (Left) ===');

  // 1. 頂部雙層柱心尺寸標註 (Tier 1 總長 + Tier 2 連續柱間距)
  try {
    const topDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
      viewId: viewId,
      typeId: topTypeId,
      offsetTier1Mm: 6.5, // 圖紙 6.5mm = 650mm
      stepTier2Mm: 6.5    // 圖紙 6.5mm = 650mm
    });
    console.log('Top Grids Dimensions Created:');
    console.log('  Total Dim ID:', topDimRes.data?.TotalDimensionId, 'Value:', topDimRes.data?.TotalValueMm, 'mm');
    console.log('  Continuous Dim ID:', topDimRes.data?.ContinuousDimensionId, 'Segments:', topDimRes.data?.SegmentsCount);
    console.log('  Grids:', topDimRes.data?.Grids?.join(', '));
  } catch (err) {
    console.error('Top Grids Dim Error:', err.message);
  }

  // 2. 左側雙層樓層高程尺寸標註 (Tier 1 總高 + Tier 2 各樓層層高)
  try {
    const leftDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
      viewId: viewId,
      typeId: leftTypeId,
      offsetTier1Mm: 6.5, // 圖紙 6.5mm = 650mm
      stepTier2Mm: 6.5,   // 圖紙 6.5mm = 650mm
      includeBasement: false
    });
    console.log('\nLeft Levels Dimensions Created:');
    console.log('  Total Height Dim ID:', leftDimRes.data?.TotalDimensionId, 'Value:', leftDimRes.data?.TotalValueMm, 'mm');
    console.log('  Continuous Levels Dim ID:', leftDimRes.data?.ContinuousDimensionId, 'Segments:', leftDimRes.data?.SegmentsCount);
    console.log('  Levels:', leftDimRes.data?.Levels?.join(', '));
  } catch (err) {
    console.error('Left Levels Dim Error:', err.message);
  }

  console.log('\n=== Execution Completed ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
