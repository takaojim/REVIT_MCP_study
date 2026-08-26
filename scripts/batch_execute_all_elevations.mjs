import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-execute-all-elevations';
  await client.connect();

  console.log('=== Step 0: Ensure Standard TABC Dimension Types ===');
  const dimTypesRes = await client.sendCommand('ensure_dimension_types', {});
  const topTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('上右'))?.DimensionTypeId || 689724;
  const leftTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('下右'))?.DimensionTypeId || 689732;

  const elevationViews = [
    { id: 8157, name: '北向立面' },
    { id: 8176, name: '東向立面' },
    { id: 98984, name: '南向立面' },
    { id: 8237, name: '西向立面(正立面)' }
  ];

  console.log(`\n=== Starting Batch Elevation Processing (${elevationViews.length} Views) ===\n`);

  for (const v of elevationViews) {
    console.log(`------------------------------------------------------------`);
    console.log(`Processing [${v.name}] (ID: ${v.id})...`);

    try {
      // 1. 繪製 Step 0 紅線與 Step 5 藍線，並對齊 Grids & Levels 基準線
      const boxRes = await client.sendCommand('draw_elevation_envelope_boxes', {
        viewId: v.id,
        stepModules: 5,
        spacingMm: 650.0,
        cleanExisting: true,
        alignDatum: true
      });

      console.log(`  [Box & Datum Alignment]:`);
      console.log(`    Red Box Envelope: Width = ${boxRes.data?.redBox?.widthMm} mm, Height = ${boxRes.data?.redBox?.heightMm} mm`);
      console.log(`    GL Elevation: ${boxRes.data?.redBox?.vGL} mm, Roof Top: ${boxRes.data?.redBox?.vRoof} mm`);
      console.log(`    Blue Box: Top = ${boxRes.data?.blueBox?.vTop} mm, Bottom = ${boxRes.data?.blueBox?.vBottom} mm`);

      // 2. 建立頂部雙層柱心尺寸標註 (Tier 1 總長 + Tier 2 連續柱間距)
      const topDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
        viewId: v.id,
        typeId: topTypeId,
        offsetTier1Mm: 6.5,
        stepTier2Mm: 6.5
      });
      console.log(`  [Top Grids Dimensions]:`);
      console.log(`    Total Dim: ${topDimRes.data?.TotalValueMm} mm (ID: ${topDimRes.data?.TotalDimensionId})`);
      console.log(`    Continuous Dim: ${topDimRes.data?.SegmentsCount} segments (Grids: ${topDimRes.data?.Grids?.join(', ')})`);

      // 3. 建立左側雙層樓層高程尺寸標註 (Tier 1 總高 + Tier 2 各層層高)
      const leftDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
        viewId: v.id,
        typeId: leftTypeId,
        offsetTier1Mm: 6.5,
        stepTier2Mm: 6.5,
        includeBasement: false
      });
      console.log(`  [Left Levels Dimensions]:`);
      console.log(`    Total Height: ${leftDimRes.data?.TotalValueMm} mm (ID: ${leftDimRes.data?.TotalDimensionId})`);
      console.log(`    Continuous Dim: ${leftDimRes.data?.SegmentsCount} segments (Levels: ${leftDimRes.data?.Levels?.join(', ')})`);

      console.log(`  -> [${v.name}] SUCCESS`);
    } catch (err) {
      console.error(`  -> [${v.name}] ERROR:`, err.message);
    }
  }

  console.log(`\n============================================================`);
  console.log(`All 4 Elevations Processed Successfully!`);
  console.log(`============================================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
