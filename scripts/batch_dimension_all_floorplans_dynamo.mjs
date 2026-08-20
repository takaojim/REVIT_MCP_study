import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-batch-dimension-agent';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備批次執行「樓板平面圖」柱間距標註 ===\n');

  // 1. 定義所有要標註的「樓板平面圖」視圖
  const targetFloorPlans = [
    { name: '1FL', viewId: 312 },
    { name: '2FL', viewId: 695 },
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: '5FL', viewId: 1334374 },
    { name: 'GL', viewId: 390778 },
    { name: 'RFL', viewId: 586090 },
    { name: 'TRFL', viewId: 586100 }
  ];

  // 2. 解析專屬標註型式 ID (TABC-DIM_*/ S 2.5-柱心-上右 / 下右)
  const typesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = typesRes.data?.DimensionTypes || [];
  const typeUpRight = dimTypes.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右');
  const typeDownRight = dimTypes.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右');

  const typeIdUpRight = typeUpRight?.DimensionTypeId || 2240793;
  const typeIdDownRight = typeDownRight?.DimensionTypeId || 2240801;
  console.log(`標註型式確認 -> 上右: ${typeIdUpRight}, 下右: ${typeIdDownRight}\n`);

  // 3. Dynamo 四方極值紅線基準座標（模型座標 mm）
  const maxY = 38067.05;   // 頂部垂直軸線氣泡中心基準線
  const minY = -26000.00;  // 底部垂直軸線氣泡中心基準線
  const minX = -12941.93;  // 左側水平軸線氣泡中心基準線
  const maxX = 54562.34;   // 右側水平軸線氣泡中心基準線

  const summary = [];

  for (const fp of targetFloorPlans) {
    console.log(`====================================================`);
    console.log(`🚀 開始處理視圖: ${fp.name} (ID: ${fp.viewId})`);
    console.log(`====================================================`);

    // 切換至當前視圖
    await client.sendCommand('set_active_view', { viewId: fp.viewId });

    // 取得視圖資訊與比例
    const vInfo = await client.sendCommand('get_element_info', { elementId: fp.viewId });
    const scaleValParam = vInfo.data?.Parameters?.find(p => p.Name === '比例值 1:' || p.Name === '視圖比例');
    let scale = 100;
    if (scaleValParam?.Value) {
      const match = scaleValParam.Value.match(/\d+$/);
      if (match) scale = parseInt(match[0], 10);
    }

    // 計算依視圖比例自適應之偏移量（Dynamo: 0.5cm 與 0.65cm 圖紙距離）
    const offset1 = (0.5 * 10 * scale);        // Tier 1: 500mm @ 1:100
    const offset2 = offset1 + (0.65 * 10 * scale); // Tier 2: 1150mm @ 1:100

    const topY1 = maxY - offset1; // 37567.05
    const topY2 = maxY - offset2; // 36917.05
    const botY1 = minY + offset1; // -25500.00
    const botY2 = minY + offset2; // -24850.00
    const leftX1 = minX + offset1; // -12441.93
    const leftX2 = minX + offset2; // -11791.93
    const rightX1 = maxX - offset1; // 54062.34
    const rightX2 = maxX - offset2; // 53412.34

    // 清除既有標註
    const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fp.viewId });
    const dimsList = existingDims.data?.Elements || [];
    if (dimsList.length > 0) {
      console.log(`🧹 清除 ${dimsList.length} 個舊標註...`);
      for (const d of dimsList) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
    }

    // 取得視圖內 Grids
    const allGridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: fp.viewId });
    const grids = allGridsRes.data?.Elements || [];
    const gridMap = {};
    for (const g of grids) {
      gridMap[g.Name] = g.ElementId;
    }

    // 軸線集合
    const northGrids = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'].map(n => gridMap[n]).filter(Boolean);
    const southGrids = ['H', 'G', 'F', 'E', 'D'].map(n => gridMap[n]).filter(Boolean);
    const westGrids = ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => gridMap[n]).filter(Boolean);
    const eastGrids = ['5', '6', '7', '8'].map(n => gridMap[n]).filter(Boolean);

    const createdUpRight = [];
    const createdDownRight = [];

    // --- 北側 (Top: 東向西 A -> H，型式: 上右) ---
    const nTotal = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: [gridMap['A'], gridMap['H']],
      startX: 47333.25, startY: topY1,
      endX: -2866.74, endY: topY1
    });
    if (nTotal.data?.DimensionId) createdUpRight.push(nTotal.data.DimensionId);

    const nDetail = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: northGrids,
      startX: 47333.25, startY: topY2,
      endX: -2866.74, endY: topY2
    });
    if (nDetail.data?.DimensionId) createdUpRight.push(nDetail.data.DimensionId);

    // --- 南側 (Bottom: 西向東 H -> D，型式: 下右) ---
    const sTotal = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: [gridMap['H'], gridMap['D']],
      startX: -2866.74, startY: botY1,
      endX: 19608.25, endY: botY1
    });
    if (sTotal.data?.DimensionId) createdDownRight.push(sTotal.data.DimensionId);

    const sDetail = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: southGrids,
      startX: -2866.74, startY: botY2,
      endX: 19608.25, endY: botY2
    });
    if (sDetail.data?.DimensionId) createdDownRight.push(sDetail.data.DimensionId);

    // --- 西側 (Left: 北向南 8 -> 1，型式: 下右) ---
    const wTotal = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: [gridMap['8'], gridMap['1']],
      startX: leftX1, startY: 32113.73,
      endX: leftX1, endY: -19836.27
    });
    if (wTotal.data?.DimensionId) createdDownRight.push(wTotal.data.DimensionId);

    const wDetail = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: westGrids,
      startX: leftX2, startY: 32113.73,
      endX: leftX2, endY: -19836.27
    });
    if (wDetail.data?.DimensionId) createdDownRight.push(wDetail.data.DimensionId);

    // --- 東側 (Right: 南向北 5 -> 8，型式: 上右) ---
    const eTotal = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: [gridMap['5'], gridMap['8']],
      startX: rightX1, startY: 11363.73,
      endX: rightX1, endY: 32113.73
    });
    if (eTotal.data?.DimensionId) createdUpRight.push(eTotal.data.DimensionId);

    const eDetail = await client.sendCommand('create_dimension', {
      viewId: fp.viewId,
      gridIds: eastGrids,
      startX: rightX2, startY: 11363.73,
      endX: rightX2, endY: 32113.73
    });
    if (eDetail.data?.DimensionId) createdUpRight.push(eDetail.data.DimensionId);

    // 套用型式
    for (const id of createdUpRight) {
      await client.sendCommand('change_element_type', { elementId: id, typeId: typeIdUpRight });
    }
    for (const id of createdDownRight) {
      await client.sendCommand('change_element_type', { elementId: id, typeId: typeIdDownRight });
    }

    console.log(`✅ ${fp.name} 標註完成 (共建立 ${createdUpRight.length + createdDownRight.length} 條標註)`);
    summary.push({
      floor: fp.name,
      viewId: fp.viewId,
      count: createdUpRight.length + createdDownRight.length,
      northTotal: nTotal.data?.Value,
      northDetailSegs: nDetail.data?.SegmentsCount,
      southTotal: sTotal.data?.Value,
      southDetailSegs: sDetail.data?.SegmentsCount,
      westTotal: wTotal.data?.Value,
      westDetailSegs: wDetail.data?.SegmentsCount,
      eastTotal: eTotal.data?.Value,
      eastDetailSegs: eDetail.data?.SegmentsCount
    });
  }

  console.log(`\n====================================================`);
  console.log(`🎉 全部「樓板平面圖」視圖柱間距與總長標註批次執行完畢！`);
  console.log(`====================================================`);
  for (const s of summary) {
    console.log(`- [${s.floor}] (ID: ${s.viewId}): 共 ${s.count} 條標註 | 北: ${s.northTotal}mm(${s.northDetailSegs}段) | 南: ${s.southTotal}mm(${s.southDetailSegs}段) | 西: ${s.westTotal}mm(${s.westDetailSegs}段) | 東: ${s.eastTotal}mm(${s.eastDetailSegs}段)`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
