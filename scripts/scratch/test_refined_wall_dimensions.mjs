import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-refined-wall-dims';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 精準牆心標註】15CM 主牆過濾 + 實體端點總長 + 內凹處理 ===');
  console.log('================================================================\n');

  // 1. 取得 2FL 實體外框極值
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const env = alignRes.data.PhysicalEnvelopeMm;

  // 2. 收集所有牆體，嚴格過濾 Thickness >= 140mm (15cm 及以上主結構/主隔間牆)
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  const mainWalls = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      // 嚴格規則 1: 僅保留厚度 >= 140mm (15cm 主牆)
      if (info.data.Thickness < 140) continue;
      // 排除非實體或短飾條
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
  console.log(`- 15CM 垂直主牆: ${vertWalls.length} 道`);
  console.log(`- 15CM 水平主牆: ${horizWalls.length} 道\n`);

  // 輔助函式：聚類建立標註
  async function createDimensionLine(sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isAscending) {
    if (!walls || walls.length < 2) {
      console.log(`  ⚠️ [${sideName} - Layer ${layerNum} (${desc})] 牆數 < 2，跳過`);
      return null;
    }

    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    walls.sort((a, b) => a[sortKey] - b[sortKey]);

    // 聚類去重 (容差 30mm)
    const unique = [];
    for (const w of walls) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > 30.0) {
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
      console.log(`  ✓ [${sideName} - Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId}, 分段數: ${unique.length - 1}, 牆數: ${unique.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${sideName} - Layer ${layerNum} (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 1. 西側 (West / 左側): 測量西側實體外牆跨越範圍內之水平主牆 (圖 4 規範)
  // -------------------------------------------------------------------------
  console.log('=== 建立西側 (West) 標註 ===');
  const westX_L1 = env.MinX - 3250.0;
  const westX_L2 = env.MinX - 2600.0;
  const westX_L3 = env.MinX - 1950.0;

  // 西側實體外牆 (minX <= env.MinX + 1000)
  const westExtHoriz = horizWalls.filter(w => w.minX <= env.MinX + 2500);
  // Layer 1: 最靠近西側實體外牆端點總長 (圖 4)
  const westL1Walls = [westExtHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, westExtHoriz[0]),
                       westExtHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, westExtHoriz[0])];
  await createDimensionLine('West', 1, '西側實體外牆總長', westL1Walls, true, westX_L1, true);

  // Layer 2: 綠線割線 (西外牆內縮 3.0m)
  const westSlice1 = env.MinX + 3000.0;
  const westL2Walls = horizWalls.filter(w => westSlice1 >= w.minX - 30 && westSlice1 <= w.maxX + 30);
  await createDimensionLine('West', 2, '居室主隔間 (綠線 15cm)', westL2Walls, true, westX_L2, true);

  // Layer 3: 紫線割線 (西外牆內縮 7.0m)
  const westSlice2 = env.MinX + 7000.0;
  const westL3Walls = horizWalls.filter(w => westSlice2 >= w.minX - 30 && westSlice2 <= w.maxX + 30);
  await createDimensionLine('West', 3, '走廊/機能隔間 (紫線 15cm)', westL3Walls, true, westX_L3, true);

  // -------------------------------------------------------------------------
  // 2. 南側 (South / 下側 - 南翼居室區): (圖 3 規範)
  // -------------------------------------------------------------------------
  console.log('\n=== 建立南側 (South - 南翼居室區) 標註 ===');
  const southY_L1 = env.MinY - 3250.0;
  const southY_L2 = env.MinY - 2600.0;
  const southY_L3 = env.MinY - 1950.0;

  // 南翼居室垂直外牆 (minY <= env.MinY + 1500)
  const southExtVert = vertWalls.filter(w => w.minY <= env.MinY + 2000);
  // Layer 1: 最靠近南側居室翼的外牆端點 (圖 3 紅色雙箭頭範圍)
  const southL1Walls = [southExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, southExtVert[0]),
                        southExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, southExtVert[0])];
  await createDimensionLine('South', 1, '南翼實體外牆總長', southL1Walls, false, southY_L1, false);

  // Layer 2: 綠線割線 (南外牆內縮 2.5m)
  const southSlice1 = env.MinY + 2500.0;
  const southL2Walls = vertWalls.filter(w => southSlice1 >= w.minY - 30 && southSlice1 <= w.maxY + 30);
  await createDimensionLine('South', 2, '南翼居室主隔間 (綠線 15cm)', southL2Walls, false, southY_L2, false);

  // Layer 3: 紫線割線 (南外牆內縮 6.5m)
  const southSlice2 = env.MinY + 6500.0;
  const southL3Walls = vertWalls.filter(w => southSlice2 >= w.minY - 30 && southSlice2 <= w.maxY + 30);
  await createDimensionLine('South', 3, '南翼走廊/浴廁主隔間 (紫線 15cm)', southL3Walls, false, southY_L3, false);

  // -------------------------------------------------------------------------
  // 3. 東側 (East / 右側 - 北翼居室區):
  // -------------------------------------------------------------------------
  console.log('\n=== 建立東側 (East - 實體主翼) 標註 ===');
  const eastX_L1 = env.MaxX + 3250.0;
  const eastX_L2 = env.MaxX + 2600.0;
  const eastX_L3 = env.MaxX + 1950.0;

  // 東側實體外牆
  const eastExtHoriz = horizWalls.filter(w => w.maxX >= env.MaxX - 2500);
  const eastL1Walls = [eastExtHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, eastExtHoriz[0]),
                       eastExtHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, eastExtHoriz[0])];
  await createDimensionLine('East', 1, '東側實體外牆總長', eastL1Walls, true, eastX_L1, true);

  // Layer 2: 綠線割線 (東外牆內縮 3.0m)
  const eastSlice1 = env.MaxX - 3000.0;
  const eastL2Walls = horizWalls.filter(w => eastSlice1 >= w.minX - 30 && eastSlice1 <= w.maxX + 30);
  await createDimensionLine('East', 2, '東翼居室主隔間 (綠線 15cm)', eastL2Walls, true, eastX_L2, true);

  // Layer 3: 紫線割線 (東外牆內縮 8.0m)
  const eastSlice2 = env.MaxX - 8000.0;
  const eastL3Walls = horizWalls.filter(w => eastSlice2 >= w.minX - 30 && eastSlice2 <= w.maxX + 30);
  await createDimensionLine('East', 3, '東翼走廊/機能主隔間 (紫線 15cm)', eastL3Walls, true, eastX_L3, true);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
