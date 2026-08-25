import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-perfect-4fl-dimensions';
  await client.connect();

  const viewId = 586080; // 4FL FloorPlan
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【4FL 牆心尺寸標註】四向三層（以走廊為分界） ＋ 中庭內凹區 ===');
  console.log('================================================================\n');

  // 1. 清除 4FL 舊有的牆心標註（保留既有柱心標註 ID 2248588 ~ 2248591）
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of oldDims.data?.Elements || []) {
    if (d.ElementId > 2248591) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }
  }

  // 2. 取得 4FL 實體外框極值與軸線齊頭
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const env = alignRes.data.PhysicalEnvelopeMm;
  console.log('4FL 實體外框極值:', env, '\n');

  // 3. 收集 4FL 所有 15cm 及以上主牆
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
      await client.sendCommand('change_element_type', { elementId: res.data.DimensionId, typeId: typeIdWallDot });
      console.log(`  ✓ [${sideName} - Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId}, 分段數: ${unique.length - 1}, 牆數: ${unique.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${sideName} - Layer ${layerNum} (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  // =========================================================================
  // 1. 西側 (West / 左側 - 全跨): 4FL 西側三層放樣
  // =========================================================================
  console.log('=== 1. 建立 4FL 西側 (West) 牆心標註 ===');
  const westX_L1 = env.MinX - 3250.0; // Step 5 (-6,516.7 mm)
  const westX_L2 = env.MinX - 2600.0; // Step 4 (-5,866.7 mm)
  const westX_L3 = env.MinX - 1950.0; // Step 3 (-5,216.7 mm)

  const southMostWestWall = horizWalls.reduce((min, w) => (w.minX < 10000 && w.centerY < min.centerY) ? w : min, horizWalls[0]);
  const northMostWestWall = horizWalls.reduce((max, w) => (w.minX < 10000 && w.centerY > max.centerY) ? w : max, horizWalls[0]);
  
  // Layer 1: 西側全跨外牆總長
  const westL1Walls = [southMostWestWall, northMostWestWall];
  await createDimensionLine('West', 1, '西側實體外牆全跨總長', westL1Walls, true, westX_L1, true);

  // Layer 2: 綠線割線 (居室主隔間側: X = env.MinX + 3000mm)
  const westSlice1 = env.MinX + 3000.0;
  const westL2Walls = [
    southMostWestWall,
    ...horizWalls.filter(w => (westSlice1 >= w.minX - 30 && westSlice1 <= w.maxX + 30) || (w.minX < 10000 && (w.centerY < -15000 || w.centerY > 28000))),
    northMostWestWall
  ];
  await createDimensionLine('West', 2, '西側居室主隔間 (綠線 15cm)', westL2Walls, true, westX_L2, true);

  // Layer 3: 紫線割線 (走廊/機能隔間側: X = env.MinX + 7000mm)
  const westSlice2 = env.MinX + 7000.0;
  const westL3Walls = [
    southMostWestWall,
    ...horizWalls.filter(w => (westSlice2 >= w.minX - 30 && westSlice2 <= w.maxX + 30) || (w.minX < 10000 && (w.centerY < -15000 || w.centerY > 28000))),
    northMostWestWall
  ];
  await createDimensionLine('West', 3, '西側走廊/機能隔間 (紫線 15cm)', westL3Walls, true, westX_L3, true);

  // =========================================================================
  // 2. 南側 (South / 下側 - 南翼居室區): 4FL 南側三層放樣
  // =========================================================================
  console.log('\n=== 2. 建立 4FL 南側 (South - 南翼區) 牆心標註 ===');
  const southY_L1 = env.MinY - 3250.0; // Step 5 (-23,486.3 mm)
  const southY_L2 = env.MinY - 2600.0; // Step 4 (-22,836.3 mm)
  const southY_L3 = env.MinY - 1950.0; // Step 3 (-22,186.3 mm)

  const southExtVert = vertWalls.filter(w => w.minY <= env.MinY + 2500);
  const southL1Walls = [
    southExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, southExtVert[0]),
    southExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, southExtVert[0])
  ];
  await createDimensionLine('South', 1, '南翼實體外牆總長', southL1Walls, false, southY_L1, false);

  // Layer 2: 綠線割線 (居室主隔間: Y = env.MinY + 2500mm)
  const southSlice1 = env.MinY + 2500.0;
  const southL2Walls = vertWalls.filter(w => southSlice1 >= w.minY - 30 && southSlice1 <= w.maxY + 30);
  await createDimensionLine('South', 2, '南翼居室主隔間 (綠線 15cm)', southL2Walls, false, southY_L2, false);

  // Layer 3: 紫線割線 (走廊/浴廁隔間: Y = env.MinY + 6500mm)
  const southSlice2 = env.MinY + 6500.0;
  const southL3Walls = vertWalls.filter(w => southSlice2 >= w.minY - 30 && southSlice2 <= w.maxY + 30);
  await createDimensionLine('South', 3, '南翼走廊/浴廁隔間 (紫線 15cm)', southL3Walls, false, southY_L3, false);

  // =========================================================================
  // 3. 東側 (East / 右側 - 東翼居室區): 4FL 東側三層放樣
  // =========================================================================
  console.log('\n=== 3. 建立 4FL 東側 (East - 東翼區) 牆心標註 ===');
  const eastX_L1 = env.MaxX + 3250.0; // Step 5 (50,983.3 mm)
  const eastX_L2 = env.MaxX + 2600.0; // Step 4 (50,333.3 mm)
  const eastX_L3 = env.MaxX + 1950.0; // Step 3 (49,683.3 mm)

  const eastExtHoriz = horizWalls.filter(w => w.maxX >= env.MaxX - 2500);
  const eastL1Walls = [
    eastExtHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, eastExtHoriz[0]),
    eastExtHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, eastExtHoriz[0])
  ];
  await createDimensionLine('East', 1, '東側實體外牆總長', eastL1Walls, true, eastX_L1, true);

  // Layer 2: 綠線割線 (居室主隔間: X = env.MaxX - 3000mm)
  const eastSlice1 = env.MaxX - 3000.0;
  const eastL2Walls = horizWalls.filter(w => eastSlice1 >= w.minX - 30 && eastSlice1 <= w.maxX + 30);
  await createDimensionLine('East', 2, '東翼居室主隔間 (綠線 15cm)', eastL2Walls, true, eastX_L2, true);

  // Layer 3: 紫線割線 (走廊/機能隔間: X = env.MaxX - 8000mm)
  const eastSlice2 = env.MaxX - 8000.0;
  const eastL3Walls = horizWalls.filter(w => eastSlice2 >= w.minX - 30 && eastSlice2 <= w.maxX + 30);
  await createDimensionLine('East', 3, '東翼走廊/機能隔間 (紫線 15cm)', eastL3Walls, true, eastX_L3, true);

  // =========================================================================
  // 4. 北側 (North / 上側 - 北翼居室區): 4FL 北側三層放樣
  // =========================================================================
  console.log('\n=== 4. 建立 4FL 北側 (North - 北翼區) 牆心標註 ===');
  const northY_L1 = env.MaxY + 3250.0; // Step 5 (35,763.7 mm)
  const northY_L2 = env.MaxY + 2600.0; // Step 4 (35,113.7 mm)
  const northY_L3 = env.MaxY + 1950.0; // Step 3 (34,463.7 mm)

  const northExtVert = vertWalls.filter(w => w.maxY >= env.MaxY - 2500);
  const northL1Walls = [
    northExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, northExtVert[0]),
    northExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, northExtVert[0])
  ];
  await createDimensionLine('North', 1, '北側實體外牆總長', northL1Walls, false, northY_L1, false);

  // Layer 2: 綠線割線 (北翼居室主隔間: Y = env.MaxY - 2500mm)
  const northSlice1 = env.MaxY - 2500.0;
  const northL2Walls = vertWalls.filter(w => northSlice1 >= w.minY - 30 && northSlice1 <= w.maxY + 30);
  await createDimensionLine('North', 2, '北翼居室主隔間 (綠線 15cm)', northL2Walls, false, northY_L2, false);

  // Layer 3: 紫線割線 (北翼走廊/梯間隔間: Y = env.MaxY - 7000mm)
  const northSlice2 = env.MaxY - 7000.0;
  const northL3Walls = vertWalls.filter(w => northSlice2 >= w.minY - 30 && northSlice2 <= w.maxY + 30);
  await createDimensionLine('North', 3, '北翼走廊/梯間隔間 (紫線 15cm)', northL3Walls, false, northY_L3, false);

  // =========================================================================
  // 5. 中庭內凹區 (Courtyard - 方案 C 標準規範): 4FL 雙向放樣
  // =========================================================================
  console.log('\n=== 5. 建立 4FL 中庭內凹區 (Courtyard - 方案 C) 標註 ===');

  // (A) 中庭北側外側外牆線基準 (Y = 9,938.7 mm，退兩個間距)
  const horizBaseY = 9938.7;
  const horizBoxY_L3 = horizBaseY - 1950.0; // 7,988.7 mm (Step 3)
  const horizBoxY_L2 = horizBaseY - 2600.0; // 7,338.7 mm (Step 4)
  const horizBoxY_L1 = horizBaseY - 3250.0; // 6,688.7 mm (Step 5)

  const eastWingVert = vertWalls.filter(w => w.centerX >= 26000 && w.centerX <= 48000 && w.maxY >= 9500);
  const courtHorizL1Walls = [
    eastWingVert.reduce((min, w) => w.centerX < min.centerX ? w : min, eastWingVert[0]),
    eastWingVert.reduce((max, w) => w.centerX > max.centerX ? w : max, eastWingVert[0])
  ];
  await createDimensionLine('中庭水平藍框(東北翼南牆)', 1, '東北翼向南外牆總長', courtHorizL1Walls, false, horizBoxY_L1, false);

  const courtHorizSlice1 = 17500.0;
  const courtHorizL2Walls = [
    courtHorizL1Walls[0],
    ...eastWingVert.filter(w => courtHorizSlice1 >= w.minY - 30 && courtHorizSlice1 <= w.maxY + 30),
    courtHorizL1Walls[1]
  ];
  await createDimensionLine('中庭水平藍框(東北翼南牆)', 2, '東北翼居室主隔間 (綠線 15cm)', courtHorizL2Walls, false, horizBoxY_L2, false);

  const courtHorizSlice2 = 11688.7;
  const courtHorizL3Walls = [
    courtHorizL1Walls[0],
    ...eastWingVert.filter(w => courtHorizSlice2 >= w.minY - 30 && courtHorizSlice2 <= w.maxY + 30),
    courtHorizL1Walls[1]
  ];
  await createDimensionLine('中庭水平藍框(東北翼南牆)', 3, '東北翼走廊/梯間隔間 (紫線 15cm)', courtHorizL3Walls, false, horizBoxY_L3, false);

  // (B) 中庭西側柱外緣基準 (X = 19,933.3 mm，退兩個間距)
  const vertColFaceX = 19933.3;
  const vertBoxX_L3 = vertColFaceX + 1950.0; // 21,883.3 mm (Step 3)
  const vertBoxX_L2 = vertColFaceX + 2600.0; // 22,533.3 mm (Step 4)
  const vertBoxX_L1 = vertColFaceX + 3250.0; // 23,183.3 mm (Step 5)

  const southWingHoriz = horizWalls.filter(w => w.minX <= 20000 && w.maxX >= 10000 && w.centerY <= 4500 && w.centerY >= -20500);
  const courtVertL1Walls = [
    southWingHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, southWingHoriz[0]),
    southWingHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, southWingHoriz[0])
  ];
  await createDimensionLine('中庭垂直紅框(西南翼東牆)', 1, '西南翼向東外牆總長', courtVertL1Walls, true, vertBoxX_L1, true);

  const courtVertSlice1 = 16000.0;
  const courtVertL2Walls = [
    courtVertL1Walls[0],
    ...southWingHoriz.filter(w => courtVertSlice1 >= w.minX - 30 && courtVertSlice1 <= w.maxX + 30),
    courtVertL1Walls[1]
  ];
  await createDimensionLine('中庭垂直紅框(西南翼東牆)', 2, '西南翼居室主隔間 (綠線 15cm)', courtVertL2Walls, true, vertBoxX_L2, true);

  const courtVertSlice2 = 12500.0;
  const courtVertL3Walls = [
    courtVertL1Walls[0],
    ...southWingHoriz.filter(w => courtVertSlice2 >= w.minX - 30 && courtVertSlice2 <= w.maxX + 30),
    courtVertL1Walls[1]
  ];
  await createDimensionLine('中庭垂直紅框(西南翼東牆)', 3, '西南翼走廊/浴廁隔間 (紫線 15cm)', courtVertL3Walls, true, vertBoxX_L3, true);

  console.log('\n================================================================');
  console.log('=== 【4FL 牆心標註】四向三層 ＋ 中庭內凹區 全數建置完畢！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
