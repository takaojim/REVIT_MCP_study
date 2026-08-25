import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'floor-plan-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備識別「樓板平面圖」所有視圖 ===\n');

  // 1. 取得所有視圖 (maxCount: 10000)
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const floorPlanViews = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || '';

    // 判斷是否為「樓板平面圖」 (排除天花板平面圖 CeilingPlan、結構平面圖、明細表等)
    const isFloorPlan = (
      info.data?.ViewType === 'FloorPlan' ||
      viewType === '樓板平面圖' ||
      typeName.includes('樓板平面圖') ||
      typeName.includes('建築平面圖') ||
      (viewType.includes('平面') && !viewType.includes('天花板') && !viewType.includes('結構') && !viewType.includes('建地平面圖') && !typeName.includes('防火區劃'))
    );

    // 排除範本或非正常樓板平面圖
    if (isFloorPlan && !name.startsWith('{') && !typeName.includes('防火區劃')) {
      floorPlanViews.push({
        id: v.ElementId,
        name: name,
        viewType,
        typeName,
        scale: info.data?.Scale || 100
      });
    }
  }

  console.log(`=== 找到 ${floorPlanViews.length} 個「樓板平面圖」視圖 ===`);
  for (const fv of floorPlanViews) {
    console.log(`- ID: ${fv.id.toString().padEnd(8)} | 族群: "${fv.viewType}" | 類型: "${fv.typeName}" | 名稱: "${fv.name}" | 比例: 1:${fv.scale}`);
  }

  // 標註型式 ID
  const typeIdUpRight = 2240793;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  // Dynamo 四方極值基準座標 (mm)
  const maxY = 38067.05;   // 頂部垂直軸線氣泡中心基準線
  const minY = -26000.00;  // 底部垂直軸線氣泡中心基準線
  const minX = -12941.93;  // 左側水平軸線氣泡中心基準線
  const maxX = 54562.34;   // 右側水平軸線氣泡中心基準線

  // 2. 依序為各樓板平面圖視圖執行四向雙層柱心標註
  for (const fv of floorPlanViews) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🚀 開始處理樓板平面圖: ${fv.name} (View ID: ${fv.id}, 比例 1:${fv.scale})`);

    // 切換視圖
    await client.sendCommand('set_active_view', { viewId: fv.id });

    // 清理既有 Dimensions
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fv.id });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
      console.log(`  - 已清理 ${dimQuery.data.Elements.length} 個舊標註`);
    }

    // 取得視圖內可見的 Grids
    const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: fv.id });
    const grids = gridsRes.data?.Elements || [];
    console.log(`  - 視圖中可用軸線: ${grids.map(g => g.Name).join(', ')}`);

    if (grids.length < 2) {
      console.log(`  ℹ 軸線數量不足，略過標註`);
      continue;
    }

    const gridMap = new Map();
    for (const g of grids) {
      gridMap.set(g.Name, g.ElementId);
    }

    const scale = fv.scale || 100;
    const offsetTier1 = 5.0 * scale;   // 總尺寸距圓圈 5mm (圖紙) -> 模型 mm
    const offsetTier2 = 11.5 * scale;  // 柱間距距圓圈 11.5mm (圖紙) -> 模型 mm

    const dimsToChangeType = [];

    // --- 1. 北側標註 (Top: A -> H) ---
    const northGrids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      .filter(name => gridMap.has(name))
      .map(name => gridMap.get(name));

    if (northGrids.length >= 2) {
      const lineY_Tier1 = maxY - offsetTier1;
      const lineY_Tier2 = maxY - offsetTier2;

      // Tier 1: 總尺寸 (由右至左: H -> A，確保 5mm 輔助線朝下指向建物)
      const resT1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [northGrids[northGrids.length - 1], northGrids[0]],
        startX: 47333.25, startY: lineY_Tier1,
        endX: -2866.74, endY: lineY_Tier1
      });
      if (resT1.success && resT1.data?.DimensionId) {
        dimsToChangeType.push({ id: resT1.data.DimensionId, typeId: typeIdUpRight });
      }

      // Tier 2: 柱間距 (由右至左: H -> G -> ... -> A)
      const resT2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [...northGrids].reverse(),
        startX: 47333.25, startY: lineY_Tier2,
        endX: -2866.74, endY: lineY_Tier2
      });
      if (resT2.success && resT2.data?.DimensionId) {
        dimsToChangeType.push({ id: resT2.data.DimensionId, typeId: typeIdUpRight });
      }
      console.log(`  ✓ 北側雙層柱心標註完成 (A-H)`);
    }

    // --- 2. 南側標註 (Bottom: H -> D) ---
    const southGrids = ['H', 'G', 'F', 'E', 'D']
      .filter(name => gridMap.has(name))
      .map(name => gridMap.get(name));

    if (southGrids.length >= 2) {
      const lineY_Tier1 = minY + offsetTier1;
      const lineY_Tier2 = minY + offsetTier2;

      // Tier 1: 總尺寸 (由左至右: H -> D，確保 5mm 輔助線朝上指向建物)
      const resT1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [southGrids[0], southGrids[southGrids.length - 1]],
        startX: -2866.74, startY: lineY_Tier1,
        endX: 19608.25, endY: lineY_Tier1
      });
      if (resT1.success && resT1.data?.DimensionId) {
        dimsToChangeType.push({ id: resT1.data.DimensionId, typeId: typeIdDownRight });
      }

      // Tier 2: 柱間距 (由左至右: H -> G -> ... -> D)
      const resT2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: southGrids,
        startX: -2866.74, startY: lineY_Tier2,
        endX: 19608.25, endY: lineY_Tier2
      });
      if (resT2.success && resT2.data?.DimensionId) {
        dimsToChangeType.push({ id: resT2.data.DimensionId, typeId: typeIdDownRight });
      }
      console.log(`  ✓ 南側雙層柱心標註完成 (H-D)`);
    }

    // --- 3. 西側標註 (Left: 8 -> 1) ---
    const westGrids = ['8', '7', '6', '5', '4', '3', '2', '1']
      .filter(name => gridMap.has(name))
      .map(name => gridMap.get(name));

    if (westGrids.length >= 2) {
      const lineX_Tier1 = minX + offsetTier1;
      const lineX_Tier2 = minX + offsetTier2;

      // Tier 1: 總尺寸 (由頂至底: 8 -> 1，確保 5mm 輔助線朝右指向建物)
      const resT1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [westGrids[0], westGrids[westGrids.length - 1]],
        startX: lineX_Tier1, startY: 32113.73,
        endX: lineX_Tier1, endY: -19836.27
      });
      if (resT1.success && resT1.data?.DimensionId) {
        dimsToChangeType.push({ id: resT1.data.DimensionId, typeId: typeIdDownRight });
      }

      // Tier 2: 柱間距 (由頂至底: 8 -> 7 -> ... -> 1)
      const resT2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: westGrids,
        startX: lineX_Tier2, startY: 32113.73,
        endX: lineX_Tier2, endY: -19836.27
      });
      if (resT2.success && resT2.data?.DimensionId) {
        dimsToChangeType.push({ id: resT2.data.DimensionId, typeId: typeIdDownRight });
      }
      console.log(`  ✓ 西側雙層柱心標註完成 (8-1)`);
    }

    // --- 4. 東側標註 (Right: 5 -> 8) ---
    const eastGrids = ['5', '6', '7', '8']
      .filter(name => gridMap.has(name))
      .map(name => gridMap.get(name));

    if (eastGrids.length >= 2) {
      const lineX_Tier1 = maxX - offsetTier1;
      const lineX_Tier2 = maxX - offsetTier2;

      // Tier 1: 總尺寸 (由底至頂: 5 -> 8，確保 5mm 輔助線朝左指向建物)
      const resT1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [eastGrids[0], eastGrids[eastGrids.length - 1]],
        startX: lineX_Tier1, startY: 11363.73,
        endX: lineX_Tier1, endY: 32113.73
      });
      if (resT1.success && resT1.data?.DimensionId) {
        dimsToChangeType.push({ id: resT1.data.DimensionId, typeId: typeIdUpRight });
      }

      // Tier 2: 柱間距 (由底至頂: 5 -> 6 -> ... -> 8)
      const resT2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: eastGrids,
        startX: lineX_Tier2, startY: 11363.73,
        endX: lineX_Tier2, endY: 32113.73
      });
      if (resT2.success && resT2.data?.DimensionId) {
        dimsToChangeType.push({ id: resT2.data.DimensionId, typeId: typeIdUpRight });
      }
      console.log(`  ✓ 東側雙層柱心標註完成 (5-8)`);
    }

    // 批次套用標註型式
    for (const d of dimsToChangeType) {
      await client.sendCommand('change_element_type', {
        elementId: d.id,
        typeId: d.typeId
      });
    }

    console.log(`  ✨ ${fv.name} 標註完成！共建立 ${dimsToChangeType.length} 條雙層連續標註`);
  }

  console.log(`\n============================================================`);
  console.log(`「樓板平面圖」所有視圖柱間距標註已全數完成！`);

  await client.disconnect();
}

main().catch(console.error);
