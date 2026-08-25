import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-2fl-wall-dims-exact';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 牆心標註】右側 (東)、左側 (西)、下側 (南) 三層標註實作 ===');
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
  console.log(`實體外框極值: X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm`);

  // 2. 收集視圖上所有牆體資訊
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];
  console.log(`收集到 ${allWalls.length} 道牆體，分析每道牆的中心線幾何...`);

  const wallDetails = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      const sx = info.data.StartX;
      const sy = info.data.StartY;
      const ex = info.data.EndX;
      const ey = info.data.EndY;
      const isVert = Math.Abs ? Math.Abs(ex - sx) < 40 : Math.abs(ex - sx) < 40;
      const isHoriz = Math.Abs ? Math.Abs(ey - sy) < 40 : Math.abs(ey - sy) < 40;
      
      // 排除非實體牆或太短的裝飾粉刷（如小於 300mm）
      if (info.data.Length < 250) continue;
      if (info.data.Name?.includes('粉刷') && info.data.Length < 500) continue;

      wallDetails.push({
        id: w.ElementId,
        name: w.Name,
        wallType: info.data.WallType,
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
        centerY: (sy + ey) / 2,
        length: info.data.Length
      });
    }
  }

  const vertWalls = wallDetails.filter(w => w.isVert);
  const horizWalls = wallDetails.filter(w => w.isHoriz);
  console.log(`- 垂直牆 (南北向): ${vertWalls.length} 道`);
  console.log(`- 水平牆 (東西向): ${horizWalls.length} 道\n`);

  // 輔助函式：根據割線與方向聚類並建立標註
  async function createWallDimension(sideName, layerNum, desc, wallsList, isVerticalAxis, dimCoord, spanMin, spanMax, sliceCoord, isAscending) {
    const tol = 30.0; // 30mm 聚類容許度
    let candidates = [];

    if (sliceCoord !== null && sliceCoord !== undefined) {
      for (const w of wallsList) {
        const cMin = isVerticalAxis ? w.minX : w.minY;
        const cMax = isVerticalAxis ? w.maxX : w.maxY;
        if (sliceCoord >= cMin - tol && sliceCoord <= cMax + tol) {
          candidates.push(w);
        }
      }
    } else {
      // 總長 (Layer 1): 包含所有候選外牆
      candidates = [...wallsList];
    }

    if (candidates.length === 0) {
      console.log(`  ⚠️ [${sideName} - 第 ${layerNum} 層 (${desc})] 無符合割線之牆體，跳過`);
      return null;
    }

    // 依中心線座標排序
    const sortKey = isVerticalAxis ? 'centerY' : 'centerX';
    candidates.sort((a, b) => a[sortKey] - b[sortKey]);

    // 聚類去重
    const unique = [];
    for (const w of candidates) {
      if (unique.length === 0 || Math.abs(unique[unique.length - 1][sortKey] - w[sortKey]) > tol) {
        unique.push(w);
      }
    }

    // 若為 Layer 1 (外牆總長)，只取頭尾極值兩道
    let targetWalls = unique;
    if (sliceCoord === null || sliceCoord === undefined) {
      if (unique.length < 2) return null;
      targetWalls = [unique[0], unique[unique.length - 1]];
    }

    if (targetWalls.length < 2) {
      console.log(`  ⚠️ [${sideName} - 第 ${layerNum} 層 (${desc})] 唯一牆體數 < 2 (${targetWalls.length})，跳過`);
      return null;
    }

    // 排序方向
    if (!isAscending) {
      targetWalls.reverse();
    }

    const wallIds = targetWalls.map(w => w.id);

    // 決定標註起訖線 (dimLine)
    let startX, startY, endX, endY;
    if (isVerticalAxis) {
      // 垂直標註線 (沿 Y 軸)
      startX = dimCoord;
      startY = spanMin;
      endX = dimCoord;
      endY = spanMax;
    } else {
      // 水平標註線 (沿 X 軸，由東往西)
      startX = spanMax;
      startY = dimCoord;
      endX = spanMin;
      endY = dimCoord;
    }

    const res = await client.sendCommand('create_dimension', {
      viewId: viewId,
      elementIds: wallIds,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      dimensionTypeId: typeIdWallDot
    });

    if (res.success && res.data?.DimensionId) {
      console.log(`  ✓ [${sideName} - 第 ${layerNum} 層 (${desc})] ID: ${res.data.DimensionId}, 分段數: ${targetWalls.length - 1}, 牆數: ${targetWalls.length}`);
      return res.data.DimensionId;
    } else {
      console.log(`  ❌ [${sideName} - 第 ${layerNum} 層 (${desc})] 建立失敗:`, res.error);
      return null;
    }
  }

  console.log('🚀 開始建立各側三層牆心階梯標註...');

  // =========================================================================
  // 1. 東側 (Right / East): 測量水平牆的 Y 坐標 (由南往北 / 遞增)
  // =========================================================================
  console.log('\n--- 【東側 (East / 右側)】---');
  const east_X_layer1 = env.MaxX + 3250.0; // Step 5 (50,983.3 mm)
  const east_X_layer2 = env.MaxX + 2600.0; // Step 4 (50,333.3 mm)
  const east_X_layer3 = env.MaxX + 1950.0; // Step 3 (49,683.3 mm)

  // Layer 1: 外牆總長 (南北兩端)
  await createWallDimension('East', 1, '外牆總長', horizWalls, true, east_X_layer1, env.MinY - 1000, env.MaxY + 1000, null, true);

  // Layer 2: 綠線 (東外牆內縮 3.0m) - 主要居室隔間
  const eastSlice1 = env.MaxX - 3000.0;
  await createWallDimension('East', 2, '居室主隔間 (綠線)', horizWalls, true, east_X_layer2, env.MinY - 1000, env.MaxY + 1000, eastSlice1, true);

  // Layer 3: 紫線 (東外牆內縮 8.0m / 走廊側) - 附屬/走廊機能隔間
  const eastSlice2 = env.MaxX - 8000.0;
  await createWallDimension('East', 3, '走廊/機能隔間 (紫線)', horizWalls, true, east_X_layer3, env.MinY - 1000, env.MaxY + 1000, eastSlice2, true);

  // =========================================================================
  // 2. 西側 (Left / West): 測量水平牆的 Y 坐標 (由南往北 / 遞增)
  // =========================================================================
  console.log('\n--- 【西側 (West / 左側)】---');
  const west_X_layer1 = env.MinX - 3250.0; // Step 5 (-8,841.7 mm)
  const west_X_layer2 = env.MinX - 2600.0; // Step 4 (-8,191.7 mm)
  const west_X_layer3 = env.MinX - 1950.0; // Step 3 (-7,541.7 mm)

  // Layer 1: 外牆總長 (南北兩端)
  await createWallDimension('West', 1, '外牆總長', horizWalls, true, west_X_layer1, env.MinY - 1000, env.MaxY + 1000, null, true);

  // Layer 2: 綠線 (西外牆內縮 3.0m) - 主要空間隔間
  const westSlice1 = env.MinX + 3000.0;
  await createWallDimension('West', 2, '居室/空間主隔間 (綠線)', horizWalls, true, west_X_layer2, env.MinY - 1000, env.MaxY + 1000, westSlice1, true);

  // Layer 3: 紫線 (西外牆內縮 7.5m / 走廊側) - 走廊/梯間/機能隔間
  const westSlice2 = env.MinX + 7500.0;
  await createWallDimension('West', 3, '走廊/機能隔間 (紫線)', horizWalls, true, west_X_layer3, env.MinY - 1000, env.MaxY + 1000, westSlice2, true);

  // =========================================================================
  // 3. 南側 (Bottom / South): 測量垂直牆的 X 坐標 (由東往西 / 遞減)
  // =========================================================================
  console.log('\n--- 【南側 (South / 下側)】---');
  const south_Y_layer1 = env.MinY - 3250.0; // Step 5 (-23,486.3 mm)
  const south_Y_layer2 = env.MinY - 2600.0; // Step 4 (-22,836.3 mm)
  const south_Y_layer3 = env.MinY - 1950.0; // Step 3 (-22,186.3 mm)

  // Layer 1: 外牆總長 (東西兩端)
  await createWallDimension('South', 1, '外牆總長', vertWalls, false, south_Y_layer1, env.MinX - 1000, env.MaxX + 1000, null, false);

  // Layer 2: 綠線 (南外牆內縮 3.0m) - 居室/交誼廳主隔間
  const southSlice1 = env.MinY + 3000.0;
  await createWallDimension('South', 2, '居室/交誼廳主隔間 (綠線)', vertWalls, false, south_Y_layer2, env.MinX - 1000, env.MaxX + 1000, southSlice1, false);

  // Layer 3: 紫線 (南外牆內縮 7.5m / 走廊側) - 走廊/公共機能隔間
  const southSlice2 = env.MinY + 7500.0;
  await createWallDimension('South', 3, '走廊/附屬機能隔間 (紫線)', vertWalls, false, south_Y_layer3, env.MinX - 1000, env.MaxX + 1000, southSlice2, false);

  console.log('\n================================================================');
  console.log('=== 【2FL 牆心標註】東、西、南三側標註建置完畢！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
