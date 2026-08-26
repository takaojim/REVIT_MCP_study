import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-elevation-refactor-master-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【分支全新實作】標準立面階梯標註與外輪廓系統 (North Elevation) ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保 TABC 標準標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 清除該視圖現有舊輔助線與標註
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清理視圖舊標註與輔助線`);

  // 3. 實體 2D 外輪廓 (Step 0 紅線基準):
  // 左側實體外牆面: X = 826.8 mm  -> 投影 u = 6498.1 mm
  // 右側實體外牆面: X = 16026.8 mm -> 投影 u = -8701.9 mm
  // 底層 GL 地盤面: Z = 0.0 mm     -> 投影 v = 0.0 mm
  // 頂層最高實體面: Z = 18550.0 mm  -> 投影 v = 18550.0 mm (TRFL頂)

  const uLeftRed = 6498.1;
  const uRightRed = -8701.9;
  const vBottomRed = 0.0;
  const vTopRed = 18550.0;

  // 5 個間距藍線 (Step 5 齊頭線: 退縮 3,250 mm):
  const step5 = 3250.0;
  const uLeftBlue = uLeftRed + step5;     // 9748.1 mm (貼齊左側樓層標示圈)
  const uRightBlue = uRightRed - step5;   // -11951.9 mm
  const vBottomBlue = vBottomRed - step5; // -3250.0 mm
  const vTopBlue = vTopRed + step5;       // 21800.0 mm (貼齊頂部軸號氣泡圓圈)

  console.log(`📌 Step 0 實體外輪廓基準 (紅線):`);
  console.log(`   左側外牆: u = ${uLeftRed}, 右側外牆: u = ${uRightRed}`);
  console.log(`   底層 GL: v = ${vBottomRed}, 頂層 TRFL: v = ${vTopRed}`);
  console.log(`📌 Step 5 藍線齊頭外框 (各退縮 5 個間距 3,250mm):`);
  console.log(`   左側齊頭線: u = ${uLeftBlue}, 頂部齊頭線: v = ${vTopBlue}\n`);

  const guideLines = [
    // 🔴 紅線 (Step 0 實體外輪廓)
    { startX: uLeftRed + 1000, startY: vBottomRed, endX: uRightRed - 1000, endY: vBottomRed, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-GL地盤線' },
    { startX: uLeftRed + 1000, startY: vTopRed, endX: uRightRed - 1000, endY: vTopRed, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-TRFL屋突頂面' },
    { startX: uLeftRed, startY: vBottomRed - 1000, endX: uLeftRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-左側外牆實體外皮' },
    { startX: uRightRed, startY: vBottomRed - 1000, endX: uRightRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-右側外牆實體外皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線' },
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線' },
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界' },
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: guideLines
  });
  console.log(`✓ 4 條基準紅線 (Step 0) 與 4 條齊頭藍線 (Step 5) 繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 4. 頂部柱心雙層標註 (鎖定於 Step 4 總跨 與 Step 3 連續柱心)
  console.log('\n--- 建立頂部雙層柱心標註 (D~A 軸) ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註完成:`);
  console.log(`    - Tier 1 總跨 ID: ${gridDimRes.data?.TotalDimensionId} (總長: ${gridDimRes.data?.TotalValueMm} mm)`);
  console.log(`    - Tier 2 連續 ID: ${gridDimRes.data?.ContinuousDimensionId} (包含 ${gridDimRes.data?.SegmentsCount} 個分段: ${gridDimRes.data?.Grids?.join(' - ')})`);

  // 5. 側邊樓層線高程雙層標註 (GL~TRFL，鎖定於 Step 4 總高 與 Step 3 連續層高)
  console.log('\n--- 建立側邊雙層樓層高程標註 (GL~TRFL) ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註完成:`);
  console.log(`    - Tier 1 總建高 ID: ${levelDimRes.data?.TotalDimensionId} (總高: ${levelDimRes.data?.TotalValueMm} mm)`);
  console.log(`    - Tier 2 連續層高 ID: ${levelDimRes.data?.ContinuousDimensionId} (包含 ${levelDimRes.data?.SegmentsCount} 個分段: ${levelDimRes.data?.Levels?.join(' - ')})`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】分支全新實作全流程執行完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
