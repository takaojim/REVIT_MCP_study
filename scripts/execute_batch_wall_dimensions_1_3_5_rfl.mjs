import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-batch-wall-dims-1-3-5-rfl';
  await client.connect();

  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  const targetViews = [
    { id: 312, name: '1FL', refId: null },
    { id: 428158, name: '3FL', refId: null },
    { id: 1334374, name: '5FL', refId: null },
    { id: 586090, name: 'RFL', refId: 1334374 }
  ];

  console.log('================================================================');
  console.log('=== 【1FL、3FL、5FL、RFL】四向三層牆心 ＋ 中庭內凹區 批次標註 ===');
  console.log('================================================================\n');

  // 輔助函式：建立標註線
  async function createDimensionLine(viewId, sideName, layerNum, desc, walls, isVerticalAxis, dimCoord, isAscending) {
    if (!walls || walls.length < 2) {
      console.log(`  ⚠️ [${sideName} - Layer ${layerNum} (${desc})] 牆數 < 2 (${walls?.length || 0})，跳過`);
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

    if (unique.length < 2) {
      console.log(`  ⚠️ [${sideName} - Layer ${layerNum} (${desc})] 去重後牆數 < 2，跳過`);
      return null;
    }
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
      console.log(`  ✓ [${sideName} - Layer ${layerNum} (${desc})] ID: ${res.data.DimensionId}, 分段: ${unique.length - 1}, 牆數: ${unique.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${sideName} - Layer ${layerNum} (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  for (const v of targetViews) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🚀 開始處理 【${v.name}】 (View ID: ${v.id})...`);
    console.log(`----------------------------------------------------------------`);

    // 1. 清除舊有牆心標註（保留既有柱心標註 ID 2248588 ~ 2248591 或 柱心專屬標註）
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id, maxCount: 1000 });
    for (const d of oldDims.data?.Elements || []) {
      const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
      const typeName = dInfo.data?.Type || '';
      // 若為牆心標註或未指定柱心型式者予以清理
      if (typeName.includes('牆心') || typeName.includes('dot') || d.ElementId > 2248591) {
        if (!typeName.includes('柱心')) {
          try {
            await client.sendCommand('delete_element', { elementId: d.ElementId });
          } catch (e) {}
        }
      }
    }

    // 2. 齊頭整列與外框基準
    const alignPayload = {
      viewId: v.id,
      stepCount: 9.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    };
    if (v.refId) alignPayload.referenceViewId = v.refId;

    const alignRes = await client.sendCommand('align_plan_grids', alignPayload);
    const env = alignRes.data?.PhysicalEnvelopeMm || {
      MinX: -3266.7,
      MaxX: 47733.3,
      MinY: -20236.3,
      MaxY: 32513.7,
      Width: 51000.0,
      Depth: 52750.0
    };

    console.log(`  實體外框極值: MinX=${env.MinX.toFixed(1)}, MaxX=${env.MaxX.toFixed(1)}, MinY=${env.MinY.toFixed(1)}, MaxY=${env.MaxY.toFixed(1)}`);

    // 3. 收集該樓層所有 15cm 及以上主牆
    const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: v.id, maxCount: 1000 });
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
    console.log(`  收集到 ${mainWalls.length} 道 15CM 主牆 (垂直 ${vertWalls.length}，水平 ${horizWalls.length})\n`);

    if (mainWalls.length === 0) {
      console.log(`  ⚠️ 視圖 ${v.name} 無符合條件的 15cm 主牆，跳過`);
      continue;
    }

    // =========================================================================
    // 1. 西側 (West / 左側 - 全跨): 三層放樣
    // =========================================================================
    console.log(`  --- 1. 建立 ${v.name} 西側 (West) 牆心標註 ---`);
    const westX_L1 = env.MinX - 3250.0; // Step 5
    const westX_L2 = env.MinX - 2600.0; // Step 4
    const westX_L3 = env.MinX - 1950.0; // Step 3

    const westHoriz = horizWalls.filter(w => w.minX < (env.MinX + 15000));
    const southMostWestWall = westHoriz.reduce((min, w) => (!min || w.centerY < min.centerY) ? w : min, null);
    const northMostWestWall = westHoriz.reduce((max, w) => (!max || w.centerY > max.centerY) ? w : max, null);

    if (southMostWestWall && northMostWestWall && southMostWestWall.id !== northMostWestWall.id) {
      // Layer 1: 西側全跨外牆總長
      const westL1Walls = [southMostWestWall, northMostWestWall];
      await createDimensionLine(v.id, 'West', 1, '西側實體外牆全跨總長', westL1Walls, true, westX_L1, true);

      // Layer 2: 綠線割線 (居室主隔間側: X = env.MinX + 3000mm)
      const westSlice1 = env.MinX + 3000.0;
      const westL2Walls = [
        southMostWestWall,
        ...horizWalls.filter(w => (westSlice1 >= w.minX - 30 && westSlice1 <= w.maxX + 30) || (w.minX < (env.MinX + 13000) && (w.centerY < -15000 || w.centerY > 28000))),
        northMostWestWall
      ];
      await createDimensionLine(v.id, 'West', 2, '西側居室主隔間 (綠線 15cm)', westL2Walls, true, westX_L2, true);

      // Layer 3: 紫線割線 (走廊/機能隔間側: X = env.MinX + 7000mm)
      const westSlice2 = env.MinX + 7000.0;
      const westL3Walls = [
        southMostWestWall,
        ...horizWalls.filter(w => (westSlice2 >= w.minX - 30 && westSlice2 <= w.maxX + 30) || (w.minX < (env.MinX + 13000) && (w.centerY < -15000 || w.centerY > 28000))),
        northMostWestWall
      ];
      await createDimensionLine(v.id, 'West', 3, '西側走廊/機能隔間 (紫線 15cm)', westL3Walls, true, westX_L3, true);
    } else if (horizWalls.length >= 2) {
      const l1Walls = [
        horizWalls.reduce((min, w) => w.centerY < min.centerY ? w : min, horizWalls[0]),
        horizWalls.reduce((max, w) => w.centerY > max.centerY ? w : max, horizWalls[0])
      ];
      await createDimensionLine(v.id, 'West', 1, '西側現有外牆總長', l1Walls, true, westX_L1, true);
      await createDimensionLine(v.id, 'West', 2, '西側現有隔間牆心', horizWalls, true, westX_L2, true);
    }

    // =========================================================================
    // 2. 南側 (South / 下側 - 南翼區): 三層放樣
    // =========================================================================
    console.log(`  --- 2. 建立 ${v.name} 南側 (South - 南翼區) 牆心標註 ---`);
    const southY_L1 = env.MinY - 3250.0; // Step 5
    const southY_L2 = env.MinY - 2600.0; // Step 4
    const southY_L3 = env.MinY - 1950.0; // Step 3

    const southExtVert = vertWalls.filter(w => w.minY <= env.MinY + 3000);
    if (southExtVert.length >= 2) {
      const southL1Walls = [
        southExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, southExtVert[0]),
        southExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, southExtVert[0])
      ];
      await createDimensionLine(v.id, 'South', 1, '南翼實體外牆總長', southL1Walls, false, southY_L1, false);

      // Layer 2: 綠線割線 (居室主隔間: Y = env.MinY + 2500mm)
      const southSlice1 = env.MinY + 2500.0;
      const southL2Walls = vertWalls.filter(w => southSlice1 >= w.minY - 30 && southSlice1 <= w.maxY + 30);
      await createDimensionLine(v.id, 'South', 2, '南翼居室主隔間 (綠線 15cm)', southL2Walls, false, southY_L2, false);

      // Layer 3: 紫線割線 (走廊/浴廁隔間: Y = env.MinY + 6500mm)
      const southSlice2 = env.MinY + 6500.0;
      const southL3Walls = vertWalls.filter(w => southSlice2 >= w.minY - 30 && southSlice2 <= w.maxY + 30);
      await createDimensionLine(v.id, 'South', 3, '南翼走廊/浴廁隔間 (紫線 15cm)', southL3Walls, false, southY_L3, false);
    } else if (vertWalls.length >= 2) {
      const l1Walls = [
        vertWalls.reduce((min, w) => w.centerX < min.centerX ? w : min, vertWalls[0]),
        vertWalls.reduce((max, w) => w.centerX > max.centerX ? w : max, vertWalls[0])
      ];
      await createDimensionLine(v.id, 'South', 1, '南側現有外牆總長', l1Walls, false, southY_L1, false);
    }

    // =========================================================================
    // 3. 東側 (East / 右側 - 東翼區): 三層放樣
    // =========================================================================
    console.log(`  --- 3. 建立 ${v.name} 東側 (East - 東翼區) 牆心標註 ---`);
    const eastX_L1 = env.MaxX + 3250.0; // Step 5
    const eastX_L2 = env.MaxX + 2600.0; // Step 4
    const eastX_L3 = env.MaxX + 1950.0; // Step 3

    const eastExtHoriz = horizWalls.filter(w => w.maxX >= env.MaxX - 3000);
    if (eastExtHoriz.length >= 2) {
      const eastL1Walls = [
        eastExtHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, eastExtHoriz[0]),
        eastExtHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, eastExtHoriz[0])
      ];
      await createDimensionLine(v.id, 'East', 1, '東側實體外牆總長', eastL1Walls, true, eastX_L1, true);

      // Layer 2: 綠線割線 (居室主隔間: X = env.MaxX - 3000mm)
      const eastSlice1 = env.MaxX - 3000.0;
      const eastL2Walls = horizWalls.filter(w => eastSlice1 >= w.minX - 30 && eastSlice1 <= w.maxX + 30);
      await createDimensionLine(v.id, 'East', 2, '東翼居室主隔間 (綠線 15cm)', eastL2Walls, true, eastX_L2, true);

      // Layer 3: 紫線割線 (走廊/機能隔間: X = env.MaxX - 8000mm)
      const eastSlice2 = env.MaxX - 8000.0;
      const eastL3Walls = horizWalls.filter(w => eastSlice2 >= w.minX - 30 && eastSlice2 <= w.maxX + 30);
      await createDimensionLine(v.id, 'East', 3, '東翼走廊/機能隔間 (紫線 15cm)', eastL3Walls, true, eastX_L3, true);
    } else if (horizWalls.length >= 2) {
      const eastHorizs = horizWalls.filter(w => w.maxX > (env.MaxX - 15000));
      if (eastHorizs.length >= 2) {
        const l1Walls = [
          eastHorizs.reduce((min, w) => w.centerY < min.centerY ? w : min, eastHorizs[0]),
          eastHorizs.reduce((max, w) => w.centerY > max.centerY ? w : max, eastHorizs[0])
        ];
        await createDimensionLine(v.id, 'East', 1, '東側現有外牆總長', l1Walls, true, eastX_L1, true);
      }
    }

    // =========================================================================
    // 4. 北側 (North / 上側 - 北翼區): 三層放樣
    // =========================================================================
    console.log(`  --- 4. 建立 ${v.name} 北側 (North - 北翼區) 牆心標註 ---`);
    const northY_L1 = env.MaxY + 3250.0; // Step 5
    const northY_L2 = env.MaxY + 2600.0; // Step 4
    const northY_L3 = env.MaxY + 1950.0; // Step 3

    const northExtVert = vertWalls.filter(w => w.maxY >= env.MaxY - 3000);
    if (northExtVert.length >= 2) {
      const northL1Walls = [
        northExtVert.reduce((min, w) => w.centerX < min.centerX ? w : min, northExtVert[0]),
        northExtVert.reduce((max, w) => w.centerX > max.centerX ? w : max, northExtVert[0])
      ];
      await createDimensionLine(v.id, 'North', 1, '北側實體外牆總長', northL1Walls, false, northY_L1, false);

      // Layer 2: 綠線割線 (北翼居室主隔間: Y = env.MaxY - 2500mm)
      const northSlice1 = env.MaxY - 2500.0;
      const northL2Walls = vertWalls.filter(w => northSlice1 >= w.minY - 30 && northSlice1 <= w.maxY + 30);
      await createDimensionLine(v.id, 'North', 2, '北翼居室主隔間 (綠線 15cm)', northL2Walls, false, northY_L2, false);

      // Layer 3: 紫線割線 (北翼走廊/梯間隔間: Y = env.MaxY - 7000mm)
      const northSlice2 = env.MaxY - 7000.0;
      const northL3Walls = vertWalls.filter(w => northSlice2 >= w.minY - 30 && northSlice2 <= w.maxY + 30);
      await createDimensionLine(v.id, 'North', 3, '北翼走廊/梯間隔間 (紫線 15cm)', northL3Walls, false, northY_L3, false);
    } else if (vertWalls.length >= 2) {
      const northVerts = vertWalls.filter(w => w.maxY > (env.MaxY - 15000));
      if (northVerts.length >= 2) {
        const l1Walls = [
          northVerts.reduce((min, w) => w.centerX < min.centerX ? w : min, northVerts[0]),
          northVerts.reduce((max, w) => w.centerX > max.centerX ? w : max, northVerts[0])
        ];
        await createDimensionLine(v.id, 'North', 1, '北側現有外牆總長', l1Walls, false, northY_L1, false);
      }
    }

    // =========================================================================
    // 5. 中庭內凹區 (Courtyard - 方案 C 標準規範): 雙向放樣
    // =========================================================================
    console.log(`  --- 5. 建立 ${v.name} 中庭內凹區 (Courtyard - 方案 C) 標註 ---`);

    // (A) 中庭水平藍框（東北翼南牆基準 Y = 9,938.7 mm，退兩個間距放樣）
    const horizBaseY = 9938.7;
    const horizBoxY_L3 = horizBaseY - 1950.0; // 7,988.7 mm (Step 3)
    const horizBoxY_L2 = horizBaseY - 2600.0; // 7,338.7 mm (Step 4)
    const horizBoxY_L1 = horizBaseY - 3250.0; // 6,688.7 mm (Step 5)

    const eastWingVert = vertWalls.filter(w => w.centerX >= 25000 && w.centerX <= 48000 && w.maxY >= 9000);
    if (eastWingVert.length >= 2) {
      const courtHorizL1Walls = [
        eastWingVert.reduce((min, w) => w.centerX < min.centerX ? w : min, eastWingVert[0]),
        eastWingVert.reduce((max, w) => w.centerX > max.centerX ? w : max, eastWingVert[0])
      ];
      await createDimensionLine(v.id, '中庭水平藍框(東北翼南牆)', 1, '東北翼向南外牆總長', courtHorizL1Walls, false, horizBoxY_L1, false);

      const courtHorizSlice1 = 17500.0;
      const courtHorizL2Walls = [
        courtHorizL1Walls[0],
        ...eastWingVert.filter(w => courtHorizSlice1 >= w.minY - 30 && courtHorizSlice1 <= w.maxY + 30),
        courtHorizL1Walls[1]
      ];
      await createDimensionLine(v.id, '中庭水平藍框(東北翼南牆)', 2, '東北翼居室主隔間 (綠線 15cm)', courtHorizL2Walls, false, horizBoxY_L2, false);

      const courtHorizSlice2 = 11688.7;
      const courtHorizL3Walls = [
        courtHorizL1Walls[0],
        ...eastWingVert.filter(w => courtHorizSlice2 >= w.minY - 30 && courtHorizSlice2 <= w.maxY + 30),
        courtHorizL1Walls[1]
      ];
      await createDimensionLine(v.id, '中庭水平藍框(東北翼南牆)', 3, '東北翼走廊/梯間隔間 (紫線 15cm)', courtHorizL3Walls, false, horizBoxY_L3, false);
    } else {
      console.log(`  ⚠️ 中庭東北翼垂直牆數不足 (${eastWingVert.length})，跳過中庭水平藍框標註`);
    }

    // (B) 中庭垂直紅框（西南翼東牆基準 X = 19,933.3 mm，退兩個間距放樣）
    const vertColFaceX = 19933.3;
    const vertBoxX_L3 = vertColFaceX + 1950.0; // 21,883.3 mm (Step 3)
    const vertBoxX_L2 = vertColFaceX + 2600.0; // 22,533.3 mm (Step 4)
    const vertBoxX_L1 = vertColFaceX + 3250.0; // 23,183.3 mm (Step 5)

    const southWingHoriz = horizWalls.filter(w => w.minX <= 20500 && w.maxX >= 10000 && w.centerY <= 4500 && w.centerY >= -20500);
    if (southWingHoriz.length >= 2) {
      const courtVertL1Walls = [
        southWingHoriz.reduce((min, w) => w.centerY < min.centerY ? w : min, southWingHoriz[0]),
        southWingHoriz.reduce((max, w) => w.centerY > max.centerY ? w : max, southWingHoriz[0])
      ];
      await createDimensionLine(v.id, '中庭垂直紅框(西南翼東牆)', 1, '西南翼向東外牆總長', courtVertL1Walls, true, vertBoxX_L1, true);

      const courtVertSlice1 = 16000.0;
      const courtVertL2Walls = [
        courtVertL1Walls[0],
        ...southWingHoriz.filter(w => courtVertSlice1 >= w.minX - 30 && courtVertSlice1 <= w.maxX + 30),
        courtVertL1Walls[1]
      ];
      await createDimensionLine(v.id, '中庭垂直紅框(西南翼東牆)', 2, '西南翼居室主隔間 (綠線 15cm)', courtVertL2Walls, true, vertBoxX_L2, true);

      const courtVertSlice2 = 12500.0;
      const courtVertL3Walls = [
        courtVertL1Walls[0],
        ...southWingHoriz.filter(w => courtVertSlice2 >= w.minX - 30 && courtVertSlice2 <= w.maxX + 30),
        courtVertL1Walls[1]
      ];
      await createDimensionLine(v.id, '中庭垂直紅框(西南翼東牆)', 3, '西南翼走廊/浴廁隔間 (紫線 15cm)', courtVertL3Walls, true, vertBoxX_L3, true);
    } else {
      console.log(`  ⚠️ 中庭西南翼水平牆數不足 (${southWingHoriz.length})，跳過中庭垂直紅框標註`);
    }

    console.log(`  ✓ 【${v.name}】四向與中庭牆心標註建置完畢！`);
  }

  console.log('\n================================================================');
  console.log('=== 【1FL、3FL、5FL、RFL】所有樓層四向三層牆心標註全數完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
