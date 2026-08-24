import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-perfect-2fl-dims-courtyard';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 完美牆心標註】補齊西側全跨 + 實作內凹中庭方案 C ===');
  console.log('================================================================\n');

  // 1. 清除舊測試尺寸標註 (保留 North 示範 2250275, 2250367, 2250683 與 North 柱心)
  console.log('--- 清除先前測試之牆心標註 (ID >= 2251200) ---');
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of oldDims.data?.Elements || []) {
    if (d.ElementId >= 2251200) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }
  }

  // 2. 取得 2FL 實體外框極值
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const env = alignRes.data.PhysicalEnvelopeMm;

  // 3. 收集所有 15cm 及以上主牆
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  const mainWalls = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      if (info.data.Thickness < 140) continue;
      if (info.data.Length < 300) continue;
      if (info.data.Name?.includes('粉刷')) continue;

      const sx = info.data.StartX;
      const sy = info.data.StartY;
      const ex = info.data.EndX;
      const ey = info.data.EndY;
      const isVert = Math.abs(ex - sx) < 40;
      const isHoriz = Math.abs(ey - sy) < 40;

      mainWalls.push({
        id: w.ElementId,
        name: info.data.Name,
        wallType: info.data.WallType,
        thickness: info.data.Thickness,
        length: info.data.Length,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        minX: Math.min(sx, ex),
        maxX: Math.max(sx, ex),
        minY: Math.min(sy, ey),
        maxY: Math.max(sy, ey),
        isVert,
        isHoriz,
        centerX: (sx + ex) / 2,
        centerY: (sy + ey) / 2
      });
    }
  }

  const vertWalls = mainWalls.filter(w => w.isVert);
  const horizWalls = mainWalls.filter(w => w.isHoriz);
  console.log(`收集到 ${mainWalls.length} 道 15CM 主牆 (垂直 ${vertWalls.length}，水平 ${horizWalls.length})\n`);

  // 輔助函式：建立標註線
  async function createDimensionLine(sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isAscending) {
    if (!walls || walls.length < 2) {
      console.log(`  ⚠️ [${sideName} - Layer ${layerNum} (${desc})] 牆數 < 2，跳過`);
      return null;
    }

    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    walls.sort((a, b) => a[sortKey] - b[sortKey]);

    // 聚類去重 (容差 35mm)
    const unique = [];
    for (const w of walls) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > 35.0) {
        unique.push(w);
      }
    }

    if (unique.length < 2) return null;
    if (!isAscending) unique.reverse();

    const spanMin = Math.min(...unique.map(w => w[sortKey])) - 1000;
    const spanMax = Math.max(...unique.map(w => w[sortKey])) + 1000;

    let startX, startY, endX, endY;
    if (isVerticalAxis) {
      startX = dimCoord;
      startY = spanMin;
      endX = dimCoord;
      endY = spanMax;
    } else {
      startX = spanMax;
      startY = dimCoord;
      endX = spanMin;
      endY = dimCoord;
    }

    const res = await client.sendCommand('create_dimension', {
      viewId: viewId,
      elementIds: unique.map(w => w.id),
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      dimensionTypeId: typeIdWallDot
    });

    if (res.success && res.data?.DimensionId) {
      // 確保標註型式為 TABC-DIM_dot 牆心
      await client.sendCommand('change_element_type', { elementId: res.data.DimensionId, typeId: typeIdWallDot });
      console.log(`  ✓ [${sideName} - Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId}, 分段數: ${unique.length - 1}, 牆數: ${unique.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${sideName} - Layer ${layerNum} (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  // =========================================================================
  // 1. 西側 (West / 左側): 補齊左上角 (Y=30,238.7) 與 左下角 (Y=-19,836.3)
  // =========================================================================
  console.log('=== 1. 建立西側 (West) 完整全跨標註 (補齊紅圈) ===');
  const westX_L1 = env.MinX - 3250.0; // Step 5 (-8,841.7 mm)
  const westX_L2 = env.MinX - 2600.0; // Step 4 (-8,191.7 mm)
  const westX_L3 = env.MinX - 1950.0; // Step 3 (-7,541.7 mm)

  // 西側所有水平主牆 (包含南翼與北翼兩端)
  const westAllHoriz = horizWalls.filter(w => w.minX < 10000);
  
  // Layer 1: 西側實體外牆端點總長 (從最南 Y=-19836 到最北 Y=30238)
  const southMostWestWall = horizWalls.reduce((min, w) => (w.minX < 10000 && w.centerY < min.centerY) ? w : min, horizWalls[0]);
  const northMostWestWall = horizWalls.reduce((max, w) => (w.minX < 10000 && w.centerY > max.centerY) ? w : max, horizWalls[0]);
  const westL1Walls = [southMostWestWall, northMostWestWall];
  await createDimensionLine('West', 1, '西側實體外牆全跨總長', westL1Walls, true, westX_L1, true);

  // Layer 2: 綠線割線 (涵蓋居室/健身房主隔間，加上南北端外牆)
  const westSlice1 = env.MinX + 3000.0;
  const westL2Walls = [
    southMostWestWall,
    ...horizWalls.filter(w => (westSlice1 >= w.minX - 30 && westSlice1 <= w.maxX + 30) || (w.minX < 10000 && (w.centerY < -15000 || w.centerY > 28000))),
    northMostWestWall
  ];
  await createDimensionLine('West', 2, '西側主隔間全跨 (綠線 15cm)', westL2Walls, true, westX_L2, true);

  // Layer 3: 紫線割線 (走廊/梯間/機能隔間全跨)
  const westSlice2 = env.MinX + 7000.0;
  const westL3Walls = [
    southMostWestWall,
    ...horizWalls.filter(w => (westSlice2 >= w.minX - 30 && westSlice2 <= w.maxX + 30) || (w.minX < 10000 && (w.centerY < -15000 || w.centerY > 28000))),
    northMostWestWall
  ];
  await createDimensionLine('West', 3, '西側走廊/機能隔間全跨 (紫線 15cm)', westL3Walls, true, westX_L3, true);

  // =========================================================================
  // 2. 南側 (South / 下側 - 南翼居室區): (圖 3 規範)
  // =========================================================================
  console.log('\n=== 2. 建立南側 (South - 南翼居室區) 標註 ===');
  const southY_L1 = env.MinY - 3250.0;
  const southY_L2 = env.MinY - 2600.0;
  const southY_L3 = env.MinY - 1950.0;

  const southExtVert = vertWalls.filter(w => w.minY <= env.MinY + 2000);
  const southL1Walls = [southExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, southExtVert[0]),
                        southExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, southExtVert[0])];
  await createDimensionLine('South', 1, '南翼實體外牆總長', southL1Walls, false, southY_L1, false);

  const southSlice1 = env.MinY + 2500.0;
  const southL2Walls = vertWalls.filter(w => southSlice1 >= w.minY - 30 && southSlice1 <= w.maxY + 30);
  await createDimensionLine('South', 2, '南翼居室主隔間 (綠線 15cm)', southL2Walls, false, southY_L2, false);

  const southSlice2 = env.MinY + 6500.0;
  const southL3Walls = vertWalls.filter(w => southSlice2 >= w.minY - 30 && southSlice2 <= w.maxY + 30);
  await createDimensionLine('South', 3, '南翼走廊/浴廁主隔間 (紫線 15cm)', southL3Walls, false, southY_L3, false);

  // =========================================================================
  // 3. 東側 (East / 右側 - 東翼居室區):
  // =========================================================================
  console.log('\n=== 3. 建立東側 (East - 東翼區) 標註 ===');
  const eastX_L1 = env.MaxX + 3250.0;
  const eastX_L2 = env.MaxX + 2600.0;
  const eastX_L3 = env.MaxX + 1950.0;

  const eastExtHoriz = horizWalls.filter(w => w.maxX >= env.MaxX - 2500);
  const eastL1Walls = [eastExtHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, eastExtHoriz[0]),
                       eastExtHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, eastExtHoriz[0])];
  await createDimensionLine('East', 1, '東側實體外牆總長', eastL1Walls, true, eastX_L1, true);

  const eastSlice1 = env.MaxX - 3000.0;
  const eastL2Walls = horizWalls.filter(w => eastSlice1 >= w.minX - 30 && eastSlice1 <= w.maxX + 30);
  await createDimensionLine('East', 2, '東翼居室主隔間 (綠線 15cm)', eastL2Walls, true, eastX_L2, true);

  const eastSlice2 = env.MaxX - 8000.0;
  const eastL3Walls = horizWalls.filter(w => eastSlice2 >= w.minX - 30 && eastSlice2 <= w.maxX + 30);
  await createDimensionLine('East', 3, '東翼走廊/機能主隔間 (紫線 15cm)', eastL3Walls, true, eastX_L3, true);

  // =========================================================================
  // 4. 中庭內凹區 (Courtyard - 方案 C): 緊貼內側實體外牆標註
  // =========================================================================
  console.log('\n=== 4. 建立中庭內凹區 (Courtyard - 方案 C) 實體外牆標註 ===');

  // (A) 交誼廳/餐廳南向實體外牆 (水平外牆，Y ≈ 4,163.7 mm，X: [11083.3, 19208.3])
  const diningSouthWall = horizWalls.find(w => w.id === 1646863 || (Math.abs(w.centerY - 4163.7) < 50 && w.length > 5000));
  if (diningSouthWall) {
    const diningY_L1 = diningSouthWall.centerY - 3250.0; // 913.7 mm
    const diningY_L2 = diningSouthWall.centerY - 2600.0; // 1563.7 mm
    const diningY_L3 = diningSouthWall.centerY - 1950.0; // 2213.7 mm

    // 交誼廳南向垂直交集牆 (柱邊與隔間)
    const diningVertWalls = vertWalls.filter(w => (w.centerX >= diningSouthWall.minX - 30 && w.centerX <= diningSouthWall.maxX + 30) && (diningSouthWall.centerY >= w.minY - 30 && diningSouthWall.centerY <= w.maxY + 30));
    
    // Layer 1: 交誼廳南向外牆總長
    await createDimensionLine('Courtyard_Dining', 1, '交誼廳南外牆總長', [diningVertWalls[0] || vertWalls.find(w => w.id === 1647616), diningVertWalls[diningVertWalls.length - 1] || vertWalls.find(w => w.id === 1646845)], false, diningY_L1, false);

    // Layer 2: 交誼廳柱心/主隔間
    await createDimensionLine('Courtyard_Dining', 2, '交誼廳南外牆主隔間/開口', diningVertWalls, false, diningY_L2, false);
  }

  // (B) 東南翼向西實體外牆 (垂直外牆，X ≈ 13,683.3 mm / 19,283.3 mm，Y: [-19836.3, 4163.7])
  const courtyardWestWall = vertWalls.find(w => w.id === 1646845 || (Math.abs(w.centerX - 19283.3) < 50 && w.length > 10000));
  if (courtyardWestWall) {
    const courtX_L1 = courtyardWestWall.centerX + 3250.0; // 22533.3 mm
    const courtX_L2 = courtyardWestWall.centerX + 2600.0; // 21883.3 mm

    // 東南翼向西水平交集主牆
    const courtHorizWalls = horizWalls.filter(w => (courtyardWestWall.centerX >= w.minX - 30 && courtyardWestWall.centerX <= w.maxX + 30) && (w.centerY >= courtyardWestWall.minY - 30 && w.centerY <= courtyardWestWall.maxY + 30));

    // Layer 1: 東南翼向西實體外牆總長
    if (courtHorizWalls.length >= 2) {
      await createDimensionLine('Courtyard_WestWing', 1, '東南翼向西外牆總長', [courtHorizWalls[0], courtHorizWalls[courtHorizWalls.length - 1]], true, courtX_L1, true);
      // Layer 2: 東南翼向西開口/主隔間
      await createDimensionLine('Courtyard_WestWing', 2, '東南翼向西開口/隔間', courtHorizWalls, true, courtX_L2, true);
    }
  }

  console.log('\n================================================================');
  console.log('=== 【2FL 牆心標註】全區四向 ＋ 內凹方案 C 建置完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
