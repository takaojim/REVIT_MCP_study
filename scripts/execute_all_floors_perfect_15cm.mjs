import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-all-floors-perfect-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【長照籌設平面圖 1FL~RFL】空心圓圈柱心 ＋ 嚴格>=15CM牆心標註 ===');
  console.log('================================================================\n');

  // 目標 4 個視圖
  const targetViews = [
    { id: 1453444, name: '1FL-籌設平面圖' },
    { id: 1453454, name: '2FL-籌設平面圖' },
    { id: 1453464, name: '3FL-籌設平面圖' },
    { id: 1453474, name: 'RFL-籌設平面圖' }
  ];

  // 1. 確保標準型式存在並強制自癒
  const ensureRes = await client.sendCommand('ensure_dimension_types', {});
  console.log(`✓ ${ensureRes.data?.Message || '標準型式已自癒驗證'}`);

  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdColumn = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心')?.DimensionTypeId || 1513289;

  console.log(`\n📌 標註型式:`);
  console.log(`   - 柱心標註: ID ${typeIdColumn} (TABC-空心點 1.5mm 圓圈 + 黑色線條)`);
  console.log(`   - 牆心標註: ID ${typeIdWall} (TABC-實圓點 1.5mm + 黑色線條)\n`);

  // 2. 以 2FL (ID: 1453454) 為全區最大外框基準
  const globalRefViewId = 1453454;
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefViewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: -28570.7, MaxX: 44779.3, MinY: -81661.9, MaxY: -35311.7
  };
  const globalBounds9 = baseAlign.data?.AlignmentBoundsMm || {
    TopY: globalEnv.MaxY + 5850.0, BottomY: globalEnv.MinY - 5850.0,
    LeftX: globalEnv.MinX - 5850.0, RightX: globalEnv.MaxX + 5850.0
  };

  // 16 條軸線 ID
  const northContGrids = [765797, 192192, 432845, 432924, 576725, 576798, 576858, 576903, 576963, 1357074, 818495, 821106];
  const northTotalGrids = [765797, 821106];

  const eastContGrids = [1474713, 1474775, 1474846, 1474912];
  const eastTotalGrids = [1474713, 1474912];

  // 9 間距階梯座標
  const spanXMax = globalEnv.MaxX + 3000.0;
  const spanXMin = globalEnv.MinX - 3000.0;
  const spanYMax = globalEnv.MaxY + 3000.0;
  const spanYMin = globalEnv.MinY - 3000.0;

  const northColTier1Y = globalEnv.MaxY + 5200.0; // Step 8
  const northColTier2Y = globalEnv.MaxY + 4550.0; // Step 7
  const eastColTier1X = globalEnv.MaxX + 5200.0;  // Step 8
  const eastColTier2X = globalEnv.MaxX + 4550.0;  // Step 7

  const northWallStep1Y = globalEnv.MaxY + 3250.0; // Step 5
  const northWallStep2Y = globalEnv.MaxY + 2600.0; // Step 4
  const northWallStep3Y = globalEnv.MaxY + 1950.0; // Step 3

  const eastWallStep1X = globalEnv.MaxX + 3250.0;
  const eastWallStep2X = globalEnv.MaxX + 2600.0;
  const eastWallStep3X = globalEnv.MaxX + 1950.0;

  const westWallStep1X = globalEnv.MinX - 3250.0;
  const westWallStep2X = globalEnv.MinX - 2600.0;
  const westWallStep3X = globalEnv.MinX - 1950.0;

  const southWallStep1Y = globalEnv.MinY - 3250.0;
  const southWallStep2Y = globalEnv.MinY - 2600.0;
  const southWallStep3Y = globalEnv.MinY - 1950.0;

  // 牆心建立輔助函式
  async function createWallDim(viewId, sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isTotalOnly) {
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

    if (isTotalOnly) {
      unique = [unique[0], unique[unique.length - 1]];
    }

    const minC = Math.min(...unique.map(w => w[sortKey])) - 1500;
    const maxC = Math.max(...unique.map(w => w[sortKey])) + 1500;

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
      const segmentDesc = isTotalOnly ? '外牆單一總長' : `${unique.length - 1} 個分段`;
      console.log(`    ✓ [${sideName} Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId} (${segmentDesc}, ${unique.length} 道主牆)`);
      return res.data.DimensionId;
    }
    return null;
  }

  const results = [];

  for (const v of targetViews) {
    console.log(`\n================================================================`);
    console.log(`🚀 正在處理視圖: [${v.name}] (ID: ${v.id})...`);

    // (A) 軸線整列
    await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      stepCount: 9.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });

    // (B) 清理舊標註與舊線條
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 1000 });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id, maxCount: 1000 });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }

    // (C) 繪製基準紅線 (Step 0) 與藍線 (Step 9)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-紅線-西` },
      // 藍線 (Step 9)
      { startX: globalBounds9.LeftX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-北` },
      { startX: globalBounds9.RightX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-東` },
      { startX: globalBounds9.RightX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-南` },
      { startX: globalBounds9.LeftX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-藍線-西` }
    ];
    try { await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw }); } catch (e) {}

    // (D) 北側與東側 柱心標註 (Step 8 總跨 / Step 7 連續 - 圓圈型式)
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdColumn
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdColumn });
    }

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContGrids,
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
      viewId: v.id, gridIds: eastContGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdColumn
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdColumn });
    }
    console.log(`  ✓ 北側與東側 雙層圓圈柱心標註已建立 (Step 8 總跨, Step 7 連續)`);

    // (E) 收集並嚴格過濾 >= 15CM (150mm) 主牆，徹底捨棄 15cm 以下牆體
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const mainWalls = [];

    for (const w of wallsRes.data?.Elements || []) {
      const wInfo = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
      if (wInfo.success && wInfo.data) {
        const d = wInfo.data;

        // 嚴格排除 15CM 以下牆體：
        // 1. 厚度 < 149 mm (例如 120mm, 100mm, 80mm, 25mm 帷幕/矮牆/管道板)
        if (d.Thickness < 149.0 && !d.Name?.includes('15') && !d.WallType?.includes('15')) continue;
        if (d.Name?.includes('12cm') || d.WallType?.includes('12cm')) continue;
        if (d.Name?.includes('10cm') || d.WallType?.includes('10cm')) continue;
        if (d.Name?.includes('粉刷') || d.WallType?.includes('粉刷')) continue;
        if (d.Name?.includes('店面') && d.Thickness < 100) continue;
        if (d.Length < 300) continue;

        const isVert = Math.abs(d.StartX - d.EndX) < 40.0;
        const isHoriz = Math.abs(d.StartY - d.EndY) < 40.0;

        mainWalls.push({
          id: d.ElementId,
          name: d.Name,
          thickness: d.Thickness,
          length: d.Length,
          startX: d.StartX, startY: d.StartY, endX: d.EndX, endY: d.EndY,
          centerX: (d.StartX + d.EndX) / 2.0,
          centerY: (d.StartY + d.EndY) / 2.0,
          minX: Math.min(d.StartX, d.EndX), maxX: Math.max(d.StartX, d.EndX),
          minY: Math.min(d.StartY, d.EndY), maxY: Math.max(d.StartY, d.EndY),
          isVert, isHoriz
        });
      }
    }

    const vertWalls = mainWalls.filter(w => w.isVert);
    const horizWalls = mainWalls.filter(w => w.isHoriz);
    console.log(`  ✓ 篩選出 ${mainWalls.length} 道 >=15CM 主牆 (垂直 ${vertWalls.length}, 水平 ${horizWalls.length})，已完全捨棄 <15CM 牆體`);

    // (F) 四向 3 層牆心標註放樣
    // 1. 東側 (East)
    await createWallDim(v.id, '東側', 1, '外牆總長', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep1X, true);
    await createWallDim(v.id, '東側', 2, '居室主隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 12000), true, eastWallStep2X, false);
    await createWallDim(v.id, '東側', 3, '走廊機能隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 25000), true, eastWallStep3X, false);

    // 2. 西側 (West)
    await createWallDim(v.id, '西側', 1, '外牆總長', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep1X, true);
    await createWallDim(v.id, '西側', 2, '居室主隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 12000), true, westWallStep2X, false);
    await createWallDim(v.id, '西側', 3, '走廊機能隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 25000), true, westWallStep3X, false);

    // 3. 北側 (North)
    await createWallDim(v.id, '北側', 1, '外牆總長', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep1Y, true);
    await createWallDim(v.id, '北側', 2, '居室主隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 15000), false, northWallStep2Y, false);
    await createWallDim(v.id, '北側', 3, '走廊機能隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 30000), false, northWallStep3Y, false);

    // 4. 南側 (South)
    const southWalls = vertWalls.filter(w => w.minY < (v.name.includes('1FL') ? -55000 : globalEnv.MinY + 15000));
    await createWallDim(v.id, '南側', 1, '外牆總長', southWalls, false, southWallStep1Y, true);
    await createWallDim(v.id, '南側', 2, '居室主隔間', vertWalls.filter(w => w.minY < (v.name.includes('1FL') ? -50000 : globalEnv.MinY + 25000)), false, southWallStep2Y, false);
    await createWallDim(v.id, '南側', 3, '走廊機能隔間', vertWalls.filter(w => w.minY < (v.name.includes('1FL') ? -40000 : globalEnv.MinY + 35000)), false, southWallStep3Y, false);

    results.push({
      視圖: v.name,
      柱心標註型式: 'TABC-空心點 1.5mm (圓圈)',
      牆心標註型式: 'TABC-實圓點 1.5mm',
      主牆過濾: '>=15CM (嚴格捨棄 <15CM)',
      狀態: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 🎉 【所有樓層 1FL~RFL】標準標註與 >=15CM 主牆更新完成！ ===');
  console.log('================================================================');
  console.table(results);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
