import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'structural-grid-dimensions-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【結構平面所有視圖】柱間距雙層標準放樣 ===');
  console.log('================================================================\n');

  // 1. 取得標註型式
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  let typeIdColumn = dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右'))?.DimensionTypeId ||
                     dimTypeList.find(t => t.DimensionTypeName?.includes('柱心'))?.DimensionTypeId || 689724;

  console.log(`📌 套用柱心標註型式 ID: ${typeIdColumn}`);

  // 2. 取得全區基準外框 (2FL 結構平面 ID: 268791)
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: 268791,
    stepCount: 7.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: 776.8, MaxX: 16026.8, MinY: -15060.4, MaxY: 1689.6
  };
  console.log(`✓ 實體外框基準: X=[${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}], Y=[${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}]\n`);

  // 3. 結構平面視圖清單 (Type === '結構平面')
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const allViews = viewsRes.data?.Elements || [];

  const structuralPlanViews = [];
  for (const v of allViews) {
    if (v.Name?.startsWith('{')) continue;
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || info.data?.ViewType || '';
    const typeName = getVal('類型') || info.data?.Type || '';
    const name = v.Name || '';

    if (
      typeName === '結構平面' ||
      viewType === '結構平面' ||
      (typeName.includes('結構') && typeName.includes('平面'))
    ) {
      structuralPlanViews.push({
        id: v.ElementId,
        name: name,
        typeName: typeName,
        scale: info.data?.Scale || 100
      });
    }
  }

  // 排序：FT -> GL -> 1FL -> 2FL -> 3FL -> 4FL -> RFL -> TRFL
  const order = ['FT', 'GL', '1FL', '2FL', '3FL', '4FL', 'RFL', 'TRFL'];
  structuralPlanViews.sort((a, b) => {
    const ia = order.indexOf(a.name);
    const ib = order.indexOf(b.name);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.name.localeCompare(b.name);
  });

  console.log(`=== 找到 ${structuralPlanViews.length} 個結構平面視圖 ===`);
  structuralPlanViews.forEach(v => console.log(`  - [${v.name}] (ID: ${v.id}, 類型: ${v.typeName}, 比例: 1:${v.scale})`));
  console.log('');

  const northContinuousGrids = [596080, 432630, 432966, 192066]; // 1, 2, 3, 4
  const northTotalGrids = [596080, 192066];                     // 1, 4
  const eastContinuousGrids = [611573, 432924, 432845, 192192];  // A, B, C, D
  const eastTotalGrids = [611573, 192192];                      // A, D

  const spanXMax = globalEnv.MaxX + 2000.0;
  const spanXMin = globalEnv.MinX - 2000.0;
  const spanYMax = globalEnv.MaxY + 2000.0;
  const spanYMin = globalEnv.MinY - 2000.0;

  const summary = [];

  for (const v of structuralPlanViews) {
    console.log(`------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}, 比例 1:${v.scale}) 執行軸線齊頭與柱心標註...`);

    // (A) 軸線齊頭整列 (7 間距，配置 A: 上右開氣泡，下左關閉)
    let alignRes;
    try {
      alignRes = await client.sendCommand('align_plan_grids', {
        viewId: v.id,
        referenceViewId: 268791,
        stepCount: 7.0,
        stepMm: 650.0,
        usePhysicalEnvelope: true,
        showAllBubbles: false
      });
    } catch (e) {
      console.log(`  ⚠️ 略過: ${e.message}`);
      continue;
    }

    if (!alignRes || !alignRes.success) {
      console.log(`  ⚠️ 齊頭略過: ${alignRes?.error}`);
      continue;
    }

    const actualOffsetMm = alignRes.data?.OffsetMm || (v.scale * 6.5 * 7.0);
    const currentStepMm = actualOffsetMm / 7.0;

    const bounds = alignRes.data?.AlignmentBoundsMm || {
      TopY: globalEnv.MaxY + actualOffsetMm,
      BottomY: globalEnv.MinY - actualOffsetMm,
      LeftX: globalEnv.MinX - actualOffsetMm,
      RightX: globalEnv.MaxX + actualOffsetMm
    };

    const topBlueY = bounds.TopY;
    const bottomBlueY = bounds.BottomY;
    const leftBlueX = bounds.LeftX;
    const rightBlueX = bounds.RightX;

    const northColTier1Y = globalEnv.MaxY + 6.0 * currentStepMm; // Step 6: 總跨
    const northColTier2Y = globalEnv.MaxY + 5.0 * currentStepMm; // Step 5: 連續
    const eastColTier1X  = globalEnv.MaxX + 6.0 * currentStepMm; // Step 6: 總跨
    const eastColTier2X  = globalEnv.MaxX + 5.0 * currentStepMm; // Step 5: 連續

    // (B) 清理既有尺寸標註與輔助線
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }

    // (C) 繪製 4 條 Step 0 紅線與 4 條 Step 7 藍線
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-結構外框紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-結構外框紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-結構外框紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-結構外框紅線-西` },
      // 藍線 (Step 7)
      { startX: leftBlueX, startY: topBlueY, endX: rightBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-北` },
      { startX: rightBlueX, startY: topBlueY, endX: rightBlueX, endY: bottomBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-東` },
      { startX: rightBlueX, startY: bottomBlueY, endX: leftBlueX, endY: bottomBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-南` },
      { startX: leftBlueX, startY: bottomBlueY, endX: leftBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條輔助基準線（4 紅 ＋ 4 藍）`);
    } catch (e) {}

    // (D) 北側雙層柱心標註 (Step 6 總跨 + Step 5 連續)
    let n1Id = null, n2Id = null, e1Id = null, e2Id = null;

    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdColumn
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      n1Id = nTotalRes.data.DimensionId;
      await client.sendCommand('change_element_type', { elementId: n1Id, typeId: typeIdColumn });
    }

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContinuousGrids,
      startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
      dimensionTypeId: typeIdColumn
    });
    if (nContRes.success && nContRes.data?.DimensionId) {
      n2Id = nContRes.data.DimensionId;
      await client.sendCommand('change_element_type', { elementId: n2Id, typeId: typeIdColumn });
    }

    // (E) 東側雙層柱心標註 (Step 6 總跨 + Step 5 連續)
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastTotalGrids,
      startX: eastColTier1X, startY: spanYMin, endX: eastColTier1X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eTotalRes.success && eTotalRes.data?.DimensionId) {
      e1Id = eTotalRes.data.DimensionId;
      await client.sendCommand('change_element_type', { elementId: e1Id, typeId: typeIdColumn });
    }

    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastContinuousGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      e2Id = eContRes.data.DimensionId;
      await client.sendCommand('change_element_type', { elementId: e2Id, typeId: typeIdColumn });
    }

    console.log(`  ✓ 北側柱心 (總跨 ID: ${n1Id}, 連續 ID: ${n2Id}) | 東側柱心 (總跨 ID: ${e1Id}, 連續 ID: ${e2Id})`);

    summary.push({
      name: v.name,
      id: v.id,
      scale: `1:${v.scale}`,
      stepMm: `${currentStepMm.toFixed(1)}mm`,
      northDims: `${n1Id ? '✅' : '❌'} / ${n2Id ? '✅' : '❌'}`,
      eastDims: `${e1Id ? '✅' : '❌'} / ${e2Id ? '✅' : '❌'}`,
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【結構平面所有視圖】柱間距標註全部完成！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
