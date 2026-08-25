import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-all-structural-5steps-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【結構平面圖所有視圖】5 個間距 軸線齊頭 ＋ 雙層柱心標準標註 ===');
  console.log('================================================================\n');

  // 目標 5 個結構平面圖視圖
  const structViews = [
    { id: 390797, name: 'GL (結構平面)' },
    { id: 268781, name: '1FL (結構平面)' },
    { id: 268791, name: '2FL (結構平面)' },
    { id: 1381649, name: '3FL (結構平面)' },
    { id: 1381659, name: 'RFL (結構平面)' }
  ];

  // 1. 確保標準標註型式存在並強制自癒
  const ensureRes = await client.sendCommand('ensure_dimension_types', {});
  console.log(`✓ ${ensureRes.data?.Message || '標準標註型式已驗證'}`);

  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdColumn = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;

  console.log(`\n📌 柱心標註型式: ID ${typeIdColumn} (TABC-DIM_*/ S 2.5-柱心-上右) [端點: TABC-空心點 1.5mm 圓圈, 顏色: 黑]\n`);

  // 2. 以 2FL (ID: 268791) 作為結構全區實體最大外框基準視圖
  const globalRefViewId = 268791;
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefViewId,
    stepCount: 5.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: -28570.7, MaxX: 44779.3, MinY: -81661.9, MaxY: -35311.7
  };
  const globalBounds5 = baseAlign.data?.AlignmentBoundsMm || {
    TopY: globalEnv.MaxY + 3250.0, BottomY: globalEnv.MinY - 3250.0,
    LeftX: globalEnv.MinX - 3250.0, RightX: globalEnv.MaxX + 3250.0
  };

  console.log(`📌 全區實體外框基準 (Step 0):`);
  console.log(`   X: [${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}] mm`);
  console.log(`   Y: [${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}] mm`);
  console.log(`📌 5 間距齊頭線 (藍線, Step 5, +3250mm):`);
  console.log(`   Top=${globalBounds5.TopY.toFixed(1)}, Right=${globalBounds5.RightX.toFixed(1)} mm\n`);

  // 3. 定義 16 條軸線 ID 清單
  const northContGrids = [765797, 192192, 432845, 432924, 576725, 576798, 576858, 576903, 576963, 1357074, 818495, 821106];
  const northTotalGrids = [765797, 821106]; // 1 軸 與 12 軸

  const eastContGrids = [1474713, 1474775, 1474846, 1474912];
  const eastTotalGrids = [1474713, 1474912]; // D 軸 與 A 軸

  // 5 間距階梯放樣座標定義：
  // Step 5: 藍線 (+3250mm)
  // Step 4: 柱心 Tier 1 總跨 (+2600mm) -> 距藍線空 1 格 (650mm)
  // Step 3: 柱心 Tier 2 連續 (+1950mm) -> 距總跨空 1 格 (650mm)
  // Step 2~1: 留白緩衝帶 (+1300mm ~ +650mm)
  // Step 0: 紅線實體外緣 (0mm)

  const northColTier1Y = globalEnv.MaxY + 2600.0; // Step 4 (總跨)
  const northColTier2Y = globalEnv.MaxY + 1950.0; // Step 3 (連續)
  const eastColTier1X = globalEnv.MaxX + 2600.0;  // Step 4 (總跨)
  const eastColTier2X = globalEnv.MaxX + 1950.0;  // Step 3 (連續)

  const spanXMax = globalEnv.MaxX + 3000.0;
  const spanXMin = globalEnv.MinX - 3000.0;
  const spanYMax = globalEnv.MaxY + 3000.0;
  const spanYMin = globalEnv.MinY - 3000.0;

  const results = [];

  for (const v of structViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 執行視圖: [${v.name}] (View ID: ${v.id}) 5 間距齊頭與柱心標註...`);

    // (A) 5 間距 (3250mm) 軸線齊頭整列 (配置 A)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      stepCount: 5.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });

    if (!alignRes.success) {
      console.log(`  ❌ 軸線整列失敗:`, alignRes.error);
      results.push({ 視圖: v.name, 狀態: 'ALIGN_FAILED' });
      continue;
    }
    console.log(`  ✓ 16 條軸線四向齊頭整列完成 (5 間距 = 3,250 mm，配置 A)`);

    // (B) 清理舊尺寸與舊線條
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 1000 });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id, maxCount: 1000 });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }
    console.log(`  ✓ 已清理舊標註與輔助線`);

    // (C) 繪製 4 條紅線 (Step 0) 與 4 條藍線 (Step 5)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-西` },
      // 藍線 (Step 5)
      { startX: globalBounds5.LeftX, startY: globalBounds5.TopY, endX: globalBounds5.RightX, endY: globalBounds5.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-北` },
      { startX: globalBounds5.RightX, startY: globalBounds5.TopY, endX: globalBounds5.RightX, endY: globalBounds5.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-東` },
      { startX: globalBounds5.RightX, startY: globalBounds5.BottomY, endX: globalBounds5.LeftX, endY: globalBounds5.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-南` },
      { startX: globalBounds5.LeftX, startY: globalBounds5.BottomY, endX: globalBounds5.LeftX, endY: globalBounds5.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-西` }
    ];
    try { await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw }); } catch (e) {}

    // (D) 北側 (上方) 雙層柱心標註 (Step 4 總跨: 2600mm, Step 3 連續: 1950mm)
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdColumn
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdColumn });
      console.log(`  ✓ [北側柱心 Step 4 總跨] ID: ${nTotalRes.data.DimensionId}`);
    }

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContGrids,
      startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
      dimensionTypeId: typeIdColumn
    });
    if (nContRes.success && nContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdColumn });
      console.log(`  ✓ [北側柱心 Step 3 連續] ID: ${nContRes.data.DimensionId}`);
    }

    // (E) 東側 (右側) 雙層柱心標註 (Step 4 總跨: 2600mm, Step 3 連續: 1950mm)
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastTotalGrids,
      startX: eastColTier1X, startY: spanYMin, endX: eastColTier1X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eTotalRes.success && eTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdColumn });
      console.log(`  ✓ [東側柱心 Step 4 總跨] ID: ${eTotalRes.data.DimensionId}`);
    }

    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastContGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdColumn });
      console.log(`  ✓ [東側柱心 Step 3 連續] ID: ${eContRes.data.DimensionId}`);
    }

    results.push({
      視圖: v.name,
      間距模式: '5 個間距 (+3,250mm)',
      柱心總跨標註: 'Step 4 (+2,600mm)',
      柱心連續標註: 'Step 3 (+1,950mm)',
      標註型式: 'TABC-空心點 1.5mm (圓圈/黑線)',
      狀態: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 🎉 【所有結構平面圖】5 間距雙層圓圈柱心標註建立完成！ ===');
  console.log('================================================================');
  console.table(results);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
