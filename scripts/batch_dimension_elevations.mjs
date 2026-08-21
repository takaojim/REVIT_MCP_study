import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-dimension-elevations-top';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備批次在「立面圖頂部（軸號圓圈下方）」建立柱間距雙層標註 ===\n');

  // 1. 定義所有「立面圖(建築立面)」目標視圖
  const targetElevationViews = [
    { name: '北', viewId: 8157, type: 'NS', dir: 'A_TO_H' },
    { name: '東', viewId: 8176, type: 'EW', dir: '1_TO_8' },
    { name: '南', viewId: 98984, type: 'NS', dir: 'H_TO_A' },
    { name: '西', viewId: 8237, type: 'EW', dir: '8_TO_1' }
  ];

  // 2. 解析專屬標註型式 ID (TABC-DIM_*/ S 2.5-柱心-上右 / 下右)
  const typesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = typesRes.data?.DimensionTypes || [];
  const typeUpRight = dimTypes.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右');
  const typeDownRight = dimTypes.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右');

  const typeIdUpRight = typeUpRight?.DimensionTypeId || 2240793;
  const typeIdDownRight = typeDownRight?.DimensionTypeId || 2240801;
  console.log(`標註型式確認 -> 上右: ${typeIdUpRight}, 下右: ${typeIdDownRight}\n`);

  // 3. 頂部標註高度定位（TRFL 頂層高程為 26,800 mm，軸號氣泡中心約在 34,000 ~ 35,000 mm）
  // 依 1:60 比例退縮：
  // Tier 1 (外圈總尺寸): 距氣泡中心往建物退縮 300 mm (圖紙 5.0 mm) -> Z = 33,500 mm
  // Tier 2 (內圈細部尺寸): 距氣泡中心往建物退縮 690 mm (圖紙 11.5 mm) -> Z = 32,800 mm
  const topBubbleZ = 34000;
  const tier1_Z = topBubbleZ - 300; // 33700
  const tier2_Z = topBubbleZ - 690; // 33310

  const summary = [];

  for (const ev of targetElevationViews) {
    console.log(`====================================================`);
    console.log(`🚀 開始處理立面視圖: ${ev.name} (ID: ${ev.viewId})`);
    console.log(`====================================================`);

    // 切換至當前視圖
    await client.sendCommand('set_active_view', { viewId: ev.viewId });

    // 取得視圖資訊與比例
    const vInfo = await client.sendCommand('get_element_info', { elementId: ev.viewId });
    const scaleValParam = vInfo.data?.Parameters?.find(p => p.Name === '比例值 1:' || p.Name === '視圖比例');
    let scale = 60;
    if (scaleValParam?.Value) {
      const match = scaleValParam.Value.match(/\d+$/);
      if (match) scale = parseInt(match[0], 10);
    }
    console.log(`視圖比例: 1:${scale}`);

    // 清除該視圖既有標註
    const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: ev.viewId });
    const dimsList = existingDims.data?.Elements || [];
    if (dimsList.length > 0) {
      console.log(`🧹 清除 ${dimsList.length} 個舊標註...`);
      for (const d of dimsList) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
    }

    // 取得視圖內 Grids
    const allGridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: ev.viewId });
    const grids = allGridsRes.data?.Elements || [];
    const gridMap = {};
    for (const g of grids) {
      gridMap[g.Name] = g.ElementId;
    }

    const createdDims = [];

    if (ev.type === 'NS') {
      // 字母軸線 A ~ H
      let orderedGrids = [];
      let startX = 0, endX = 0;

      if (ev.dir === 'A_TO_H') {
        // 北立面: 東向西 (A -> H)
        orderedGrids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => gridMap[n]).filter(Boolean);
        startX = 47333.25;
        endX = -1691.74;
      } else {
        // 南立面: 西向東 (H -> A)
        orderedGrids = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'].map(n => gridMap[n]).filter(Boolean);
        startX = -1691.74;
        endX = 47333.25;
      }

      // 1. 外圈總尺寸 (Tier 1) - 放置在頂部 Z = tier1_Z
      const totalRes = await client.sendCommand('create_dimension', {
        viewId: ev.viewId,
        gridIds: [orderedGrids[0], orderedGrids[orderedGrids.length - 1]],
        startX: startX,
        startY: 0,
        startZ: tier1_Z,
        endX: endX,
        endY: 0,
        endZ: tier1_Z
      });
      console.log(`  - 頂部總尺寸 (Tier 1 @ Z=${tier1_Z}): ID=${totalRes.data?.DimensionId}, Value=${totalRes.data?.Value}mm`);

      // 2. 內圈連續細部柱間距尺寸 (Tier 2) - 放置在頂部 Z = tier2_Z
      const continuousRes = await client.sendCommand('create_dimension', {
        viewId: ev.viewId,
        gridIds: orderedGrids,
        startX: startX,
        startY: 0,
        startZ: tier2_Z,
        endX: endX,
        endY: 0,
        endZ: tier2_Z
      });
      console.log(`  - 頂部連續柱間距 (Tier 2 @ Z=${tier2_Z}): ID=${continuousRes.data?.DimensionId}, Segments=${continuousRes.data?.SegmentsCount}`);

      const dimIds = [totalRes.data?.DimensionId, continuousRes.data?.DimensionId].filter(Boolean);
      // 套用型式 (北立面上右、南立面下右)
      const targetTypeId = (ev.name === '北' || ev.name === '東') ? typeIdUpRight : typeIdDownRight;
      if (dimIds.length > 0) {
        await client.sendCommand('change_element_type', {
          elementIds: dimIds,
          typeId: targetTypeId
        });
      }

      createdDims.push({
        view: ev.name,
        totalId: totalRes.data?.DimensionId,
        totalVal: totalRes.data?.Value,
        contId: continuousRes.data?.DimensionId,
        segments: continuousRes.data?.SegmentsCount,
        posZ: `${tier1_Z} / ${tier2_Z} mm`,
        type: (targetTypeId === typeIdUpRight ? '上右' : '下右')
      });

    } else if (ev.type === 'EW') {
      // 數字軸線 1 ~ 8
      let orderedGrids = [];
      let startY = 0, endY = 0;

      if (ev.dir === '1_TO_8') {
        // 東立面: 南向北 (1 -> 8)
        orderedGrids = ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => gridMap[n]).filter(Boolean);
        startY = -26000;
        endY = 38067;
      } else {
        // 西立面: 北向南 (8 -> 1)
        orderedGrids = ['8', '7', '6', '5', '4', '3', '2', '1'].map(n => gridMap[n]).filter(Boolean);
        startY = 38067;
        endY = -26000;
      }

      // 1. 外圈總尺寸 (Tier 1) - 放置在頂部 Z = tier1_Z
      const totalRes = await client.sendCommand('create_dimension', {
        viewId: ev.viewId,
        gridIds: [orderedGrids[0], orderedGrids[orderedGrids.length - 1]],
        startX: 0,
        startY: startY,
        startZ: tier1_Z,
        endX: 0,
        endY: endY,
        endZ: tier1_Z
      });
      console.log(`  - 頂部總尺寸 (Tier 1 @ Z=${tier1_Z}): ID=${totalRes.data?.DimensionId}, Value=${totalRes.data?.Value}mm`);

      // 2. 內圈連續細部柱間距尺寸 (Tier 2) - 放置在頂部 Z = tier2_Z
      const continuousRes = await client.sendCommand('create_dimension', {
        viewId: ev.viewId,
        gridIds: orderedGrids,
        startX: 0,
        startY: startY,
        startZ: tier2_Z,
        endX: 0,
        endY: endY,
        endZ: tier2_Z
      });
      console.log(`  - 頂部連續柱間距 (Tier 2 @ Z=${tier2_Z}): ID=${continuousRes.data?.DimensionId}, Segments=${continuousRes.data?.SegmentsCount}`);

      const dimIds = [totalRes.data?.DimensionId, continuousRes.data?.DimensionId].filter(Boolean);
      const targetTypeId = (ev.name === '北' || ev.name === '東') ? typeIdUpRight : typeIdDownRight;
      if (dimIds.length > 0) {
        await client.sendCommand('change_element_type', {
          elementIds: dimIds,
          typeId: targetTypeId
        });
      }

      createdDims.push({
        view: ev.name,
        totalId: totalRes.data?.DimensionId,
        totalVal: totalRes.data?.Value,
        contId: continuousRes.data?.DimensionId,
        segments: continuousRes.data?.SegmentsCount,
        posZ: `${tier1_Z} / ${tier2_Z} mm`,
        type: (targetTypeId === typeIdUpRight ? '上右' : '下右')
      });
    }

    summary.push(...createdDims);
  }

  console.log('\n====================================================');
  console.log('🎉 「立面圖(建築立面)」頂部柱間距雙層標註完成！成果彙整：');
  console.log('====================================================');
  console.table(summary);

  await client.disconnect();
}

main().catch(console.error);
