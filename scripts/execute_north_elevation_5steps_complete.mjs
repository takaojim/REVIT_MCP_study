import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-elevation-complete-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】紅線 (Step 0) ＋ 藍線 (Step 5) ＋ 雙向標準標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 清除該視圖舊有尺寸與詳圖線
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除視圖內舊有標註與輔助線`);

  // 3. 繪製 4 條紅線 (Step 0) 與 4 條藍線 (Step 5)
  // 水平範圍: A 軸 (0 mm) ~ D 軸 (15,900 mm)
  // 高程範圍: GL (0 mm) ~ TRFL (18,550 mm)
  const stepMm = 650.0;
  const step5Mm = stepMm * 5.0; // 3,250 mm

  const leftX = 0.0;
  const rightX = 15900.0;
  const bottomZ = 0.0;      // GL
  const topZ = 18550.0;     // TRFL

  const blueLeftX = leftX - step5Mm;   // -3,250 mm
  const blueRightX = rightX + step5Mm; // +19,150 mm
  const blueBottomZ = bottomZ - step5Mm; // -3,250 mm
  const blueTopZ = topZ + step5Mm;     // +21,800 mm

  const linesToDraw = [
    // 🔴 紅線 (Step 0: 實體外輪廓基準線)
    { startX: leftX - 1000, startY: bottomZ, endX: rightX + 1000, endY: bottomZ, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-GL底面' },
    { startX: leftX - 1000, startY: topZ, endX: rightX + 1000, endY: topZ, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-TRFL頂面' },
    { startX: leftX, startY: bottomZ - 1000, endX: leftX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-A軸左外皮' },
    { startX: rightX, startY: bottomZ - 1000, endX: rightX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-D軸右外皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: blueLeftX - 1500, startY: blueTopZ, endX: blueRightX + 1500, endY: blueTopZ, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-頂部氣泡齊頭' },
    { startX: blueLeftX, startY: blueBottomZ - 1500, endX: blueLeftX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-左側樓層齊頭' },
    { startX: blueLeftX - 1500, startY: blueBottomZ, endX: blueRightX + 1500, endY: blueBottomZ, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-底部邊界' },
    { startX: blueRightX, startY: blueBottomZ - 1500, endX: blueRightX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });
  console.log(`✓ 4 條紅線 (Step 0) 與 4 條藍線 (Step 5, 5個間距) 繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 4. 頂部柱心雙層標註 (Step 4 總跨, Step 3 連續)
  console.log('\n--- 建立頂部柱心雙層標註 ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註建立完成: 總跨 ID ${gridDimRes.data?.TotalDimensionId}, 連續 ID ${gridDimRes.data?.ContinuousDimensionId}`);

  // 5. 側邊樓層線高程雙層標註 (Step 4 總高, Step 3 連續層高)
  console.log('\n--- 建立側邊樓層高程雙層標註 ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 側邊樓層高程標註建立完成: 總建高 ID ${levelDimRes.data?.TotalDimensionId}, 連續層高 ID ${levelDimRes.data?.ContinuousDimensionId}`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】紅線、藍線與 5 間距標準標註全數繪製完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
