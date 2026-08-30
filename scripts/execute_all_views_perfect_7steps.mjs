import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'perfect-7steps-wall-fixed-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【樓板平面所有視圖】7 間距標準出圖放樣 (牆心標註幾何修正版) ===');
  console.log('================================================================\n');

  // 1. 取得全區外框標準基準視圖 (2FL / 1FL)
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  let globalRefView = allViews.find(v => v.Name === '2FL' && v.ElementId === 268791) ||
                      allViews.find(v => v.Name === '1FL' && v.ElementId === 268781) ||
                      allViews.find(v => v.Name === '1FL' || v.Name === '2FL');

  console.log(`📌 全區實體外框標準基準視圖: "${globalRefView.Name}" (ID: ${globalRefView.ElementId})`);

  // 提取全區實體外框
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefView.ElementId,
    stepCount: 7.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: 776.8, MaxX: 16026.8, MinY: -15060.4, MaxY: 1689.6
  };

  console.log(`✓ 全區實體外框 (紅線, Step 0): X=[${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}], Y=[${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}]\n`);

  // 2. 標註型式解析
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  let typeIdColumn = dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右'))?.DimensionTypeId ||
                     dimTypeList.find(t => t.DimensionTypeName?.includes('柱心'))?.DimensionTypeId || 689724;

  let typeIdWall = dimTypeList.find(t => t.DimensionTypeName?.includes('dot 牆心') || t.DimensionTypeName?.includes('牆心'))?.DimensionTypeId ||
                   dimTypeList.find(t => t.DimensionTypeName?.includes('dot'))?.DimensionTypeId || 689724;

  // 3. 篩選樓板平面視圖
  const floorPlanViews = [];
  for (const v of allViews) {
    if (v.Name.startsWith('{')) continue;
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const typeStr = (info.data?.Type || '').toString();
    const vType = info.data?.ViewType || '';
    if (typeStr.includes('圖例') || typeStr.includes('明細表') || typeStr.includes('立面') || typeStr.includes('剖面')) continue;
    if (typeStr.includes('樓板平面') || typeStr.includes('建築') || vType === 'FloorPlan' || (typeStr.includes('平面') && !typeStr.includes('結構'))) {
      floorPlanViews.push({ id: v.ElementId, name: v.Name });
    }
  }

  const northContinuousGrids = [596080, 432630, 432966, 192066];
  const northTotalGrids = [596080, 192066];
  const eastContinuousGrids = [611573, 432924, 432845, 192192];
  const eastTotalGrids = [611573, 192192];

  const spanXMax = globalEnv.MaxX + 2000.0;
  const spanXMin = globalEnv.MinX - 2000.0;
  const spanYMax = globalEnv.MaxY + 2000.0;
  const spanYMin = globalEnv.MinY - 2000.0;

  // 輔助函式：建立牆心標註線
  // isVerticalDimLine = true 代表垂直標註線 (量測水平牆的 Y 座標)
  // isVerticalDimLine = false 代表水平標註線 (量測垂直牆的 X 座標)
  async function createWallDim(viewId, sideName, layerName, walls, isVerticalDimLine, dimCoord, isTotalOnly, sliceCoord) {
    if (!walls || walls.length < 2) return null;
    const sortKey = isVerticalDimLine ? 'centerY' : 'centerX';
    const tol = 35.0;

    let candidates = [];
    if (sliceCoord !== null && sliceCoord !== undefined) {
      for (const w of walls) {
        const cMin = isVerticalDimLine ? w.minX : w.minY;
        const cMax = isVerticalDimLine ? w.maxX : w.maxY;
        if (sliceCoord >= cMin - tol && sliceCoord <= cMax + tol) {
          candidates.push(w);
        }
      }
    } else {
      candidates = [...walls];
    }

    if (candidates.length < 2) candidates = [...walls];

    candidates.sort((a, b) => a[sortKey] - b[sortKey]);

    let unique = [];
    for (const w of candidates) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > tol) {
        unique.push(w);
      }
    }
    if (unique.length < 2) return null;

    // 若為「外牆總長 (isTotalOnly)」，只取最前與最後兩道牆
    if (isTotalOnly) {
      unique = [unique[0], unique[unique.length - 1]];
    }

    const minC = Math.min(...unique.map(w => w[sortKey])) - 1000;
    const maxC = Math.max(...unique.map(w => w[sortKey])) + 1000;

    let sX, sY, eX, eY;
    if (isVerticalDimLine) {
      sX = dimCoord; sY = minC; eX = dimCoord; eY = maxC;
    } else {
      sX = maxC; sY = dimCoord; eX = minC; eY = dimCoord;
    }

    const res = await client.sendCommand('create_dimension', {
      viewId: viewId,
      elementIds: unique.map(w => w.id),
      startX: sX, startY: sY, endX: eX, endY: eY,
      dimensionTypeId: typeIdWall
    });

    if (res.success && res.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: res.data.DimensionId, typeId: typeIdWall });
      const desc = isTotalOnly ? '外牆總長 (單一跨距)' : `居室主隔間 (${unique.length - 1} 分段)`;
      console.log(`    ✓ [${sideName} - ${layerName}: ${desc}] ID: ${res.data.DimensionId}`);
      return res.data.DimensionId;
    } else {
      console.log(`    ❌ [${sideName} - ${layerName}] 建立失敗:`, res.error);
    }
    return null;
  }

  const summary = [];

  for (const v of floorPlanViews) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 執行 7 間距軸線齊頭...`);

    // (A) 執行 7 間距軸線齊頭 (配置 A: 上右開氣泡，下左關閉)
    let alignRes;
    try {
      alignRes = await client.sendCommand('align_plan_grids', {
        viewId: v.id,
        referenceViewId: globalRefView.ElementId,
        stepCount: 7.0,
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

    // 關鍵：從 Revit C# align_plan_grids 返回的實際 OffsetMm 直接取得本視圖真實模矩長度！
    const actualOffsetMm = alignRes.data?.OffsetMm || 4550.0;
    const currentStepMm = actualOffsetMm / 7.0; // 1:50 -> 325mm, 1:100 -> 650mm
    const viewScaleRatio = currentStepMm / 650.0;
    const calculatedScale = Math.round(100 * viewScaleRatio);

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
    const eastColTier1X  = globalEnv.MaxX + 6.0 * currentStepMm;
    const eastColTier2X  = globalEnv.MaxX + 5.0 * currentStepMm;

    const northWallStep1Y = globalEnv.MaxY + 3.0 * currentStepMm; // Step 3: 牆心 Layer 1 (外牆總長)
    const northWallStep2Y = globalEnv.MaxY + 2.0 * currentStepMm; // Step 2: 牆心 Layer 2 (居室隔間)
    const eastWallStep1X  = globalEnv.MaxX + 3.0 * currentStepMm;
    const eastWallStep2X  = globalEnv.MaxX + 2.0 * currentStepMm;
    const westWallStep1X  = globalEnv.MinX - 3.0 * currentStepMm;
    const westWallStep2X  = globalEnv.MinX - 2.0 * currentStepMm;
    const southWallStep1Y = globalEnv.MinY - 3.0 * currentStepMm;
    const southWallStep2Y = globalEnv.MinY - 2.0 * currentStepMm;

    console.log(`   📌 視圖比例 1:${calculatedScale} | 模矩間距: ${currentStepMm.toFixed(1)} mm | 7 間距藍線: Top=${topBlueY.toFixed(1)}, Right=${rightBlueX.toFixed(1)} mm`);

    // (B) 清理舊尺寸標註與舊線條
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }

    // (C) 繪製 4 條全區外牆紅線 (Step 0) 與 4 條 7間距藍線 (Step 7)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },
      // 藍線 (Step 7)
      { startX: leftBlueX, startY: topBlueY, endX: rightBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-北` },
      { startX: rightBlueX, startY: topBlueY, endX: rightBlueX, endY: bottomBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-東` },
      { startX: rightBlueX, startY: bottomBlueY, endX: leftBlueX, endY: bottomBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-南` },
      { startX: leftBlueX, startY: bottomBlueY, endX: leftBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條輔助線（4 紅 ＋ 4 藍，精確貼齊氣泡圓圈）`);
    } catch (e) {}

    // (D) 北側與東側 雙層柱心標註 (Step 6 總跨, Step 5 連續)
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdColumn
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdColumn });
    }

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContinuousGrids,
      startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
      dimensionTypeId: typeIdColumn
    });
    if (nContRes.success && nContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdColumn });
    }

    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastTotalGrids,
      startX: eastColTier1X, startY: spanYMin, endX: eastColTier1X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eTotalRes.success && eTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdColumn });
    }

    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastContinuousGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdColumn });
    }
    console.log(`  ✓ 柱心標註放樣完成 (Step 6 總跨: ${northColTier1Y.toFixed(1)}, Step 5 連續: ${northColTier2Y.toFixed(1)})`);

    // (E) 收集直線牆體
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const wallElements = [];
    for (const w of wallsRes.data?.Elements || []) {
      const wInfo = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
      if (wInfo.success && wInfo.data) {
        const d = wInfo.data;
        const isVert = Math.abs(d.StartX - d.EndX) < 35.0;
        const isHoriz = Math.abs(d.StartY - d.EndY) < 35.0;
        if (d.Length < 250) continue;
        wallElements.push({
          id: w.ElementId,
          name: d.Name || '',
          wallType: d.WallType || '',
          thickness: d.Thickness,
          length: d.Length,
          startX: d.StartX,
          startY: d.StartY,
          endX: d.EndX,
          endY: d.EndY,
          minX: Math.min(d.StartX, d.EndX),
          maxX: Math.max(d.StartX, d.EndX),
          minY: Math.min(d.StartY, d.EndY),
          maxY: Math.max(d.StartY, d.EndY),
          centerX: (d.StartX + d.EndX) / 2.0,
          centerY: (d.StartY + d.EndY) / 2.0,
          isVert: isVert,
          isHoriz: isHoriz
        });
      }
    }

    // 嚴格過濾 >= 140mm (15cm) 主結構牆
    const mainWalls = wallElements.filter(w => w.thickness >= 140.0);
    const vertWalls = mainWalls.filter(w => w.isVert);
    const horizWalls = mainWalls.filter(w => w.isHoriz);

    console.log(`  🔍 牆體分析 (>=15cm 主牆): 垂直牆(南北向)=${vertWalls.length}, 水平牆(東西向)=${horizWalls.length}`);

    // (F) 四向兩層牆心標註建立
    // 1. 北側 (North): 水平標註線 (isVerticalDimLine=false)，量測垂直牆的 X 坐標
    await createWallDim(v.id, '北側', 'Layer 1', vertWalls, false, northWallStep1Y, true, null);
    await createWallDim(v.id, '北側', 'Layer 2', vertWalls, false, northWallStep2Y, false, globalEnv.MaxY - 3000.0);

    // 2. 東側 (East): 垂直標註線 (isVerticalDimLine=true)，量測水平牆的 Y 坐標
    await createWallDim(v.id, '東側', 'Layer 1', horizWalls, true, eastWallStep1X, true, null);
    await createWallDim(v.id, '東側', 'Layer 2', horizWalls, true, eastWallStep2X, false, globalEnv.MaxX - 3000.0);

    // 3. 西側 (West): 垂直標註線 (isVerticalDimLine=true)，量測水平牆的 Y 坐標
    await createWallDim(v.id, '西側', 'Layer 1', horizWalls, true, westWallStep1X, true, null);
    await createWallDim(v.id, '西側', 'Layer 2', horizWalls, true, westWallStep2X, false, globalEnv.MinX + 3000.0);

    // 4. 南側 (South): 水平標註線 (isVerticalDimLine=false)，量測垂直牆的 X 坐標
    await createWallDim(v.id, '南側', 'Layer 1', vertWalls, false, southWallStep1Y, true, null);
    await createWallDim(v.id, '南側', 'Layer 2', vertWalls, false, southWallStep2Y, false, globalEnv.MinY + 3000.0);

    summary.push({
      name: v.name,
      id: v.id,
      scale: `1:${calculatedScale}`,
      stepMm: `${currentStepMm.toFixed(1)}mm`,
      blueLineOffset: `${actualOffsetMm.toFixed(1)}mm`,
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【樓板平面所有視圖】牆心標註修正版放樣全部完成！ ===');
  console.log('================================================================');
  console.table(summary);
}

main().catch(console.error);
