import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-1fl-perfect-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【1FL-籌設平面圖】空心圓圈黑色柱心 ＋ 3層牆心標準標註放樣 ===');
  console.log('================================================================\n');

  const viewId = 1453444; // 1FL-籌設平面圖
  const globalRefViewId = 1453454; // 2FL 作為全區外框基準

  // 1. 確保標準標註型式存在並強制自癒（包含 TABC-空心點 1.5mm 圓圈 + 黑色線條）
  const ensureRes = await client.sendCommand('ensure_dimension_types', {});
  console.log(`✓ ${ensureRes.data?.Message || '已檢查並確保標準標註型式'}`);

  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  let typeIdColumn = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId ||
                     dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右'))?.DimensionTypeId;

  let typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心')?.DimensionTypeId ||
                   dimTypeList.find(t => t.DimensionTypeName?.includes('dot 牆心'))?.DimensionTypeId;

  console.log(`\n📌 套用之標準標註型式:`);
  console.log(`   - 柱心標註: ID ${typeIdColumn} (TABC-DIM_*/ S 2.5-柱心-上右) [端點: TABC-空心點 1.5mm, 顏色: 黑]`);
  console.log(`   - 牆心標註: ID ${typeIdWall} (TABC-DIM_dot 牆心)\n`);

  // 2. 齊平軸線 (9 間距 = 5,850 mm，配置 A: 北與東開啟氣泡)
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    referenceViewId: globalRefViewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  if (!alignRes.success) {
    console.log(`❌ 軸線整列失敗:`, alignRes.error);
    process.exit(1);
  }
  console.log(`✓ 16 條軸線四向齊頭整列完成 (9 間距 = 5,850 mm，配置 A)`);

  const globalEnv = alignRes.data?.PhysicalEnvelopeMm || {
    MinX: -28570.7, MaxX: 44779.3, MinY: -81661.9, MaxY: -35311.7
  };
  const globalBounds9 = alignRes.data?.AlignmentBoundsMm || {
    TopY: globalEnv.MaxY + 5850.0, BottomY: globalEnv.MinY - 5850.0,
    LeftX: globalEnv.MinX - 5850.0, RightX: globalEnv.MaxX + 5850.0
  };

  // 3. 清理 1FL 舊標註與舊輔助線
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除視圖內舊有標註與輔助線條`);

  // 4. 繪製 4 條紅線 (Step 0) 與 4 條藍線 (Step 9)
  const linesToDraw = [
    // 紅線 (Step 0)
    { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `1FL-外牆基準紅線-北` },
    { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `1FL-外牆基準紅線-東` },
    { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `1FL-外牆基準紅線-南` },
    { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `1FL-外牆基準紅線-西` },
    // 藍線 (Step 9)
    { startX: globalBounds9.LeftX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `1FL-9間距齊頭藍線-北` },
    { startX: globalBounds9.RightX, startY: globalBounds9.TopY, endX: globalBounds9.RightX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `1FL-9間距齊頭藍線-東` },
    { startX: globalBounds9.RightX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.BottomY, color: { r: 0, g: 100, b: 255 }, label: `1FL-9間距齊頭藍線-南` },
    { startX: globalBounds9.LeftX, startY: globalBounds9.BottomY, endX: globalBounds9.LeftX, endY: globalBounds9.TopY, color: { r: 0, g: 100, b: 255 }, label: `1FL-9間距齊頭藍線-西` }
  ];

  try {
    await client.sendCommand('create_detail_lines', { viewId: viewId, lines: linesToDraw });
    console.log(`✓ 成功繪製 8 條標準基準輔助線（4 紅 ＋ 4 藍）`);
  } catch (e) {}

  // 5. 定義 16 條軸線 ID 清單
  const northContGrids = [765797, 192192, 432845, 432924, 576725, 576798, 576858, 576903, 576963, 1357074, 818495, 821106];
  const northTotalGrids = [765797, 821106]; // 1 軸 與 12 軸

  const eastContGrids = [1474713, 1474775, 1474846, 1474912];
  const eastTotalGrids = [1474713, 1474912]; // D 軸 與 A 軸

  // 9 間距階梯放樣座標定義
  const spanXMax = globalEnv.MaxX + 3000.0;
  const spanXMin = globalEnv.MinX - 3000.0;
  const spanYMax = globalEnv.MaxY + 3000.0;
  const spanYMin = globalEnv.MinY - 3000.0;

  const northColTier1Y = globalEnv.MaxY + 5200.0; // Step 8 (總跨)
  const northColTier2Y = globalEnv.MaxY + 4550.0; // Step 7 (連續)
  const eastColTier1X = globalEnv.MaxX + 5200.0;  // Step 8 (總跨)
  const eastColTier2X = globalEnv.MaxX + 4550.0;  // Step 7 (連續)

  const northWallStep1Y = globalEnv.MaxY + 3250.0; // Step 5 (總長)
  const northWallStep2Y = globalEnv.MaxY + 2600.0; // Step 4 (居室)
  const northWallStep3Y = globalEnv.MaxY + 1950.0; // Step 3 (走廊)

  const eastWallStep1X = globalEnv.MaxX + 3250.0;
  const eastWallStep2X = globalEnv.MaxX + 2600.0;
  const eastWallStep3X = globalEnv.MaxX + 1950.0;

  const westWallStep1X = globalEnv.MinX - 3250.0;
  const westWallStep2X = globalEnv.MinX - 2600.0;
  const westWallStep3X = globalEnv.MinX - 1950.0;

  const southWallStep1Y = globalEnv.MinY - 3250.0;
  const southWallStep2Y = globalEnv.MinY - 2600.0;
  const southWallStep3Y = globalEnv.MinY - 1950.0;

  // 6. 北側與東側 雙層柱心標註 (圓圈端點 + 黑色線條)
  const nTotalRes = await client.sendCommand('create_dimension', {
    viewId: viewId, gridIds: northTotalGrids,
    startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
    dimensionTypeId: typeIdColumn
  });
  if (nTotalRes.success && nTotalRes.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdColumn });
    console.log(`  ✓ [北側柱心 Step 8 總跨] ID: ${nTotalRes.data.DimensionId}`);
  }

  const nContRes = await client.sendCommand('create_dimension', {
    viewId: viewId, gridIds: northContGrids,
    startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
    dimensionTypeId: typeIdColumn
  });
  if (nContRes.success && nContRes.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdColumn });
    console.log(`  ✓ [北側柱心 Step 7 連續] ID: ${nContRes.data.DimensionId}`);
  }

  const eTotalRes = await client.sendCommand('create_dimension', {
    viewId: viewId, gridIds: eastTotalGrids,
    startX: eastColTier1X, startY: spanYMin, endX: eastColTier1X, endY: spanYMax,
    dimensionTypeId: typeIdColumn
  });
  if (eTotalRes.success && eTotalRes.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdColumn });
    console.log(`  ✓ [東側柱心 Step 8 總跨] ID: ${eTotalRes.data.DimensionId}`);
  }

  const eContRes = await client.sendCommand('create_dimension', {
    viewId: viewId, gridIds: eastContGrids,
    startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
    dimensionTypeId: typeIdColumn
  });
  if (eContRes.success && eContRes.data?.DimensionId) {
    await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdColumn });
    console.log(`  ✓ [東側柱心 Step 7 連續] ID: ${eContRes.data.DimensionId}`);
  }

  // 7. 收集 >=140mm 直線主牆
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
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
  console.log(`\n✓ 收集到 ${mainWalls.length} 道 >=15CM 主牆 (垂直 ${vertWalls.length}, 水平 ${horizWalls.length})`);

  // 輔助函式：建立牆心標註線
  async function createWallDim(sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isTotalOnly) {
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
      console.log(`  ✓ [${sideName} Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId} (${segmentDesc})`);
      return res.data.DimensionId;
    }
    return null;
  }

  // 8. 四向 3 層牆心標註放樣
  console.log('\n--- 執行四向 3 層牆心標註放樣 ---');
  await createWallDim('東側', 1, '外牆總長', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep1X, true);
  await createWallDim('東側', 2, '居室主隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 12000), true, eastWallStep2X, false);
  await createWallDim('東側', 3, '走廊機能隔間', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 25000), true, eastWallStep3X, false);

  await createWallDim('西側', 1, '外牆總長', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep1X, true);
  await createWallDim('西側', 2, '居室主隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 12000), true, westWallStep2X, false);
  await createWallDim('西側', 3, '走廊機能隔間', horizWalls.filter(w => w.minX < globalEnv.MinX + 25000), true, westWallStep3X, false);

  await createWallDim('北側', 1, '外牆總長', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep1Y, true);
  await createWallDim('北側', 2, '居室主隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 15000), false, northWallStep2Y, false);
  await createWallDim('北側', 3, '走廊機能隔間', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 30000), false, northWallStep3Y, false);

  // 南側牆心：取 1FL 實際存在的南側主牆
  const southVertWalls = vertWalls.filter(w => w.minY < -55000);
  await createWallDim('南側', 1, '外牆總長', southVertWalls, false, southWallStep1Y, true);
  await createWallDim('南側', 2, '居室主隔間', vertWalls.filter(w => w.minY < -50000), false, southWallStep2Y, false);
  await createWallDim('南側', 3, '走廊機能隔間', vertWalls.filter(w => w.minY < -40000), false, southWallStep3Y, false);

  console.log('\n================================================================');
  console.log('=== 🎉 【1FL-籌設平面圖】標註建立完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
