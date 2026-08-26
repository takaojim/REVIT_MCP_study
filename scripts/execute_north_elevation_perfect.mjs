import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-elevation-perfect-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】精確實體外皮紅線 (Step 0) ＋ 5 間距藍線 ＋ 標準標註 ===');
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

  // 3. 精確實體外皮邊界座標 (Step 0 紅線):
  // 實體左外牆皮: X = 776.8 mm (D 軸外側)
  // 實體右外牆皮: X = 16026.8 mm (A 軸外側，OK 處)
  // 實體底層 GL: Z = 0.0 mm
  // 實體頂層 TRFL: Z = 18550.0 mm
  const envLeftX = 776.8;
  const envRightX = 16026.8;
  const envBottomZ = 0.0;
  const envTopZ = 18550.0;

  // 5 個間距齊頭基準 (Step 5 藍線, 5 * 650 = 3,250 mm):
  const step5Mm = 3250.0;
  const blueLeftX = envLeftX - step5Mm;     // -2,473.2 mm
  const blueRightX = envRightX + step5Mm;   // 19,276.8 mm
  const blueBottomZ = envBottomZ - step5Mm; // -3,250.0 mm
  const blueTopZ = envTopZ + step5Mm;       // 21,800.0 mm

  console.log(`📌 實體外輪廓基準 (Step 0 紅線):`);
  console.log(`   左側外皮: ${envLeftX.toFixed(1)} mm, 右側外皮: ${envRightX.toFixed(1)} mm`);
  console.log(`   底層 GL: ${envBottomZ.toFixed(1)} mm, 頂層 TRFL: ${envTopZ.toFixed(1)} mm`);
  console.log(`📌 5 間距齊頭基準 (Step 5 藍線):`);
  console.log(`   頂部氣泡齊頭線: ${blueTopZ.toFixed(1)} mm, 左側樓層齊頭線: ${blueLeftX.toFixed(1)} mm\n`);

  const linesToDraw = [
    // 🔴 紅線 (Step 0: 精確實體外輪廓包絡線)
    { startX: envLeftX - 1000, startY: envBottomZ, endX: envRightX + 1000, endY: envBottomZ, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-GL底面' },
    { startX: envLeftX - 1000, startY: envTopZ, endX: envRightX + 1000, endY: envTopZ, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-TRFL頂面' },
    { startX: envLeftX, startY: envBottomZ - 1000, endX: envLeftX, endY: envTopZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-左側實體外牆皮' },
    { startX: envRightX, startY: envBottomZ - 1000, endX: envRightX, endY: envTopZ + 1000, color: { r: 255, g: 0, b: 0 }, label: '北立面-紅線-右側實體外牆皮(OK)' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: blueLeftX - 1500, startY: blueTopZ, endX: blueRightX + 1500, endY: blueTopZ, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-頂部氣泡齊頭線' },
    { startX: blueLeftX, startY: blueBottomZ - 1500, endX: blueLeftX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-左側樓層齊頭線' },
    { startX: blueLeftX - 1500, startY: blueBottomZ, endX: blueRightX + 1500, endY: blueBottomZ, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-底部邊界' },
    { startX: blueRightX, startY: blueBottomZ - 1500, endX: blueRightX, endY: blueTopZ + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });
  console.log(`✓ 4 條實體外皮紅線 (Step 0) 與 4 條藍線 (Step 5) 繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 4. 頂部柱心雙層標註 (Step 4 總跨, Step 3 連續)
  console.log('\n--- 建立頂部雙層柱心標註 ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註完成: 總跨 ID ${gridDimRes.data?.TotalDimensionId}, 連續 ID ${gridDimRes.data?.ContinuousDimensionId}`);

  // 5. 側邊樓層線高程雙層標註 (Step 4 總建高, Step 3 連續層高 - 以 GL 為底)
  console.log('\n--- 建立側邊雙層樓層高程標註 ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註完成: 總建高 ID ${levelDimRes.data?.TotalDimensionId}, 連續層高 ID ${levelDimRes.data?.ContinuousDimensionId}`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】實體外皮紅線、5 間距藍線與雙向標註更新完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
