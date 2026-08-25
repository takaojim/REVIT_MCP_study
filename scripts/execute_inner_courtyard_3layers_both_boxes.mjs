import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-courtyard-perfect-align';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 內凹中庭區】依外側構件外緣退兩間距 統一雙向階梯標註 ===');
  console.log('================================================================\n');

  // 1. 清除先前在中庭建立的舊標註 (ID 2251260 ~ 2251500)
  for (let id = 2251260; id <= 2251500; id++) {
    try {
      await client.sendCommand('delete_element', { elementId: id });
    } catch (e) {}
  }

  // 2. 收集 15cm 及以上主牆
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

  // 輔助函式：建立標註線
  async function createDimensionLine(boxName, layerNum, desc, walls, isVerticalAxis, dimCoord, isAscending) {
    if (!walls || walls.length < 2) {
      console.log(`  ⚠️ [${boxName} - Layer ${layerNum} (${desc})] 牆數 < 2，跳過`);
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
      console.log(`  ✓ [${boxName} - Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId}, 分段數: ${unique.length - 1}, 牆數: ${unique.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${boxName} - Layer ${layerNum} (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  // =========================================================================
  // 1. 水平藍框：中庭北側外側外牆基準 (Y = 9,938.7 mm，退兩個間距至 Y = 7,988.7 mm)
  // =========================================================================
  console.log('=== 1. 水平藍框 (東北翼向南外牆區 - 外側基準 Y = 9,938.7 mm 退兩間距) ===');
  const horizBaseY = 9938.7;
  const horizBoxY_L3 = horizBaseY - 1950.0; // 7,988.7 mm (Step 3 - 走廊/梯間隔間，退兩個間距)
  const horizBoxY_L2 = horizBaseY - 2600.0; // 7,338.7 mm (Step 4 - 居室主隔間)
  const horizBoxY_L1 = horizBaseY - 3250.0; // 6,688.7 mm (Step 5 - 外牆總長)

  // 該區域垂直 15cm 主牆 (X 在 26,000 ~ 48,000 間，起點收在外牆角 X = 26,173.8 mm，終點至東外牆 X = 47,008.3 mm)
  const eastWingVert = vertWalls.filter(w => w.centerX >= 26000 && w.centerX <= 48000 && w.maxY >= 9500);

  // Layer 1: 東北翼向南外牆總長 (西端角牆 X=26173.8 到 東端外牆 X=47008.3)
  const horizBoxL1Walls = [
    eastWingVert.reduce((min, w) => w.centerX < min.centerX ? w : min, eastWingVert[0]),
    eastWingVert.reduce((max, w) => w.centerX > max.centerX ? w : max, eastWingVert[0])
  ];
  await createDimensionLine('水平藍框(東北翼南牆)', 1, '東北翼向南外牆總長', horizBoxL1Walls, false, horizBoxY_L1, false);

  // Layer 2: 綠線割線 (Y = 17,500 mm) - 居室大隔間
  const horizSlice1 = 17500.0;
  const horizBoxL2Walls = [
    horizBoxL1Walls[0],
    ...eastWingVert.filter(w => horizSlice1 >= w.minY - 30 && horizSlice1 <= w.maxY + 30),
    horizBoxL1Walls[1]
  ];
  await createDimensionLine('水平藍框(東北翼南牆)', 2, '東北翼居室主隔間 (綠線 15cm)', horizBoxL2Walls, false, horizBoxY_L2, false);

  // Layer 3: 紫線割線 (Y = 11,688.7 mm / 走廊與梯間側) - 走廊/梯間/機能隔間
  const horizSlice2 = 11688.7;
  const horizBoxL3Walls = [
    horizBoxL1Walls[0],
    ...eastWingVert.filter(w => horizSlice2 >= w.minY - 30 && horizSlice2 <= w.maxY + 30),
    horizBoxL1Walls[1]
  ];
  await createDimensionLine('水平藍框(東北翼南牆)', 3, '東北翼走廊/梯間隔間 (紫線 15cm)', horizBoxL3Walls, false, horizBoxY_L3, false);

  // =========================================================================
  // 2. 垂直紅框：西南居室翼向東外牆區 (再退一格，對齊柱外緣 X = 19,933.3 mm 退兩個間距)
  // =========================================================================
  console.log('\n=== 2. 垂直紅框 (西南居室翼向東外牆區 - 再退一格 / X = 21,883.3 mm 起) ===');
  const vertColFaceX = 19933.3; // 柱外緣基準
  const vertBoxX_L3 = vertColFaceX + 1950.0; // 21,883.3 mm (Step 3 - 走廊/浴廁隔間，退兩個間距)
  const vertBoxX_L2 = vertColFaceX + 2600.0; // 22,533.3 mm (Step 4 - 居室主隔間)
  const vertBoxX_L1 = vertColFaceX + 3250.0; // 23,183.3 mm (Step 5 - 外牆總長)

  // 該西南居室翼水平 15cm 主牆 (Y 在 -20,000 ~ 4,500 間，X 在 8,000 ~ 20,000 間)
  const southWingHoriz = horizWalls.filter(w => w.minX <= 20000 && w.maxX >= 10000 && w.centerY <= 4500 && w.centerY >= -20500);

  // Layer 1: 西南翼向東外牆總長 (南端 Y=-19836.3 到 北端 Y=4163.7)
  const vertBoxL1Walls = [
    southWingHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, southWingHoriz[0]),
    southWingHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, southWingHoriz[0])
  ];
  await createDimensionLine('垂直紅框(西南翼東牆)', 1, '西南翼向東外牆總長', vertBoxL1Walls, true, vertBoxX_L1, true);

  // Layer 2: 綠線割線 (X = 16,000 mm) - 居室主隔間
  const vertSlice1 = 16000.0;
  const vertBoxL2Walls = [
    vertBoxL1Walls[0],
    ...southWingHoriz.filter(w => vertSlice1 >= w.minX - 30 && vertSlice1 <= w.maxX + 30),
    vertBoxL1Walls[1]
  ];
  await createDimensionLine('垂直紅框(西南翼東牆)', 2, '西南翼居室主隔間 (綠線 15cm)', vertBoxL2Walls, true, vertBoxX_L2, true);

  // Layer 3: 紫線割線 (X = 12,500 mm / 浴廁側) - 走廊/浴廁主隔間
  const vertSlice2 = 12500.0;
  const vertBoxL3Walls = [
    vertBoxL1Walls[0],
    ...southWingHoriz.filter(w => vertSlice2 >= w.minX - 30 && vertSlice2 <= w.maxX + 30),
    vertBoxL1Walls[1]
  ];
  await createDimensionLine('垂直紅框(西南翼東牆)', 3, '西南翼走廊/浴廁隔間 (紫線 15cm)', vertBoxL3Walls, true, vertBoxX_L3, true);

  console.log('\n================================================================');
  console.log('=== 【2FL 中庭內凹區】雙向基準完全一致 三層標註建置完畢！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
