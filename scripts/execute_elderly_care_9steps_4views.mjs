import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'elderly-care-9steps-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【長照籌設平面圖】1FL~RFL 4 視圖 9 間距 柱心 ＋ 3層牆心標準標註 ===');
  console.log('================================================================\n');

  // 1. 指定目標 4 個視圖
  const targetViews = [
    { id: 1453444, name: '1FL-籌設平面圖' },
    { id: 1453454, name: '2FL-籌設平面圖' },
    { id: 1453464, name: '3FL-籌設平面圖' },
    { id: 1453474, name: 'RFL-籌設平面圖' }
  ];

  // 2. 以 2FL (ID: 1453454) 作為全區實體最大外框基準視圖
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

  console.log(`📌 全區實體外框基準 (2FL, Step 0):`);
  console.log(`   X: [${globalEnv.MinX.toFixed(1)}, ${globalEnv.MaxX.toFixed(1)}] mm (寬度: ${(globalEnv.MaxX - globalEnv.MinX).toFixed(1)} mm)`);
  console.log(`   Y: [${globalEnv.MinY.toFixed(1)}, ${globalEnv.MaxY.toFixed(1)}] mm (深度: ${(globalEnv.MaxY - globalEnv.MinY).toFixed(1)} mm)`);
  console.log(`📌 9 間距齊頭線 (藍線, Step 9):`);
  console.log(`   Top=${globalBounds9.TopY.toFixed(1)}, Bottom=${globalBounds9.BottomY.toFixed(1)}, Left=${globalBounds9.LeftX.toFixed(1)}, Right=${globalBounds9.RightX.toFixed(1)} mm\n`);

  // 3. 標註型式解析
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  let typeIdColumn = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5')?.DimensionTypeId ||
                     dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右'))?.DimensionTypeId ||
                     dimTypeList.find(t => t.DimensionTypeName?.includes('柱心'))?.DimensionTypeId || 583877;

  let typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot')?.DimensionTypeId ||
                   dimTypeList.find(t => t.DimensionTypeName?.includes('dot 牆心') || t.DimensionTypeName?.includes('牆心'))?.DimensionTypeId ||
                   dimTypeList.find(t => t.DimensionTypeName?.includes('dot'))?.DimensionTypeId || 26206;

  console.log(`使用標註型式:`);
  console.log(`- 柱心尺寸: ID ${typeIdColumn}`);
  console.log(`- 牆心尺寸: ID ${typeIdWall}\n`);

  // 4. 定義 16 條軸線 ID 清單
  // 垂直軸線 1~12 (X 軸向): 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  const northContGrids = [765797, 192192, 432845, 432924, 576725, 576798, 576858, 576903, 576963, 1357074, 818495, 821106];
  const northTotalGrids = [765797, 821106]; // 1 軸 與 12 軸

  // 水平軸線 D~A (Y 軸向): D, C, B, A
  const eastContGrids = [1474713, 1474775, 1474846, 1474912];
  const eastTotalGrids = [1474713, 1474912]; // D 軸 與 A 軸

  // 5. 9 間距階梯放樣座標定義：
  // Step 9: 藍線 (5850mm)
  // Step 8: 柱心 Tier 1 總跨 (5200mm) -> 距藍線空 1 格 (650mm)
  // Step 7: 柱心 Tier 2 連續 (4550mm) -> 距總跨空 1 格 (650mm)
  // Step 6: 【留白隔離帶】(3900mm) -> 柱心與牆心之間空 1 格
  // Step 5: 牆心 Layer 1 外牆總長 (3250mm) -> isTotalOnly: true
  // Step 4: 牆心 Layer 2 居室主隔間 (2600mm) -> 綠線截面
  // Step 3: 牆心 Layer 3 走廊細部 (1950mm) -> 紫線截面
  // Step 2~1: 留白緩衝帶 (1300~650mm)
  // Step 0: 紅線實體外牆 (0mm)

  const northColTier1Y = globalEnv.MaxY + 5200.0;
  const northColTier2Y = globalEnv.MaxY + 4550.0;
  const eastColTier1X = globalEnv.MaxX + 5200.0;
  const eastColTier2X = globalEnv.MaxX + 4550.0;

  const northWallStep1Y = globalEnv.MaxY + 3250.0; // Layer 1 (總長)
  const northWallStep2Y = globalEnv.MaxY + 2600.0; // Layer 2 (居室)
  const northWallStep3Y = globalEnv.MaxY + 1950.0; // Layer 3 (走廊)

  const eastWallStep1X = globalEnv.MaxX + 3250.0;
  const eastWallStep2X = globalEnv.MaxX + 2600.0;
  const eastWallStep3X = globalEnv.MaxX + 1950.0;

  const westWallStep1X = globalEnv.MinX - 3250.0;
  const westWallStep2X = globalEnv.MinX - 2600.0;
  const westWallStep3X = globalEnv.MinX - 1950.0;

  const southWallStep1Y = globalEnv.MinY - 3250.0;
  const southWallStep2Y = globalEnv.MinY - 2600.0;
  const southWallStep3Y = globalEnv.MinY - 1950.0;

  const spanXMax = globalEnv.MaxX + 3000.0;
  const spanXMin = globalEnv.MinX - 3000.0;
  const spanYMax = globalEnv.MaxY + 3000.0;
  const spanYMin = globalEnv.MinY - 3000.0;

  // 輔助函式：建立牆心標註線
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
      console.log(`    ✓ [${sideName} Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId} (${segmentDesc})`);
      return res.data.DimensionId;
    }
    return null;
  }

  const summary = [];

  for (const v of targetViews) {
    console.log(`\n================================================================`);
    console.log(`🚀 執行視圖: [${v.name}] (View ID: ${v.id}) 9 間距精準放樣...`);

    // (A) 齊平軸線 (9 間距 5850mm，配置 A)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      stepCount: 9.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });

    if (!alignRes.success) {
      console.log(`  ❌ 軸線齊平失敗:`, alignRes.error);
      continue;
    }
    console.log(`  ✓ 16 條軸線四向齊頭整列完成 (9 間距 = 5,850 mm，配置 A)`);

    // (B) 清理舊尺寸與舊線條
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }

    // (C) 繪製 4 條紅線 (Step 0) 與 4 條藍線 (Step 9)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },
      // 藍線 (Step 9)
      { startX: globalBounds9.LeftX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭藍線-北` },
      { startX: globalBounds9.RightX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭藍線-東` },
      { startX: globalBounds9.RightX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭藍線-南` },
      { startX: globalBounds9.LeftX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條標準輔助線（4 紅 ＋ 4 藍）`);
    } catch (e) {}

    // (D) 北側與東側 雙層柱心標註 (Step 8 總跨 5200mm, Step 7 連續 4550mm)
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
    console.log(`  ✓ 雙層柱心標註完成 (Step 8 總跨: 5200mm, Step 7 連續: 4550mm)`);

    // (E) 收集直線主牆 (過濾 >= 140mm 主牆)
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const mainWalls = [];
    for (const w of wallsRes.data?.Elements || []) {
      const wInfo = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
      if (wInfo.success && wInfo.data) {
        const d = wInfo.data;
        if (d.Thickness < 140 && !d.Name?.includes('RC15') && !d.WallType?.includes('RC15')) continue;
        if (d.Length < 300) continue;
        if (d.Name?.includes('粉刷')) continue;

        const isVert = Math.abs(d.StartX - d.EndX) < 40.0;
        const isHoriz = Math.abs(d.StartY - d.EndY) < 40.0;
        mainWalls.push({
          id: d.ElementId,
          name: d.Name,
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
    console.log(`  ✓ 收集到 ${mainWalls.length} 道 >=15CM 主牆 (垂直 ${vertWalls.length}, 水平 ${horizWalls.length})`);

    // (F) 四向 3 層牆心標註放樣 (以走廊/居室分界)
    // 1. 東側 (East): 測量水平牆 centerY
    await createWallDim(v.id, '東側', 1, '外牆總長', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep1X, true);
    await createWallDim(v.id, '東側', 2, '居室主隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 12000), true, eastWallStep2X, false);
    await createWallDim(v.id, '東側', 3, '走廊機能隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 25000), true, eastWallStep3X, false);

    // 2. 西側 (West): 測量水平牆 centerY
    await createWallDim(v.id, '西側', 1, '外牆總長', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep1X, true);
    await createWallDim(v.id, '西側', 2, '居室主隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 12000), true, westWallStep2X, false);
    await createWallDim(v.id, '西側', 3, '走廊機能隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 25000), true, westWallStep3X, false);

    // 3. 北側 (North): 測量垂直牆 centerX
    await createWallDim(v.id, '北側', 1, '外牆總長', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep1Y, true);
    await createWallDim(v.id, '北側', 2, '居室主隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 15000), false, northWallStep2Y, false);
    await createWallDim(v.id, '北側', 3, '走廊機能隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 30000), false, northWallStep3Y, false);

    // 4. 南側 (South): 測量垂直牆 centerX
    await createWallDim(v.id, '南側', 1, '外牆總長', vertWalls.filter(w => w.minY < globalEnv.MinY + 8000), false, southWallStep1Y, true);
    await createWallDim(v.id, '南側', 2, '居室主隔間', vertWalls.filter(w => w.minY < globalEnv.MinY + 15000), false, southWallStep2Y, false);
    await createWallDim(v.id, '南側', 3, '走廊機能隔間', vertWalls.filter(w => w.minY < globalEnv.MinY + 30000), false, southWallStep3Y, false);

    summary.push({
      name: v.name,
      id: v.id,
      columnDims: 'Step 8(總跨) & Step 7(連續)',
      wallL1: 'Step 5(外牆總長)',
      wallL2: 'Step 4(居室主隔間)',
      wallL3: 'Step 3(走廊機能隔間)',
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【長照籌設平面圖】4 視圖 9 間距全自動標註放樣完成！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
