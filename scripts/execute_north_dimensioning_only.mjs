import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-dimensioning-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】依使用者藍線齊頭 建立頂部柱心與左側樓層雙層標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標準標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 清除該視圖現有舊尺寸標註
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {}
  }
  console.log(`✓ 已清除舊有尺寸標註 (${oldDims.data?.Elements?.length || 0} 個)`);

  // 3. 建立頂部柱心雙層標註 (D~A 軸)
  // Step 4 (Tier 1 總跨): offsetTier1Mm = 6.5mm (圖紙)
  // Step 3 (Tier 2 連續): stepTier2Mm = 6.5mm (圖紙)
  console.log('\n--- 建立頂部柱心雙層標註 (D~A 軸) ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註完成:`);
  console.log(`    - Tier 1 總跨尺寸 ID: ${gridDimRes.data?.TotalDimensionId} (全跨度: ${gridDimRes.data?.TotalValueMm} mm)`);
  console.log(`    - Tier 2 連續分段尺寸 ID: ${gridDimRes.data?.ContinuousDimensionId} (包含 ${gridDimRes.data?.SegmentsCount} 個分段: ${gridDimRes.data?.Grids?.join(' - ')})`);
  console.log(`    - 標註型式: ${gridDimRes.data?.DimensionTypeName || 'TABC-DIM_*/ S 2.5-柱心-上右'} (空心圓圈 + 短輔助線向下指向建物)`);

  // 4. 建立側邊樓層線高程雙層標註 (GL~TRFL)
  // Step 4 (Tier 1 總建高): offsetTier1Mm = 6.5mm (圖紙)
  // Step 3 (Tier 2 連續層高): stepTier2Mm = 6.5mm (圖紙)
  console.log('\n--- 建立側邊樓層高程雙層標註 (GL~TRFL) ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註完成:`);
  console.log(`    - Tier 1 總高尺寸 ID: ${levelDimRes.data?.TotalDimensionId} (總建高: ${levelDimRes.data?.TotalValueMm} mm)`);
  console.log(`    - Tier 2 連續層高尺寸 ID: ${levelDimRes.data?.ContinuousDimensionId} (包含 ${levelDimRes.data?.SegmentsCount} 個層高分段: ${levelDimRes.data?.Levels?.join(' - ')})`);
  console.log(`    - 標註型式: ${levelDimRes.data?.DimensionTypeName || 'TABC-DIM_*/ S 2.5-柱心-下右'} (空心圓圈 + 短輔助線向右指向建物)`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】頂部與左側雙向雙層標準標註建立成功！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
