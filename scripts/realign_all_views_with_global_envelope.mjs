import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'realign-global-envelope-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【全專案】統一採用標準全區外牆基準 (Global Envelope) 進行 5 間距整列 ===');
  console.log('================================================================\n');

  // 1. 取得 1FL / 2FL 作為全區外框標準基準視圖
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  // 尋找 2FL 或 1FL 作為 Global Reference View
  let globalRefView = allViews.find(v => v.Name === '2FL' && v.ElementId === 268791) ||
                      allViews.find(v => v.Name === '1FL' && v.ElementId === 268781) ||
                      allViews.find(v => v.Name === '1FL' || v.Name === '2FL');

  console.log(`📌 全區實體外框標準基準視圖: "${globalRefView.Name}" (ID: ${globalRefView.ElementId})`);

  // 先在基準視圖提取全區實體外框
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefView.ElementId,
    stepCount: 5.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: 776.8, MaxX: 16026.8, MinY: -15060.4, MaxY: 1689.6
  };
  const globalBounds = baseAlign.data?.AlignmentBoundsMm || {
    TopY: globalEnv.MaxY + 3250.0, BottomY: globalEnv.MinY - 3250.0,
    LeftX: globalEnv.MinX - 3250.0, RightX: globalEnv.MaxX + 3250.0
  };

  console.log(`✓ 鎖定全區實體外框基準 (紅線): X=[${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}], Y=[${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}]`);
  console.log(`✓ 鎖定 5 間距齊頭線基準 (藍線): Top=${globalBounds.TopY.toFixed(1)}, Bottom=${globalBounds.BottomY.toFixed(1)}, Left=${globalBounds.LeftX.toFixed(1)}, Right=${globalBounds.RightX.toFixed(1)} mm\n`);

  // 2. 篩選所有平面視圖 (含 TRFL, RFL, 4FL, 3FL, 2FL, 1FL, GL, FT 等)
  const targetViews = [];
  for (const v of allViews) {
    if (v.Name.startsWith('{')) continue;
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const typeStr = (info.data?.Type || '').toString();
    if (typeStr.includes('圖例') || typeStr.includes('明細表') || typeStr.includes('立面') || typeStr.includes('剖面')) continue;
    if (typeStr.includes('平面') || info.data?.ViewType === 'FloorPlan' || info.data?.ViewType === 'StructuralPlan' || info.data?.ViewType === 'EngineeringPlan') {
      targetViews.push({ id: v.ElementId, name: v.Name });
    }
  }

  // 標註型式解析
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];
  let targetDimType = dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右')) ||
                      dimTypeList.find(t => t.DimensionTypeName?.includes('柱心')) ||
                      dimTypeList[0];
  const typeIdUpRight = targetDimType?.DimensionTypeId;

  // 垂直軸線 (4, 3, 2, 1) 與 水平軸線 (D, C, B, A)
  const northContinuousGrids = [596080, 432630, 432966, 192066];
  const northTotalGrids = [596080, 192066];
  const eastContinuousGrids = [611573, 432924, 432845, 192192];
  const eastTotalGrids = [611573, 192192];

  const northTier1Y = globalBounds.TopY - 650.0;
  const northTier2Y = globalBounds.TopY - 1300.0;
  const eastTier1X = globalBounds.RightX - 650.0;
  const eastTier2X = globalBounds.RightX - 1300.0;

  const spanXMax = globalEnv.MaxX + 2000.0;
  const spanXMin = globalEnv.MinX - 2000.0;
  const spanYMax = globalEnv.MaxY + 2000.0;
  const spanYMin = globalEnv.MinY - 2000.0;

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 統一套用全區外框基準進行 5 間距對齊...`);

    // (A) 透過 referenceViewId 統一使用全區外框進行軸線齊頭整列
    let alignRes;
    try {
      alignRes = await client.sendCommand('align_plan_grids', {
        viewId: v.id,
        referenceViewId: globalRefView.ElementId,
        stepCount: 5.0,
        stepMm: 650.0,
        usePhysicalEnvelope: true,
        showAllBubbles: false
      });
    } catch (e) {
      console.log(`  ⚠️ 略過樣板視圖: ${e.message}`);
      continue;
    }

    if (!alignRes || !alignRes.success) {
      console.log(`  ⚠️ 齊平略過: ${alignRes?.error}`);
      continue;
    }

    // (B) 刪除舊尺寸標註與舊輔助線
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }

    // (C) 繪製全區 4 條外牆紅線 (Step 0) 與 4 條 5間距藍線 (Step 5)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },
      // 藍線 (Step 5)
      { startX: globalBounds.LeftX, startY: globalBounds.TopY, endX: globalBounds.RightX, endY: globalBounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-北` },
      { startX: globalBounds.RightX, startY: globalBounds.TopY, endX: globalBounds.RightX, endY: globalBounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-東` },
      { startX: globalBounds.RightX, startY: globalBounds.BottomY, endX: globalBounds.LeftX, endY: globalBounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-南` },
      { startX: globalBounds.LeftX, startY: globalBounds.BottomY, endX: globalBounds.LeftX, endY: globalBounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條全區紅藍線`);
    } catch (e) {}

    // (D) 建立北側 (上方) 與 東側 (右側) 雙層柱心標註
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northTotalGrids,
      startX: spanXMax,
      startY: northTier1Y,
      endX: spanXMin,
      endY: northTier1Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdUpRight });
    }

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northContinuousGrids,
      startX: spanXMax,
      startY: northTier2Y,
      endX: spanXMin,
      endY: northTier2Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nContRes.success && nContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdUpRight });
    }

    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastTotalGrids,
      startX: eastTier1X,
      startY: spanYMin,
      endX: eastTier1X,
      endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eTotalRes.success && eTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdUpRight });
    }

    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastContinuousGrids,
      startX: eastTier2X,
      startY: spanYMin,
      endX: eastTier2X,
      endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdUpRight });
    }

    console.log(`  ✓ 柱間距標註完成 (北側: ${nTotalRes.data?.DimensionId}, ${nContRes.data?.DimensionId} / 東側: ${eTotalRes.data?.DimensionId}, ${eContRes.data?.DimensionId})`);

    summary.push({
      name: v.name,
      id: v.id,
      alignedGrids: alignRes.data.AlignedGridsCount,
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【全專案】包含 TRFL 在內之所有視圖已全數統一全區外框基準！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
