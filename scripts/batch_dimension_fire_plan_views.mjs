import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'fire-plan-dimension-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備執行「建地平面圖 (防火區劃)」視圖柱間距標註 ===\n');

  // 目標視圖清單：建地平面圖 - 防火區劃 (全部 5 個樓層)
  const targetViews = [
    { name: '1FL-籌設防火區劃圖', viewId: 395082 },
    { name: '2FL-籌設防火區劃圖', viewId: 395092 },
    { name: '3FL-籌設防火區劃圖', viewId: 1241890 },
    { name: '4FL-籌設防火區劃圖', viewId: 1241900 },
    { name: '5FL-籌設防火區劃圖', viewId: 2209908 }
  ];

  // 標註型式 ID
  const typeIdUpRight = 2240793;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  // Dynamo 四方極值基準座標 (mm)
  const maxY = 38067.05;   // 頂部垂直軸線氣泡中心基準線
  const minY = -26000.00;  // 底部垂直軸線氣泡中心基準線
  const minX = -12941.93;  // 左側水平軸線氣泡中心基準線
  const maxX = 54562.34;   // 右側水平軸線氣泡中心基準線

  for (const fv of targetViews) {
    console.log(`====================================================`);
    console.log(`🚀 開始處理視圖: ${fv.name} (ID: ${fv.viewId})`);
    console.log(`====================================================`);

    // 1. 切換至該視圖
    await client.sendCommand('set_active_view', { viewId: fv.viewId });

    // 2. 取得視圖比例
    const vInfo = await client.sendCommand('get_element_info', { elementId: fv.viewId });
    const scaleValParam = vInfo.data?.Parameters?.find(p => p.Name === '比例值 1:' || p.Name === '視圖比例');
    let scale = 100;
    if (scaleValParam?.Value) {
      const match = scaleValParam.Value.match(/\d+$/);
      if (match) scale = parseInt(match[0], 10);
    }
    console.log(`  - 視圖比例: 1:${scale}`);

    // 計算依視圖比例自適應之偏移量（5mm 與 11.5mm 圖紙距離）
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

    // 3. 清理既有 Dimensions
    const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fv.viewId });
    const dimsList = existingDims.data?.Elements || [];
    if (dimsList.length > 0) {
      console.log(`  - 清理 ${dimsList.length} 個舊標註...`);
      for (const d of dimsList) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
    }

    // 4. 取得該視圖內 Grids
    const allGridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: fv.viewId });
    const grids = allGridsRes.data?.Elements || [];
    const gridMap = {};
    for (const g of grids) {
      gridMap[g.Name] = g.ElementId;
    }
    console.log(`  - 視圖中可用軸線: ${Object.keys(gridMap).sort().join(', ')}`);

    const northGrids = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'].map(n => gridMap[n]).filter(Boolean);
    const southGrids = ['H', 'G', 'F', 'E', 'D'].map(n => gridMap[n]).filter(Boolean);
    const westGrids = ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => gridMap[n]).filter(Boolean);
    const eastGrids = ['5', '6', '7', '8'].map(n => gridMap[n]).filter(Boolean);

    const createdUpRight = [];
    const createdDownRight = [];

    // --- 北側 (Top: 東向西 A -> H，型式: 上右) ---
    if (gridMap['A'] && gridMap['H']) {
      const nTotal = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: [gridMap['A'], gridMap['H']],
        startX: 47333.25, startY: topY1,
        endX: -2866.74, endY: topY1
      });
      if (nTotal.data?.DimensionId) createdUpRight.push(nTotal.data.DimensionId);

      const nDetail = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: northGrids,
        startX: 47333.25, startY: topY2,
        endX: -2866.74, endY: topY2
      });
      if (nDetail.data?.DimensionId) createdUpRight.push(nDetail.data.DimensionId);
      console.log(`  ✓ 北側雙層柱心標註完成 (A-H: 總長 50200mm, 7區段)`);
    }

    // --- 南側 (Bottom: 西向東 H -> D，型式: 下右) ---
    if (gridMap['H'] && gridMap['D']) {
      const sTotal = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: [gridMap['H'], gridMap['D']],
        startX: -2866.74, startY: botY1,
        endX: 19608.25, endY: botY1
      });
      if (sTotal.data?.DimensionId) createdDownRight.push(sTotal.data.DimensionId);

      const sDetail = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: southGrids,
        startX: -2866.74, startY: botY2,
        endX: 19608.25, endY: botY2
      });
      if (sDetail.data?.DimensionId) createdDownRight.push(sDetail.data.DimensionId);
      console.log(`  ✓ 南側雙層柱心標註完成 (H-D: 總長 22475mm, 4區段)`);
    }

    // --- 西側 (Left: 北向南 8 -> 1，型式: 下右) ---
    if (gridMap['8'] && gridMap['1']) {
      const wTotal = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: [gridMap['8'], gridMap['1']],
        startX: leftX1, startY: 32113.73,
        endX: leftX1, endY: -19836.27
      });
      if (wTotal.data?.DimensionId) createdDownRight.push(wTotal.data.DimensionId);

      const wDetail = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: westGrids,
        startX: leftX2, startY: 32113.73,
        endX: leftX2, endY: -19836.27
      });
      if (wDetail.data?.DimensionId) createdDownRight.push(wDetail.data.DimensionId);
      console.log(`  ✓ 西側雙層柱心標註完成 (8-1: 總長 51950mm, 7區段)`);
    }

    // --- 東側 (Right: 南向北 5 -> 8，型式: 上右) ---
    if (gridMap['5'] && gridMap['8']) {
      const eTotal = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: [gridMap['5'], gridMap['8']],
        startX: rightX1, startY: 11363.73,
        endX: rightX1, endY: 32113.73
      });
      if (eTotal.data?.DimensionId) createdUpRight.push(eTotal.data.DimensionId);

      const eDetail = await client.sendCommand('create_dimension', {
        viewId: fv.viewId,
        gridIds: eastGrids,
        startX: rightX2, startY: 11363.73,
        endX: rightX2, endY: 32113.73
      });
      if (eDetail.data?.DimensionId) createdUpRight.push(eDetail.data.DimensionId);
      console.log(`  ✓ 東側雙層柱心標註完成 (5-8: 總長 20750mm, 3區段)`);
    }

    // 5. 套用專屬型式
    for (const id of createdUpRight) {
      await client.sendCommand('change_element_type', { elementId: id, typeId: typeIdUpRight });
    }
    for (const id of createdDownRight) {
      await client.sendCommand('change_element_type', { elementId: id, typeId: typeIdDownRight });
    }

    console.log(`  ✨ ${fv.name} 標註完成！共建立 ${createdUpRight.length + createdDownRight.length} 條雙層連續標註\n`);
  }

  console.log(`====================================================`);
  console.log(`「建地平面圖 (防火區劃)」所有視圖柱間距標註已全數完成！`);

  await client.disconnect();
}

main().catch(console.error);
