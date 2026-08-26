import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-execute-all-sections';
  await client.connect();

  console.log('=== Step 0: Ensure Standard TABC Dimension Types ===');
  const dimTypesRes = await client.sendCommand('ensure_dimension_types', {}, 120000);
  const topTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('上右'))?.DimensionTypeId || 2240793;
  const leftTypeId = dimTypesRes.data?.DimensionTypes?.find(d => d.DimensionTypeName.includes('下右'))?.DimensionTypeId || 2240801;

  console.log(`Top Dimension Type ID: ${topTypeId}`);
  console.log(`Left Dimension Type ID: ${leftTypeId}`);

  console.log('\n=== Step 1: Discover All Section Views ===');
  const allViewsRes = await client.sendCommand('get_all_views', {}, 120000);
  const allViews = allViewsRes.data?.Views || allViewsRes.data || [];
  const sectionViews = allViews.filter(v => v.ViewType === 'Section' || (v.Name && v.Name.includes('剖面')) || (v.Type && v.Type.includes('剖面')));

  console.log(`Found ${sectionViews.length} Section Views:`);
  sectionViews.forEach(v => console.log(`  - [${v.Name}] (ID: ${v.ElementId || v.Id}, Scale: 1:${v.Scale})`));

  console.log(`\n=== Starting Batch Section Processing ===\n`);

  for (const v of sectionViews) {
    const viewId = v.ElementId || v.Id;
    const viewName = v.Name;
    const scale = v.Scale || 50;
    const spacingMm = scale * 6.5; // 圖紙 6.5mm 對應之模型空間 mm (1:50 -> 325mm, 1:60 -> 390mm, 1:100 -> 650mm)

    console.log(`------------------------------------------------------------`);
    console.log(`Processing [${viewName}] (ID: ${viewId}, Scale: 1:${scale}, Spacing: ${spacingMm}mm)...`);

    try {
      // 1. 繪製 Step 0 紅線與 Step 5/8 藍線，並對齊 Grids & Levels 基準線 (timeout 120s)
      const boxRes = await client.sendCommand('draw_elevation_envelope_boxes', {
        viewId: viewId,
        stepModules: 5, // 頂/右/底: 5, 左側自動套用 N+3 = 8
        spacingMm: spacingMm,
        cleanExisting: true,
        alignDatum: true
      }, 120000);

      console.log(`  [Box & Datum Alignment]:`);
      console.log(`    Red Box Envelope: Width = ${boxRes.data?.redBox?.widthMm} mm, Height = ${boxRes.data?.redBox?.heightMm} mm`);
      console.log(`    Bottom Elevation: ${boxRes.data?.redBox?.vGL} mm, Roof Top: ${boxRes.data?.redBox?.vRoof} mm`);
      console.log(`    Blue Box: Top = ${boxRes.data?.blueBox?.vTop} mm, Bottom = ${boxRes.data?.blueBox?.vBottom} mm`);

      // 2. 建立頂部雙層柱心尺寸標註 (Tier 1 總長 + Tier 2 連續柱間距)
      try {
        const topDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
          viewId: viewId,
          typeId: topTypeId,
          offsetTier1Mm: 6.5,
          stepTier2Mm: 6.5
        }, 120000);
        console.log(`  [Top Grids Dimensions]:`);
        console.log(`    Total Dim: ${topDimRes.data?.TotalValueMm} mm (ID: ${topDimRes.data?.TotalDimensionId})`);
        console.log(`    Continuous Dim: ${topDimRes.data?.SegmentsCount} segments (Grids: ${topDimRes.data?.Grids?.join(', ')})`);
      } catch (gridErr) {
        console.warn(`  [Top Grids Dim]: Skipped or partial - ${gridErr.message}`);
      }

      // 3. 建立左側雙層樓層高程尺寸標註 (Tier 1 總高 + Tier 2 各層層高，含地下層/筏基)
      try {
        const leftDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
          viewId: viewId,
          typeId: leftTypeId,
          offsetTier1Mm: 26.0, // 4 個模矩 (26.0mm)，由 Step 8 藍線退縮至 Step 4 放樣
          stepTier2Mm: 6.5,    // 1 個模矩 (6.5mm)，落於 Step 3 放樣
          includeBasement: true
        }, 120000);
        console.log(`  [Left Levels Dimensions]:`);
        console.log(`    Total Height: ${leftDimRes.data?.TotalValueMm} mm (ID: ${leftDimRes.data?.TotalDimensionId})`);
        console.log(`    Continuous Dim: ${leftDimRes.data?.SegmentsCount} segments (Levels: ${leftDimRes.data?.Levels?.join(', ')})`);
      } catch (levelErr) {
        console.warn(`  [Left Levels Dim]: Skipped or partial - ${levelErr.message}`);
      }

      console.log(`  -> [${viewName}] SUCCESS`);
    } catch (err) {
      console.error(`  -> [${viewName}] ERROR:`, err.message);
    }
  }

  console.log(`\n============================================================`);
  console.log(`All ${sectionViews.length} Sections Processed!`);
  console.log(`============================================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
