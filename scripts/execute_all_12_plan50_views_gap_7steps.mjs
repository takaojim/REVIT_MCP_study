import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-all-12-plan50-gap-' + Date.now();
  await client.connect();

  console.log('========================================================================');
  console.log('=== 【規劃樓板平面圖 1/50】全 12 視圖（含二次）標準階梯標註重做作業 ===');
  console.log('===  規格：7間距齊頭藍線、實體外牆紅線、空一個間隔(Step 4)、外牆心總長(Step 3) ===');
  console.log('========================================================================\n');

  // 全部 12 個 1/50 平面視圖（標準 6 個 + 二次 6 個）
  const targetViews = [
    // 標準規劃圖 50 (6個)
    { id: 650463, name: '1FL 規劃 50' },
    { id: 748034, name: '2FL規劃 50' },
    { id: 748079, name: '3FL規劃 50' },
    { id: 748125, name: '4FL規劃 50' },
    { id: 748164, name: 'RFL規劃 50' },
    { id: 748207, name: 'TRFL規劃 50' },
    // 二次規劃圖 50 (6個)
    { id: 806391, name: '1FL 規劃 50-二次' },
    { id: 806446, name: '2FL規劃 50-二次' },
    { id: 806485, name: '3FL規劃 50-二次' },
    { id: 806523, name: '4FL規劃 50-二次' },
    { id: 806551, name: 'RFL規劃 50-二次' },
    { id: 806583, name: '1FL 規劃 50-夾層-二次' }
  ];

  // 1. 動態解析標準標註型式
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 689724;
  const typeIdWall = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心')?.DimensionTypeId || 708965;

  console.log(`📌 標註型式確認:`);
  console.log(`   - 柱心-上右 (北/東): ID ${typeIdUpRight}`);
  console.log(`   - 牆心標註: ID ${typeIdWall}\n`);

  // 2. 1:50 比例模矩換算 (Scale-Aware)
  // 紙上標準模矩 6.5mm * 50 = 325.0 mm (每間距模型尺寸)
  // 7 個間距 = 7 * 325.0 mm = 2,275.0 mm (Step 7 齊頭藍線與氣泡下緣基準線)
  const stepMm = 325.0;
  const offset7 = 2275.0;

  // 3. 全區實體外框基準視圖 (2FL)
  const globalRefViewId = 748034;
  console.log(`⚙️ 正在以 2FL 視圖 (ID: ${globalRefViewId}) 計算全區實體最大包絡基準線...`);
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

  // 階梯層次定位座標（嚴格依據技能說明 7 間距階梯模矩體系）：
  // Step 7: +2275mm (齊頭藍線框，氣泡圓標下緣基準線)
  // Step 6: +1950mm (柱心 Tier 1 總跨)
  // Step 5: +1625mm (柱心 Tier 2 連續柱心)
  // Step 4: +1300mm 【空一個間隔 (Empty Gap / 留白隔離帶)】 -> 無任何標註！
  // Step 3: +975mm  【牆心第 1 層 (靠近間隔) ＝ 最外層牆心總長 (isTotalOnly: true)】
  // Step 2: +650mm  【牆心第 2 層 ＝ 居室主隔間 / 12cm 輕隔間】
  // Step 1: +325mm  【牆心第 3 層 ＝ 5cm 庫版 / 走廊細部隔間 (若無則留白)】
  // Step 0: +0mm    【全區實體外牆紅線基準】

  const northColTier1Y = globalEnv.MaxY + 6.0 * stepMm; // Step 6 = +1950mm
  const northColTier2Y = globalEnv.MaxY + 5.0 * stepMm; // Step 5 = +1625mm
  // Step 4 = +1300mm 留空隔
  const northWallStep3Y = globalEnv.MaxY + 3.0 * stepMm; // Step 3 = +975mm (最外層牆心總長)
  const northWallStep2Y = globalEnv.MaxY + 2.0 * stepMm; // Step 2 = +650mm (居室主隔間/12cm輕隔間)
  const northWallStep1Y = globalEnv.MaxY + 1.0 * stepMm; // Step 1 = +325mm (5cm庫版/走廊細部隔間)

  const eastColTier1X  = globalEnv.MaxX + 6.0 * stepMm;  // Step 6 = +1950mm
  const eastColTier2X  = globalEnv.MaxX + 5.0 * stepMm;  // Step 5 = +1625mm
  // Step 4 = +1300mm 留空隔
  const eastWallStep3X  = globalEnv.MaxX + 3.0 * stepMm;  // Step 3 = +975mm (最外層牆心總長)
  const eastWallStep2X  = globalEnv.MaxX + 2.0 * stepMm;  // Step 2 = +650mm (居室主隔間/12cm輕隔間)
  const eastWallStep1X  = globalEnv.MaxX + 1.0 * stepMm;  // Step 1 = +325mm (5cm庫版/走廊細部隔間)

  // 南側與西側
  const southWallStep3Y = globalEnv.MinY - 3.0 * stepMm; // Step 3 = -975mm (最外層牆心總長)
  const southWallStep2Y = globalEnv.MinY - 2.0 * stepMm; // Step 2 = -650mm (居室主隔間/12cm輕隔間)
  const southWallStep1Y = globalEnv.MinY - 1.0 * stepMm; // Step 1 = -325mm (5cm庫版/走廊細部隔間)

  const westWallStep3X  = globalEnv.MinX - 3.0 * stepMm;  // Step 3 = -975mm (最外層牆心總長)
  const westWallStep2X  = globalEnv.MinX - 2.0 * stepMm;  // Step 2 = -650mm (居室主隔間/12cm輕隔間)
  const westWallStep1X  = globalEnv.MinX - 1.0 * stepMm;  // Step 1 = -325mm (5cm庫版/走廊細部隔間)

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
  async function createWallDim(viewId, sideName, stepNum, desc, walls, isVerticalAxis, dimCoord, isTotalOnly = false) {
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

    // 若為 isTotalOnly: true（最外層總長），僅取最左/右或最下/上 2 道外牆中心線！
    let targetWallsList = unique;
    if (isTotalOnly) {
      targetWallsList = [unique[0], unique[unique.length - 1]];
    }

    const minC = Math.min(...targetWallsList.map(w => w[sortKey])) - 1000;
    const maxC = Math.max(...targetWallsList.map(w => w[sortKey])) + 1000;

    let sX, sY, eX, eY;
    if (isVerticalAxis) {
      // 水平向牆體（Y 座標各異），尺寸線為垂直線 X = dimCoord
      sX = dimCoord; sY = minC; eX = dimCoord; eY = maxC;
    } else {
      // 垂直向牆體（X 座標各異），尺寸線為水平線 Y = dimCoord
      sX = maxC; sY = dimCoord; eX = minC; eY = dimCoord;
    }

    const res = await client.sendCommand('create_dimension', {
      viewId: viewId,
      elementIds: targetWallsList.map(w => w.id),
      startX: sX, startY: sY, endX: eX, endY: eY,
      dimensionTypeId: typeIdWall
    });

    if (res.success && res.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: res.data.DimensionId, typeId: typeIdWall });
      console.log(`    ✓ [${sideName} Step ${stepNum} (${desc})] ID: ${res.data.DimensionId} (${targetWallsList.length} 道牆心${isTotalOnly ? ' - 單一總長' : ''})`);
      return res.data.DimensionId;
    }
    return null;
  }

  const resultsSummary = [];

  for (let idx = 0; idx < targetViews.length; idx++) {
    const v = targetViews[idx];
    console.log(`\n========================================================================`);
    console.log(`🚀 [${idx + 1}/12] 正在處理視圖: [${v.name}] (ID: ${v.id})...`);
    console.log(`========================================================================`);

    // (A) 軸線 7 間距齊頭整列 (延伸 2,275 mm，配置 A：北東開氣泡圓圈，南西關閉)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: globalRefViewId,
      offsetMm: offset7,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });
    console.log(`  ✓ 軸線齊頭整列完成 (延伸 ${offset7} mm，氣泡圓圈下緣對齊 Step 7 藍線)`);

    // (B) 清除該視圖舊有尺寸標註與既有輔助線
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 300 });
    let delDimCount = 0;
    for (const d of oldDims.data?.Elements || []) {
      try { 
        await client.sendCommand('delete_element', { elementId: d.ElementId });
        delDimCount++;
      } catch (e) {}
    }
    const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.id, maxCount: 300 });
    let delLineCount = 0;
    for (const l of oldLines.data?.Elements || []) {
      try { 
        await client.sendCommand('delete_element', { elementId: l.ElementId });
        delLineCount++;
      } catch (e) {}
    }
    console.log(`  ✓ 舊尺寸標註 (${delDimCount} 個) 與輔助線 (${delLineCount} 條) 清理完成`);

    // (C) 繪製 4 條實體外牆基準紅線 (Step 0) 與 4 條 7 間距齊頭藍線 (Step 7 = 2275mm)
    const linesToDraw = [
      // 紅線 (Step 0 實體外牆基準線)
      { startX: globalEnv.MinX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-Step0實體外牆紅線-北` },
      { startX: globalEnv.MaxX, startY: globalEnv.MaxY, endX: globalEnv.MaxX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-Step0實體外牆紅線-東` },
      { startX: globalEnv.MaxX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-Step0實體外牆紅線-南` },
      { startX: globalEnv.MinX, startY: globalEnv.MinY, endX: globalEnv.MinX, endY: globalEnv.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-Step0實體外牆紅線-西` },
      // 藍線 (Step 7 齊頭藍線框，精確對齊軸線端點與氣泡圓標)
      { startX: leftBlueX, startY: topBlueY, endX: rightBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-Step7齊頭藍線-北` },
      { startX: rightBlueX, startY: topBlueY, endX: rightBlueX, endY: botBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-Step7齊頭藍線-東` },
      { startX: rightBlueX, startY: botBlueY, endX: leftBlueX, endY: botBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-Step7齊頭藍線-南` },
      { startX: leftBlueX, startY: botBlueY, endX: leftBlueX, endY: topBlueY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-Step7齊頭藍線-西` }
    ];

    const linesRes = await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
    console.log(`  ✓ 🎨 4 條紅線 (Step 0) 與 4 條藍線 (Step 7 = 2275mm) 繪製完成`);

    // (D) 北側與東側 雙層柱心標註 (Step 6 總跨, Step 5 連續)
    let colDimsCreated = 0;
    // 1. 北側 (垂直軸線 4, 3, 2, 1)
    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northTotalGrids,
      startX: spanXMax, startY: northColTier1Y, endX: spanXMin, endY: northColTier1Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nTotal.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotal.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [北側 Step 6 (柱心總長 4-1)] ID: ${nTotal.data.DimensionId}`);
      colDimsCreated++;
    }

    const nCont = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: northContinuousGrids,
      startX: spanXMax, startY: northColTier2Y, endX: spanXMin, endY: northColTier2Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nCont.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nCont.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [北側 Step 5 (柱心分段 4-3-2-1)] ID: ${nCont.data.DimensionId}`);
      colDimsCreated++;
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
      colDimsCreated++;
    }

    const eCont = await client.sendCommand('create_dimension', {
      viewId: v.id, gridIds: eastContinuousGrids,
      startX: eastColTier2X, startY: spanYMin, endX: eastColTier2X, endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eCont.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eCont.data.DimensionId, typeId: typeIdUpRight });
      console.log(`    ✓ [東側 Step 5 (柱心分段 D-C-B-A)] ID: ${eCont.data.DimensionId}`);
      colDimsCreated++;
    }

    console.log(`  ✓ 柱心標註 (Step 6 總跨 + Step 5 分段) 完成，【Step 4 (+1300mm) 嚴格留空一個間隔】`);

    // (E) 收集並篩選目標牆體（涵蓋 5cm 庫版、12cm 輕隔間、15cm 主牆/外牆、屋頂女兒牆）
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1500 });
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

    // 依類別分組牆體
    // Layer 1 (Step 3): 最外層牆心總長 (外牆/主要結構牆心，isTotalOnly: true)
    // Layer 2 (Step 2): 居室主隔間 / 12cm 輕隔間
    // Layer 3 (Step 1): 5cm 庫版 / 走廊細部隔間
    let wallDimsCreated = 0;

    // 1. 北側 (North): 垂直牆心 X 座標
    const nW3 = await createWallDim(v.id, '北側', 3, '最外層牆心總長(靠近間隔)', vertWalls.filter(w => w.maxY > globalEnv.MaxY - 3000), false, northWallStep3Y, true);
    if (nW3) wallDimsCreated++;
    const nW2 = await createWallDim(v.id, '北側', 2, '居室主隔間/12cm輕隔間牆心', vertWalls.filter(w => w.category === '15cm主牆' || w.category === '12cm輕隔間' || w.category === '女兒牆'), false, northWallStep2Y, false);
    if (nW2) wallDimsCreated++;
    const nW1 = await createWallDim(v.id, '北側', 1, '5cm庫版/細部機能牆心', vertWalls, false, northWallStep1Y, false);
    if (nW1) wallDimsCreated++;

    // 2. 東側 (East): 水平牆心 Y 座標
    const eW3 = await createWallDim(v.id, '東側', 3, '最外層牆心總長(靠近間隔)', horizWalls.filter(w => w.maxX > globalEnv.MaxX - 3000), true, eastWallStep3X, true);
    if (eW3) wallDimsCreated++;
    const eW2 = await createWallDim(v.id, '東側', 2, '居室主隔間/12cm輕隔間牆心', horizWalls.filter(w => w.category === '15cm主牆' || w.category === '12cm輕隔間' || w.category === '女兒牆'), true, eastWallStep2X, false);
    if (eW2) wallDimsCreated++;
    const eW1 = await createWallDim(v.id, '東側', 1, '5cm庫版/細部機能牆心', horizWalls, true, eastWallStep1X, false);
    if (eW1) wallDimsCreated++;

    // 3. 南側 (South): 垂直牆心 X 座標
    const sW3 = await createWallDim(v.id, '南側', 3, '最外層牆心總長(靠近間隔)', vertWalls.filter(w => w.minY < globalEnv.MinY + 3000), false, southWallStep3Y, true);
    if (sW3) wallDimsCreated++;
    const sW2 = await createWallDim(v.id, '南側', 2, '居室主隔間/12cm輕隔間牆心', vertWalls.filter(w => w.category === '15cm主牆' || w.category === '12cm輕隔間' || w.category === '女兒牆'), false, southWallStep2Y, false);
    if (sW2) wallDimsCreated++;
    const sW1 = await createWallDim(v.id, '南側', 1, '5cm庫版/細部機能牆心', vertWalls, false, southWallStep1Y, false);
    if (sW1) wallDimsCreated++;

    // 4. 西側 (West): 水平牆心 Y 座標
    const wW3 = await createWallDim(v.id, '西側', 3, '最外層牆心總長(靠近間隔)', horizWalls.filter(w => w.minX < globalEnv.MinX + 3000), true, westWallStep3X, true);
    if (wW3) wallDimsCreated++;
    const wW2 = await createWallDim(v.id, '西側', 2, '居室主隔間/12cm輕隔間牆心', horizWalls.filter(w => w.category === '15cm主牆' || w.category === '12cm輕隔間' || w.category === '女兒牆'), true, westWallStep2X, false);
    if (wW2) wallDimsCreated++;
    const wW1 = await createWallDim(v.id, '西側', 1, '5cm庫版/細部機能牆心', horizWalls, true, westWallStep1X, false);
    if (wW1) wallDimsCreated++;

    resultsSummary.push({
      viewId: v.id,
      viewName: v.name,
      colDims: colDimsCreated,
      wallDims: wallDimsCreated,
      lines: 8 // 4 紅 + 4 藍
    });
  }

  console.log('\n========================================================================');
  console.log('🎉 12 個平面視圖批次標註重做全部完成！結果彙總如下：');
  console.log('========================================================================');
  console.table(resultsSummary);

  await client.disconnect();
}

main().catch(console.error);
