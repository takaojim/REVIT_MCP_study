import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-elevation-5steps-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】5 個間距 軸線/樓層線齊頭 ＋ 雙向雙層標準標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標註型式 (TABC-空心點 1.5mm 圓圈 + 黑色線條)
  const ensureRes = await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  console.log(`📌 標註型式:`);
  console.log(`   - 頂部柱心: ID ${typeIdUpRight} (TABC-DIM_*/ S 2.5-柱心-上右) [空心圓圈/黑]`);
  console.log(`   - 側邊樓層: ID ${typeIdDownRight} (TABC-DIM_*/ S 2.5-柱心-下右) [空心圓圈/黑]\n`);

  // 2. 清除該視圖舊有尺寸與輔助線
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除視圖內舊有標註與輔助線`);

  // 3. 幾何基準定義 (北向立面):
  // 軸線: A (192192), B (432845), C (432924), D (611573)
  // 水平範圍: A 軸至 D 軸
  // 高程範圍: GL (0 mm) 至 TRFL (18,550 mm)
  const gridIdsCont = [192192, 432845, 432924, 611573]; // A, B, C, D
  const gridIdsTotal = [192192, 611573]; // A, D

  // 樓層線 (GL 以上地上層):
  // GL(390777), 1FL(311), 2FL(694), 3FL(427897), 4FL(597162), RFL(597169), TRFL(597369)
  const levelIdsCont = [390777, 311, 694, 427897, 597162, 597169, 597369]; // GL -> TRFL
  const levelIdsTotal = [390777, 597369]; // GL, TRFL

  // 包絡外框設定:
  // 底層紅線: GL (Z = 0.0 mm)
  // 頂層紅線: TRFL (Z = 18,550.0 mm)
  // 左側紅線: A 軸外側 (X = 0 mm 或 -1,500 mm)
  // 右側紅線: D 軸外側 (X = 26,150 mm 或 27,650 mm)

  const topRoofZ = 18550.0; // TRFL (Step 0)
  const bottomGlZ = 0.0;    // GL (Step 0)

  // 5 間距模矩 (650mm * 5 = 3250mm):
  const topBlueZ = topRoofZ + 3250.0;   // Step 5 頂部藍線 (21,800 mm)
  const topColTier1Z = topRoofZ + 2600.0; // Step 4 柱心總跨 (21,150 mm)
  const topColTier2Z = topRoofZ + 1950.0; // Step 3 柱心連續 (20,500 mm)

  // (A) 頂部柱心雙層標註 (在立面中標註軸線)
  console.log('\n--- 建立頂部柱心雙層標註 ---');
  // 總跨 (Step 4, A -> D)
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: gridIdsTotal,
    startX: 30000.0, startY: topColTier1Z,
    endX: -5000.0, endY: topColTier1Z,
    dimensionTypeId: typeIdUpRight
  });
  if (nTotal.success && nTotal.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: nTotal.data.DimensionId, typeId: typeIdUpRight });
    console.log(`  ✓ [頂部柱心 Step 4 總跨] ID: ${nTotal.data.DimensionId}`);
  } else {
    console.log(`  ⚠️ 總跨建立回傳:`, nTotal);
  }

  // 連續 (Step 3, A -> B -> C -> D)
  const nCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: gridIdsCont,
    startX: 30000.0, startY: topColTier2Z,
    endX: -5000.0, endY: topColTier2Z,
    dimensionTypeId: typeIdUpRight
  });
  if (nCont.success && nCont.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: nCont.data.DimensionId, typeId: typeIdUpRight });
    console.log(`  ✓ [頂部柱心 Step 3 連續] ID: ${nCont.data.DimensionId}`);
  } else {
    console.log(`  ⚠️ 連續建立回傳:`, nCont);
  }

  // (B) 側邊樓層高程雙層標註 (在立面中標註樓層線)
  console.log('\n--- 建立側邊樓層高程雙層標註 ---');
  // 側邊座標 (以 A 軸 X=0 往左退縮 5 個間距)
  const leftColX = 0.0;
  const leftLevelTier1X = leftColX - 2600.0; // Step 4 總建高 (-2,600 mm)
  const leftLevelTier2X = leftColX - 1950.0; // Step 3 連續層高 (-1,950 mm)

  // 總高 (Step 4, GL -> TRFL)
  const lTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    elementIds: levelIdsTotal,
    startX: leftLevelTier1X, startY: topRoofZ + 2000.0,
    endX: leftLevelTier1X, endY: bottomGlZ - 2000.0,
    dimensionTypeId: typeIdDownRight
  });
  if (lTotal.success && lTotal.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: lTotal.data.DimensionId, typeId: typeIdDownRight });
    console.log(`  ✓ [側邊樓層 Step 4 總建高] ID: ${lTotal.data.DimensionId}`);
  } else {
    console.log(`  ⚠️ 總高建立回傳:`, lTotal);
  }

  // 連續層高 (Step 3, GL -> 1FL -> 2FL -> 3FL -> 4FL -> RFL -> TRFL)
  const lCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    elementIds: levelIdsCont,
    startX: leftLevelTier2X, startY: topRoofZ + 2000.0,
    endX: leftLevelTier2X, endY: bottomGlZ - 2000.0,
    dimensionTypeId: typeIdDownRight
  });
  if (lCont.success && lCont.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: lCont.data.DimensionId, typeId: typeIdDownRight });
    console.log(`  ✓ [側邊樓層 Step 3 連續層高] ID: ${lCont.data.DimensionId}`);
  } else {
    console.log(`  ⚠️ 連續層高建立回傳:`, lCont);
  }

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】5 間距標準立面標註建立完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
