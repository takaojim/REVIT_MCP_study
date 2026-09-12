import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-all-plan50-perfect-' + Date.now();
  await client.connect();

  console.log('========================================================================');
  console.log('=== 【規劃樓板平面圖 1/50】全視圖 7 間距、紅藍基準線框與柱心/牆心標註 ===');
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
  const typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心')?.DimensionTypeId || 708965;

  console.log(`📌 標註型式確認:`);
  console.log(`   - 柱心-上右 (北/東): ID ${typeIdUpRight}`);
  console.log(`   - 牆心標註: ID ${typeIdWall}\n`);

  // 2. 1:50 比例模矩換算
  // 圖紙 6.5mm * 50 = 325.0 mm (每間距模型尺寸)
  // 7 個間距 = 7 * 325.0 mm = 2,275.0 mm
  const stepMm = 325.0;
  const offset7 = 2275.0;

  // 3. 全區實體外框基準視圖 (2FL)
  const globalRefViewId = 748034;
  console.log(`⚙️ 正在以 2FL 視圖計算全區實體最大包絡基準線...`);
  const baseAlign = await client.sendCommand('align_plan_grids', {
    viewId: globalRefViewId,
    offsetMm: offset7,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const globalEnv = baseAlign.data?.PhysicalEnvelopeMm || {
    MinX: 816.8, MaxX: 15986.8, MinY: -15020.4, MaxY: 1649.6
  };
  console.log('✓ 全區基準實體包絡 (Step 0 外牆基準):', globalEnv);

  // 7 間距齊頭藍線座標 (Step 7 = 2275mm)
  const topBlueY = globalEnv.MaxY + offset7;
  const botBlueY = globalEnv.MinY - offset7;
  const leftBlueX = globalEnv.MinX - offset7;
  const rightBlueX = globalEnv.MaxX + offset7;

  // 階梯層次定位座標 (嚴格收在紅線與藍線之間，每階 325mm)
  // Step 7: +2275mm (藍線與氣泡圓圈)
  // Step 6: +1950mm (柱心總跨 Tier 1)
  // Step 5: +1625mm (柱心連續分段 Tier 2)
  // Step 4: +1300mm (外牆 / 女兒牆心)
  // Step 3: +975mm (居室 / 12cm 輕隔間牆心)
  // Step 2: +650mm (5cm 庫版 / 細部機能牆心)
  // Step 0: +0mm (外牆基準紅線)

  const northColTier1Y = globalEnv.MaxY + 6.0 * stepMm; // Step 6 = +1950mm
  const northColTier2Y = globalEnv.MaxY + 5.0 * stepMm; // Step 5 = +1625mm
  const northWallStep4Y = globalEnv.MaxY + 4.0 * stepMm; // Step 4 = +1300mm
  const northWallStep3Y = globalEnv.MaxY + 3.0 * stepMm; // Step 3 = +975mm
  const northWallStep2Y = globalEnv.MaxY + 2.0 * stepMm; // Step 2 = +650mm

  const eastColTier1X  = globalEnv.MaxX + 6.0 * stepMm;  // Step 6 = +1950mm
  const eastColTier2X  = globalEnv.MaxX + 5.0 * stepMm;  // Step 5 = +1625mm
  const eastWallStep4X  = globalEnv.MaxX + 4.0 * stepMm;  // Step 4 = +1300mm
  const eastWallStep3X  = globalEnv.MaxX + 3.0 * stepMm;  // Step 3 = +975mm
  const eastWallStep2X  = globalEnv.MaxX + 2.0 * stepMm;  // Step 2 = +650mm

  const southWallStep4Y = globalEnv.MinY - 4.0 * stepMm; // Step 4 = -1300mm
  const southWallStep3Y = globalEnv.MinY - 3.0 * stepMm; // Step 3 = -975mm
  const southWallStep2Y = globalEnv.MinY - 2.0 * stepMm; // Step 2 = -650mm

  const westWallStep4X  = globalEnv.MinX - 4.0 * stepMm;  // Step 4 = -1300mm
  const westWallStep3X  = globalEnv.MinX - 3.0 * stepMm;  // Step 3 = -975mm
  const westWallStep2X  = globalEnv.MinX - 2.0 * stepMm;  // Step 2 = -650mm

  const spanXMin = globalEnv.MinX - 1000.0;
  const spanXMax = globalEnv.MaxX + 1000.0;
  const spanYMin = globalEnv.MinY - 1000.0;
  const spanYMax = globalEnv.MaxY + 1000.0;

  // 正確軸線歸屬：
  // 北側 (上方): 垂直向軸線 4, 3, 2, 1 (向量東向西: 4 -> 1)
  const northContinuousGrids = [596080, 432630, 432966, 192066]; // 4 -> 3 -> 2 -> 1
  const northTotalGrids = [596080, 192066]; // 4, 1
  // 東側 (右側): 水平向軸線 D, C, B, A (向量南向北: D -> A)
  const eastContinuousGrids = [611573, 432924, 432845, 192192]; // D -> C -> B -> A
  const eastTotalGrids = [611573, 192192]; // D, A

  // 牆心標註建立輔助函式
  async function createWallDim(viewId, sideName, stepNum, desc, walls, isVerticalAxis, dimCoord) {
    if (!walls || walls.length < 2) return null;
    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    walls.sort((a, b) => a[sortKey] - b[sortKey]);

    // 共線去重：中心座標差 <= 35mm 自動合併
    let unique = [];
    for (const w of walls) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > 35.0) {
        unique.push(w);
      }
    }
    if (unique.length < 2) return null;

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
      console.log(`    ✓ [${sideName} Step ${stepNum} (${desc})] ID: ${res.data.DimensionId} (${unique.length} 道牆心)`);
      return res.data.DimensionId;
    }
    return null;
  }

  for (const v of targetViews) {
    console.log(`\n========================================================================`);
    console.log(`🚀 正在處理視圖: [${v.name}] (ID: ${v.id})...`);
    console.log(`========================================================================`);

    // (A) 軸線 7 間距齊頭整列 (延伸 2,275 mm，配置 A：北東開氣泡圓圈)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      offsetMm: offset7,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });
    console.log(`  ✓ 軸線齊頭整列完成 (延伸 ${offset7} mm，氣泡圓圈定位在 Step 7 藍線)`);

    // (B) 清除舊有尺寸與舊輔助線
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 200 });
    for (const d of oldDims.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id, maxCount: 200 });
    for (const l of oldLines.data?.Elements || []) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }
    console.log(`  ✓ 舊尺寸標註與輔助線清理完成`);

    // (C) 繪製 4 條外牆基準紅線 (Step 0) 與 4 條 7 間距齊頭藍線 (Step 7 = 2275mm)
    const linesToDraw = [
      // 紅線 (Step 0 外牆實體邊界)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },
      // 藍線 (Step 7 齊頭藍線框，精確對齊軸線端點與氣泡圓圈)
      { startX: leftBlueX, startY: topBlueY, endX: rightBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-北` },
      { startX: rightBlueX, startY: topBlueY, endX: rightBlueX, endY: botBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-東` },
      { startX: rightBlueX, startY: botBlueY, endX: leftBlueX, endY: botBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-南` },
      { startX: leftBlueX, startY: botBlueY, endX: leftBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-7間距齊頭藍線-西` }
    ];

    await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
    console.log(`  ✓ 🎨 4 條紅線 (Step 0) 與 4 條藍線 (Step 7 = 2275mm) 繪製完成`);

    // (D) 北側與東側 雙層柱心標註 (Step 6 總跨, Step 5 連續)
    // 1. 北側 (垂直軸線 4, 3, 2, 1)
    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nTotal.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotal.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [北側 Step 6 (柱心總長 4-1)] ID: ${nTotal.data.DimensionId}`);
    }

    const nCont = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContinuousGrids,
      startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nCont.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nCont.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [北側 Step 5 (柱間距分段 4-3-2-1)] ID: ${nCont.data.DimensionId}`);
    }

    // 2. 東側 (水平軸線 D, C, B, A)
    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastTotalGrids,
      startX: eastColTier1X, startY: spanYMin, endX: eastColTier1X, endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eTotal.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eTotal.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [東側 Step 6 (柱心總深 D-A)] ID: ${eTotal.data.DimensionId}`);
    }

    const eCont = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastContinuousGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eCont.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eCont.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [東側 Step 5 (柱間距分段 D-C-B-A)] ID: ${eCont.data.DimensionId}`);
    }

    // (E) 收集並篩選目標牆體（納入 5cm 庫版、12cm 輕隔間、15cm 主牆/外牆、屋頂女兒牆）
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
    const targetWalls = [];
    let c5 = 0, c12 = 0, c15 = 0, cParapet = 0;

    for (const w of wallsRes.data?.Elements || []) {
      let wInfo = null;
      try {
        const res = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
        if (res.success && res.data) wInfo = res.data;
      } catch (e) { continue; }
      if (!wInfo || wInfo.Length < 300) continue;

      const name = (wInfo.Name || '').toLowerCase();
      const type = (wInfo.WallType || '').toLowerCase();
      const thk = wInfo.Thickness;
      const isRoof = v.name.includes('RF') || v.name.includes('TRFL');

      let cat = null;
      if (Math.abs(thk - 50) <= 10 || name.includes('庫版') || type.includes('庫版') || name.includes('5cm')) {
        cat = '5cm庫版'; c5++;
      } else if (Math.abs(thk - 120) <= 10 || name.includes('12cm') || type.includes('12cm') || name.includes('輕隔間')) {
        cat = '12cm輕隔間'; c12++;
      } else if (Math.abs(thk - 150) <= 15 || Math.abs(thk - 170) <= 15 || name.includes('15') || name.includes('17')) {
        cat = '15cm主牆'; c15++;
      } else if (isRoof || name.includes('女兒') || type.includes('女兒') || wInfo.Level?.includes('R1FL')) {
        cat = '女兒牆'; cParapet++;
      }

      if (cat) {
        targetWalls.push({
          id: wInfo.ElementId,
          name: wInfo.Name,
          category: cat,
          startX: wInfo.StartX, startY: wInfo.StartY, endX: wInfo.EndX, endY: wInfo.EndY,
          centerX: (wInfo.StartX + wInfo.EndX) / 2.0,
          centerY: (wInfo.StartY + wInfo.EndY) / 2.0,
          minX: Math.min(wInfo.StartX, wInfo.EndX), maxX: Math.max(wInfo.StartX, wInfo.EndX),
          minY: Math.min(wInfo.StartY, wInfo.EndY), maxY: Math.max(wInfo.StartY, wInfo.EndY),
          isVert: Math.abs(wInfo.StartX - wInfo.EndX) < 40.0,
          isHoriz: Math.abs(wInfo.StartY - wInfo.EndY) < 40.0
        });
      }
    }

    console.log(`  ✓ 篩選出 ${targetWalls.length} 道目標牆體 (5cm庫版:${c5}, 12cm輕隔間:${c12}, 15cm主牆:${c15}, 女兒牆:${cParapet})`);

    const vertWalls = targetWalls.filter(w => w.isVert);
    const horizWalls = targetWalls.filter(w => w.isHoriz);

    // (F) 四向階梯式牆心標註建立 (Step 4, Step 3, Step 2)
    // 1. 北側 (North): 標註垂直牆心 X 座標
    await createWallDim(v.id, '北側', 4, '外牆/主要結構牆心', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 3000), false, northWallStep4Y);
    await createWallDim(v.id, '北側', 3, '居室/12cm輕隔間牆心', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 8000), false, northWallStep3Y);
    await createWallDim(v.id, '北側', 2, '5cm庫版/細部機能牆心', vertWalls, false, northWallStep2Y);

    // 2. 東側 (East): 標註水平牆心 Y 座標
    await createWallDim(v.id, '東側', 4, '外牆/主要結構牆心', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 3000), true, eastWallStep4X);
    await createWallDim(v.id, '東側', 3, '居室/12cm輕隔間牆心', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 8000), true, eastWallStep3X);
    await createWallDim(v.id, '東側', 2, '5cm庫版/細部機能牆心', horizWalls, true, eastWallStep2X);

    // 3. 南側 (South): 標註垂直牆心 X 座標
    await createWallDim(v.id, '南側', 4, '外牆/主要結構牆心', vertWalls.filter(w => w.minY < globalEnv.MinY + 3000), false, southWallStep4Y);
    await createWallDim(v.id, '南側', 3, '居室/12cm輕隔間牆心', vertWalls.filter(w => w.minY < globalEnv.MinY + 8000), false, southWallStep3Y);
    await createWallDim(v.id, '南側', 2, '5cm庫版/細部機能牆心', vertWalls, false, southWallStep2Y);

    // 4. 西側 (West): 標註水平牆心 Y 座標
    await createWallDim(v.id, '西側', 4, '外牆/主要結構牆心', horizWalls.filter(w => w.minX < globalEnv.MinX + 3000), true, westWallStep4X);
    await createWallDim(v.id, '西側', 3, '居室/12cm輕隔間牆心', horizWalls.filter(w => w.minX < globalEnv.MinX + 8000), true, westWallStep3X);
    await createWallDim(v.id, '西側', 2, '5cm庫版/細部機能牆心', horizWalls, true, westWallStep2X);
  }

  console.log('\n========================================================================');
  console.log('🎉 所有 6 個視圖已全數完成 7 間隔藍線、外牆紅線、氣泡圓圈對齊與完整標註！');
  console.log('========================================================================');

  await client.disconnect();
}

main().catch(console.error);
