import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'perfect-7steps-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【樓板平面所有視圖】7 間距標準出圖放樣 (修正牆心總長與間隔) ===');
  console.log('================================================================\n');

  // 1. 取得全區外框標準基準視圖 (2FL / 1FL)
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  let globalRefView = allViews.find(v => v.Name === '2FL' && v.ElementId === 268791) ||
                      allViews.find(v => v.Name === '1FL' && v.ElementId === 268781) ||
                      allViews.find(v => v.Name === '1FL' || v.Name === '2FL');

  console.log(`📌 全區實體外框標準基準視圖: "${globalRefView.Name}" (ID: ${globalRefView.ElementId})`);

  // 提取全區 7 間距基準
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
  const globalBounds7 = baseAlign.data?.AlignmentBoundsMm || {
    TopY: globalEnv.MaxY + 4550.0, BottomY: globalEnv.MinY - 4550.0,
    LeftX: globalEnv.MinX - 4550.0, RightX: globalEnv.MaxX + 4550.0
  };

  console.log(`✓ 全區實體外框 (紅線, Step 0): X=[${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}], Y=[${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}]`);
  console.log(`✓ 7 間距齊頭線 (藍線, Step 7): Top=${globalBounds7.TopY.toFixed(1)}, Bottom=${globalBounds7.BottomY.toFixed(1)}, Left=${globalBounds7.LeftX.toFixed(1)}, Right=${globalBounds7.RightX.toFixed(1)} mm\n`);

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

  // 4. 定義 7 間距標準技能階梯放樣坐標：
  // Step 7: 藍線 (4550mm) 氣泡圈端點
  // Step 6: 柱心 Tier 1 總跨 (3900mm) -> 距氣泡 1 格
  // Step 5: 柱心 Tier 2 連續 (3250mm) -> 距總跨 1 格
  // Step 4: 留白空格 (2600mm) -> 【柱心與牆心之間空一格】！
  // Step 3: 牆心 Layer 1 外牆總長 (1950mm) -> 距空格 1 格
  // Step 2: 牆心 Layer 2 居室隔間 (1300mm) -> 距牆心1 1 格
  // Step 1: 留白空格 (650mm) -> 【牆心與外牆之間空一格】！
  // Step 0: 紅線外牆面 (0mm)

  const northColTier1Y = globalEnv.MaxY + 3900.0; // Step 6: 總跨
  const northColTier2Y = globalEnv.MaxY + 3250.0; // Step 5: 連續
  const eastColTier1X = globalEnv.MaxX + 3900.0;
  const eastColTier2X = globalEnv.MaxX + 3250.0;

  const northWallStep1Y = globalEnv.MaxY + 1950.0; // Step 3: 牆心 Layer 1 (外牆總長)
  const northWallStep2Y = globalEnv.MaxY + 1300.0; // Step 2: 牆心 Layer 2 (居室隔間)

  const eastWallStep1X = globalEnv.MaxX + 1950.0;
  const eastWallStep2X = globalEnv.MaxX + 1300.0;

  const westWallStep1X = globalEnv.MinX - 1950.0;
  const westWallStep2X = globalEnv.MinX - 1300.0;

  const southWallStep1Y = globalEnv.MinY - 1950.0;
  const southWallStep2Y = globalEnv.MinY - 1300.0;

  const northContinuousGrids = [596080, 432630, 432966, 192066];
  const northTotalGrids = [596080, 192066];
  const eastContinuousGrids = [611573, 432924, 432845, 192192];
  const eastTotalGrids = [611573, 192192];

  const spanXMax = globalEnv.MaxX + 2000.0;
  const spanXMin = globalEnv.MinX - 2000.0;
  const spanYMax = globalEnv.MaxY + 2000.0;
  const spanYMin = globalEnv.MinY - 2000.0;

  // 輔助函式：建立標註線
  async function createDim(viewId, sideName, layerName, walls, isVerticalAxis, dimCoord, isTotalOnly) {
    if (!walls || walls.length < 2) return null;
    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    walls.sort((a, b) => a[sortKey] - b[sortKey]);

    let unique = [];
    for (const w of walls) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > 35.0) {
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
    if (isVerticalAxis) {
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
    }
    return null;
  }

  const summary = [];

  for (const v of floorPlanViews) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 執行 7 間距精準放樣...`);

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
      { startX: globalBounds7.LeftX, startY: globalBounds7.TopY, endX: globalBounds7.RightX, endY: globalBounds7.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-北` },
      { startX: globalBounds7.RightX, startY: globalBounds7.TopY, endX: globalBounds7.RightX, endY: globalBounds7.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-東` },
      { startX: globalBounds7.RightX, startY: globalBounds7.BottomY, endX: globalBounds7.LeftX, endY: globalBounds7.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-南` },
      { startX: globalBounds7.LeftX, startY: globalBounds7.BottomY, endX: globalBounds7.LeftX, endY: globalBounds7.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條輔助線（4 紅 ＋ 4 藍）`);
    } catch (e) {}

    // (D) 北側與東側 雙層柱心標註 (Step 5 總跨 3250mm, Step 4 連續 2600mm)
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
    console.log(`  ✓ 柱心標註放樣完成 (Step 5 總跨: 3250mm, Step 4 連續: 2600mm)`);

    // (E) 收集直線牆體
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const wallElements = [];
    for (const w of wallsRes.data?.Elements || []) {
      const wInfo = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
      if (wInfo.success && wInfo.data) {
        const d = wInfo.data;
        const isVert = Math.abs(d.StartX - d.EndX) < 30.0;
        const isHoriz = Math.abs(d.StartY - d.EndY) < 30.0;
        wallElements.push({
          id: d.ElementId,
          name: d.Name,
          startX: d.StartX, startY: d.StartY, endX: d.EndX, endY: d.EndY,
          centerX: (d.StartX + d.EndX) / 2.0,
          centerY: (d.StartY + d.EndY) / 2.0,
          minX: Math.min(d.StartX, d.EndX), maxX: Math.max(d.StartX, d.EndX),
          minY: Math.min(d.StartY, d.EndY), maxY: Math.max(d.StartY, d.EndY),
          isVert: isVert, isHoriz: isHoriz
        });
      }
    }

    const vertWalls = wallElements.filter(w => w.isVert);
    const horizWalls = wallElements.filter(w => w.isHoriz);

    // (F) 建立 4 向 2 層牆心標註
    // 1. 東側: 測量東西向水平牆 Y 坐標 (Layer 1 外牆總長 isTotalOnly=true, Layer 2 居室隔間 isTotalOnly=false)
    await createDim(v.id, '東側', 'Layer 1', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 5000), true, eastWallStep1X, true);
    await createDim(v.id, '東側', 'Layer 2', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep2X, false);

    // 2. 西側
    await createDim(v.id, '西側', 'Layer 1', horizWalls.filter(w => w.minX < globalEnv.MinX + 5000), true, westWallStep1X, true);
    await createDim(v.id, '西側', 'Layer 2', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep2X, false);

    // 3. 北側: 測量南北向垂直牆 X 坐標
    await createDim(v.id, '北側', 'Layer 1', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 5000), false, northWallStep1Y, true);
    await createDim(v.id, '北側', 'Layer 2', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep2Y, false);

    // 4. 南側
    await createDim(v.id, '南側', 'Layer 1', vertWalls.filter(w => w.minY < globalEnv.MinY + 5000), false, southWallStep1Y, true);
    await createDim(v.id, '南側', 'Layer 2', vertWalls.filter(w => w.minY < globalEnv.MinY + 8000), false, southWallStep2Y, false);

    summary.push({
      name: v.name,
      id: v.id,
      columnDims: 'Step 5(總跨) & Step 4(連續)',
      wallLayer1: 'Step 3(外牆總長)',
      wallLayer2: 'Step 2(居室主隔間)',
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【樓板平面所有視圖】7 間距標準放樣全部完成！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
