import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-plan50-7steps-' + Date.now();
  await client.connect();

  console.log('========================================================================');
  console.log('=== 【規劃樓板平面圖 1/50】7 個間隔 柱間距 ＋ 擴充牆心標註全視圖批次執行 ===');
  console.log('========================================================================\n');

  // 目標 6 個 1/50 規劃平面視圖
  const targetViews = [
    { id: 650463, name: '1FL 規劃 50' },
    { id: 748034, name: '2FL規劃 50' },
    { id: 748079, name: '3FL規劃 50' },
    { id: 748125, name: '4FL規劃 50' },
    { id: 748164, name: 'RFL規劃 50' },
    { id: 748207, name: 'TRFL規劃 50' }
  ];

  // 1. 動態解析標準標註型式
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 689724;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 689732;
  const typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心')?.DimensionTypeId || 708965;

  console.log(`📌 標註型式確認:`);
  console.log(`   - 柱心-上右 (北/東): ID ${typeIdUpRight}`);
  console.log(`   - 柱心-下右 (南/西): ID ${typeIdDownRight}`);
  console.log(`   - 牆心標註: ID ${typeIdWall}\n`);

  // 2. 以 2FL (ID: 748034) 作為全區統一實體包絡基準視圖
  const globalRefViewId = 748034;
  const stepCount = 7.0;
  const stepMm = 325.0; // 6.5mm * 50 = 325.0mm (1:50 比例模矩)

  console.log(`⚙️ 正在以 2FL 視圖計算全區實體最大包絡線 (Step 7 = ${stepCount * stepMm} mm)...`);
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefViewId,
    stepCount: stepCount,
    stepMm: stepMm,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: 816.8, MaxX: 15986.8, MinY: -15020.4, MaxY: 1649.6
  };
  console.log('✓ 基準實體包絡線 (PhysicalEnvelopeMm):', globalEnv);

  // 階梯座標計算 (依 7 間隔模矩，各層均在建物外側)
  // Step 7: 軸線端點 (Max + 2275)
  // Step 6: 柱心總跨 Tier 1 (Max + 1950)
  // Step 5: 柱心連續 Tier 2 (Max + 1625)
  // Step 4: 外牆 / 女兒牆 (Max + 1300)
  // Step 3: 居室主隔間 / 12cm / 15cm (Max + 975)
  // Step 2: 5cm庫版 / 細部機能隔間 (Max + 650)
  // Step 0: 實體外牆外緣 (Max + 0)

  const northColTier1Y = globalEnv.MaxY + 6 * stepMm; // Step 6 = +1950
  const northColTier2Y = globalEnv.MaxY + 5 * stepMm; // Step 5 = +1625
  const northWallStep4Y = globalEnv.MaxY + 4 * stepMm; // Step 4 = +1300
  const northWallStep3Y = globalEnv.MaxY + 3 * stepMm; // Step 3 = +975
  const northWallStep2Y = globalEnv.MaxY + 2 * stepMm; // Step 2 = +650

  const eastColTier1X = globalEnv.MaxX + 6 * stepMm;  // Step 6 = +1950
  const eastColTier2X = globalEnv.MaxX + 5 * stepMm;  // Step 5 = +1625
  const eastWallStep4X = globalEnv.MaxX + 4 * stepMm;  // Step 4 = +1300
  const eastWallStep3X = globalEnv.MaxX + 3 * stepMm;  // Step 3 = +975
  const eastWallStep2X = globalEnv.MaxX + 2 * stepMm;  // Step 2 = +650

  const southWallStep4Y = globalEnv.MinY - 4 * stepMm; // Step 4 = -1300
  const southWallStep3Y = globalEnv.MinY - 3 * stepMm; // Step 3 = -975
  const southWallStep2Y = globalEnv.MinY - 2 * stepMm; // Step 2 = -650

  const westWallStep4X = globalEnv.MinX - 4 * stepMm;  // Step 4 = -1300
  const westWallStep3X = globalEnv.MinX - 3 * stepMm;  // Step 3 = -975
  const westWallStep2X = globalEnv.MinX - 2 * stepMm;  // Step 2 = -650

  // 尺寸線跨度端點 (超出包絡線兩端 1500mm 留白)
  const spanXMin = globalEnv.MinX - 1500.0;
  const spanXMax = globalEnv.MaxX + 1500.0;
  const spanYMin = globalEnv.MinY - 1500.0;
  const spanYMax = globalEnv.MaxY + 1500.0;

  // 牆心標註建立輔助函式
  async function createWallDim(viewId, sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isTotalOnly) {
    if (!walls || walls.length < 2) return null;
    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    walls.sort((a, b) => a[sortKey] - b[sortKey]);

    // 共線去重：中心座標差 <= 35mm 合併
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
      const segmentDesc = isTotalOnly ? '外牆單一總長' : `${unique.length - 1} 個分段`;
      console.log(`    ✓ [${sideName} Step ${layerNum} (${desc})] ID: ${res.data.DimensionId} (${segmentDesc}, ${unique.length} 道牆心)`);
      return res.data.DimensionId;
    }
    return null;
  }

  const results = [];

  for (const v of targetViews) {
    console.log(`\n========================================================================`);
    console.log(`🚀 正在處理視圖: [${v.name}] (ID: ${v.id})...`);
    console.log(`========================================================================`);

    // (A) 軸線 7 間隔四向齊頭整列 (Configuration A: 北東圓圈開，南西關)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      stepCount: stepCount,
      stepMm: stepMm,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });
    console.log(`  ✓ 軸線整列完成 (齊頭延伸 ${stepCount * stepMm} mm, ${alignRes.data?.AlignedGridsCount || 0} 條軸線)`);

    // (B) 清理視圖內舊有 TABC 尺寸標註
    const oldDimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 1000 });
    const oldDims = oldDimsRes.data?.Elements || [];
    let deletedCount = 0;
    for (const d of oldDims) {
      // 清理 TABC 系列或由腳本建立的尺寸
      if (d.Name?.includes('TABC') || d.DimensionType?.includes('TABC') || d.TypeName?.includes('TABC')) {
        try {
          await client.sendCommand('delete_element', { elementId: d.ElementId });
          deletedCount++;
        } catch (e) {}
      }
    }
    console.log(`  ✓ 已清除視圖內 ${deletedCount} 條舊有 TABC 尺寸標註`);

    // (C) 獲取視圖軸線並排序
    const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: v.id, maxCount: 100 });
    const grids = gridsRes.data?.Elements || [];

    // 依名稱或 ID 分離垂直軸線 (A, B, C, D) 與水平軸線 (1, 2, 3, 4)
    // 垂直軸線: 192192(A), 432845(B), 432924(C), 611573(D)
    const vertGridIds = [192192, 432845, 432924, 611573].filter(id => grids.some(g => g.ElementId === id));
    // 水平軸線: 192066(1), 432966(2), 432630(3), 596080(4)
    const horizGridIds = [192066, 432966, 432630, 596080].filter(id => grids.some(g => g.ElementId === id));

    // (D) 建立北側 (North) 雙層柱心標註
    if (vertGridIds.length >= 2) {
      // Step 6: 總跨 Tier 1
      const nTotalRes = await client.sendCommand('create_dimension', {
        viewId: v.id,
        gridIds: [vertGridIds[0], vertGridIds[vertGridIds.length - 1]],
        startX: spanXMax, startY: northColTier1Y,
        endX: spanXMin, endY: northColTier1Y,
        dimensionTypeId: typeIdUpRight
      });
      if (nTotalRes.success && nTotalRes.data?.DimensionId) {
        await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdUpRight });
        console.log(`    ✓ [北側 Step 6 (柱心總長)] ID: ${nTotalRes.data.DimensionId}`);
      }

      // Step 5: 連續分段 Tier 2
      const nContRes = await client.sendCommand('create_dimension', {
        viewId: v.id,
        gridIds: vertGridIds,
        startX: spanXMax, startY: northColTier2Y,
        endX: spanXMin, endY: northColTier2Y,
        dimensionTypeId: typeIdUpRight
      });
      if (nContRes.success && nContRes.data?.DimensionId) {
        await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdUpRight });
        console.log(`    ✓ [北側 Step 5 (柱間距分段)] ID: ${nContRes.data.DimensionId}`);
      }
    }

    // (E) 建立東側 (East) 雙層柱心標註
    if (horizGridIds.length >= 2) {
      // Step 6: 總跨 Tier 1
      const eTotalRes = await client.sendCommand('create_dimension', {
        viewId: v.id,
        gridIds: [horizGridIds[0], horizGridIds[horizGridIds.length - 1]],
        startX: eastColTier1X, startY: spanYMin,
        endX: eastColTier1X, endY: spanYMax,
        dimensionTypeId: typeIdUpRight
      });
      if (eTotalRes.success && eTotalRes.data?.DimensionId) {
        await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdUpRight });
        console.log(`    ✓ [東側 Step 6 (柱心總長)] ID: ${eTotalRes.data.DimensionId}`);
      }

      // Step 5: 連續分段 Tier 2
      const eContRes = await client.sendCommand('create_dimension', {
        viewId: v.id,
        gridIds: horizGridIds,
        startX: eastColTier2X, startY: spanYMin,
        endX: eastColTier2X, endY: spanYMax,
        dimensionTypeId: typeIdUpRight
      });
      if (eContRes.success && eContRes.data?.DimensionId) {
        await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdUpRight });
        console.log(`    ✓ [東側 Step 5 (柱間距分段)] ID: ${eContRes.data.DimensionId}`);
      }
    }

    // (F) 查詢並過濾牆體（納入 5cm 庫版、12cm 輕隔間、15cm 牆、女兒牆）
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const allWalls = wallsRes.data?.Elements || [];

    const targetWalls = [];
    let count5cm = 0, count12cm = 0, count15cm = 0, countParapet = 0;

    for (const w of allWalls) {
      let wInfo = null;
      try {
        const res = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
        if (res.success && res.data) wInfo = res.data;
      } catch (e) {
        continue;
      }
      if (!wInfo) continue;

      // 門檻 1: 排除長度 < 300mm 碎牆
      if (wInfo.Length < 300) continue;

      const name = (wInfo.Name || '').toLowerCase();
      const type = (wInfo.WallType || '').toLowerCase();
      const thk = wInfo.Thickness;
      const isRoofView = v.name.includes('RF') || v.name.includes('RFL') || v.name.includes('TRFL');

      let matchedCategory = null;

      // 1. 5cm 庫版
      if (Math.abs(thk - 50) <= 10 || name.includes('庫版') || type.includes('庫版') || name.includes('5cm') || type.includes('5cm')) {
        matchedCategory = '5cm庫版';
        count5cm++;
      }
      // 2. 12cm 輕隔間
      else if (Math.abs(thk - 120) <= 10 || name.includes('12cm') || type.includes('12cm') || name.includes('輕隔間') || type.includes('輕隔間')) {
        matchedCategory = '12cm輕隔間';
        count12cm++;
      }
      // 3. 15cm 主牆 / 17cm 鋼板外牆
      else if (Math.abs(thk - 150) <= 15 || Math.abs(thk - 170) <= 15 || name.includes('15') || type.includes('15') || name.includes('17') || type.includes('17')) {
        matchedCategory = '15cm主牆';
        count15cm++;
      }
      // 4. 女兒牆
      else if (isRoofView || name.includes('女兒') || type.includes('女兒') || wInfo.Level?.includes('R1FL')) {
        matchedCategory = '女兒牆';
        countParapet++;
      }

      if (matchedCategory) {
        const isVert = Math.abs(wInfo.StartX - wInfo.EndX) < 40.0;
        const isHoriz = Math.abs(wInfo.StartY - wInfo.EndY) < 40.0;

        targetWalls.push({
          id: wInfo.ElementId,
          name: wInfo.Name,
          type: wInfo.WallType,
          thickness: thk,
          category: matchedCategory,
          length: wInfo.Length,
          startX: wInfo.StartX, startY: wInfo.StartY,
          endX: wInfo.EndX, endY: wInfo.EndY,
          centerX: (wInfo.StartX + wInfo.EndX) / 2.0,
          centerY: (wInfo.StartY + wInfo.EndY) / 2.0,
          minX: Math.min(wInfo.StartX, wInfo.EndX),
          maxX: Math.max(wInfo.StartX, wInfo.EndX),
          minY: Math.min(wInfo.StartY, wInfo.EndY),
          maxY: Math.max(wInfo.StartY, wInfo.EndY),
          isVert, isHoriz
        });
      }
    }

    console.log(`  ✓ 篩選出 ${targetWalls.length} 道目標牆體 (5cm庫版:${count5cm}, 12cm輕隔間:${count12cm}, 15cm主牆:${count15cm}, 女兒牆:${countParapet})`);

    const vertWalls = targetWalls.filter(w => w.isVert);
    const horizWalls = targetWalls.filter(w => w.isHoriz);

    // (G) 四向階梯式牆心標註建立
    // 1. 北側 (North): 標註垂直主牆與隔間牆之 X 座標
    await createWallDim(v.id, '北側', 4, '外牆/主要結構牆心', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 3000), false, northWallStep4Y, false);
    await createWallDim(v.id, '北側', 3, '居室/12cm輕隔間牆心', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep3Y, false);
    await createWallDim(v.id, '北側', 2, '5cm庫版/內部細部牆心', vertWalls, false, northWallStep2Y, false);

    // 2. 東側 (East): 標註水平主牆與隔間牆之 Y 座標
    await createWallDim(v.id, '東側', 4, '外牆/主要結構牆心', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 3000), true, eastWallStep4X, false);
    await createWallDim(v.id, '東側', 3, '居室/12cm輕隔間牆心', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep3X, false);
    await createWallDim(v.id, '東側', 2, '5cm庫版/內部細部牆心', horizWalls, true, eastWallStep2X, false);

    // 3. 南側 (South): 標註垂直主牆與隔間牆之 X 座標
    await createWallDim(v.id, '南側', 4, '外牆/主要結構牆心', vertWalls.filter(w => w.minY < globalEnv.MinY + 3000), false, southWallStep4Y, false);
    await createWallDim(v.id, '南側', 3, '居室/12cm輕隔間牆心', vertWalls.filter(w => w.minY < globalEnv.MinY + 8000), false, southWallStep3Y, false);
    await createWallDim(v.id, '南側', 2, '5cm庫版/內部細部牆心', vertWalls, false, southWallStep2Y, false);

    // 4. 西側 (West): 標註水平主牆與隔間牆之 Y 座標
    await createWallDim(v.id, '西側', 4, '外牆/主要結構牆心', horizWalls.filter(w => w.minX < globalEnv.MinX + 3000), true, westWallStep4X, false);
    await createWallDim(v.id, '西側', 3, '居室/12cm輕隔間牆心', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep3X, false);
    await createWallDim(v.id, '西側', 2, '5cm庫版/內部細部牆心', horizWalls, true, westWallStep2X, false);

    results.push({
      viewId: v.id,
      viewName: v.name,
      wallCount: targetWalls.length
    });
  }

  console.log('\n========================================================================');
  console.log('🎉 所有 6 個 1/50 規劃平面圖視圖柱間距與擴充牆心標註全數處理完成！');
  console.log('========================================================================');

  await client.disconnect();
}

main().catch(console.error);
