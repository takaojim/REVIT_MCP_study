import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'floor-plan-master-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備執行「樓板平面圖」所有視圖柱間距標註 ===\n');

  // 1. 取得專案中的標準標註型式 (TABC-DIM 或預設)
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];

  let defaultLinearType = dimTypes.find(dt => dt.DimensionTypeName.includes('TABC-DIM_*/ S')) ||
                          dimTypes.find(dt => dt.DimensionTypeName.includes('TABC-DIM')) ||
                          dimTypes.find(dt => dt.DimensionTypeName === 'DIMing') ||
                          dimTypes.find(dt => dt.FamilyName === '線性尺寸標註型式');

  const activeTypeId = defaultLinearType ? defaultLinearType.DimensionTypeId : null;
  console.log(`使用標註型式: ID ${activeTypeId} (${defaultLinearType?.DimensionTypeName})\n`);

  // 2. 取得所有視圖 (maxCount: 10000)
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const floorPlanViews = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || '';

    // 判斷是否為「樓板平面圖」 (排除天花板平面圖、結構平面圖、明細表等)
    const isFloorPlan = (
      info.data?.ViewType === 'FloorPlan' ||
      viewType === '樓板平面圖' ||
      typeName.includes('樓板平面圖') ||
      typeName.includes('建築平面圖') ||
      (viewType.includes('平面') && !viewType.includes('天花板') && !viewType.includes('結構') && !viewType.includes('建地平面圖') && !typeName.includes('防火區劃'))
    );

    // 排除範本與非標準樓板平面圖
    if (isFloorPlan && !name.startsWith('{')) {
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
    console.log(`- ID: ${fv.id.toString().padEnd(8)} | 名稱: "${fv.name}" | 比例: 1:${fv.scale}`);
  }

  // 3. 處理每個樓板平面圖
  for (const fv of floorPlanViews) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🚀 開始處理視圖: ${fv.name} (View ID: ${fv.id}, 比例 1:${fv.scale})`);

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

    // 取得視圖中可見的 Grids
    const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: fv.id });
    const grids = gridsRes.data?.Elements || [];
    if (grids.length < 2) {
      console.log(`  ℹ 軸線不足，略過`);
      continue;
    }

    const gridMap = new Map();
    for (const g of grids) {
      gridMap.set(g.Name, g.ElementId);
    }

    // 垂直軸線 (A, B, C, D)
    const vertNames = ['A', 'B', 'C', 'D'].filter(n => gridMap.has(n));
    const vertIds = vertNames.map(n => gridMap.get(n));

    // 水平軸線 (1, 2, 3, 4)
    const horizNames = ['4', '3', '2', '1'].filter(n => gridMap.has(n));
    const horizIds = horizNames.map(n => gridMap.get(n));

    const scale = fv.scale || 100;
    const offsetTier1 = 5.0 * scale;   // 5mm (圖紙) -> 模型 mm
    const offsetTier2 = 11.5 * scale;  // 11.5mm (圖紙) -> 模型 mm

    const maxY = 38067.05;
    const minY = -26000.00;
    const minX = -12941.93;
    const maxX = 54562.34;

    const createdDims = [];

    // --- 頂部 (北側: D -> A) ---
    if (vertIds.length >= 2) {
      const lineY_T1 = maxY - offsetTier1;
      const lineY_T2 = maxY - offsetTier2;

      // Tier 1 (總跨度)
      const r1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [vertIds[vertIds.length - 1], vertIds[0]],
        startX: 47333.25, startY: lineY_T1,
        endX: -2866.74, endY: lineY_T1
      });
      if (r1.success && r1.data?.DimensionId) createdDims.push(r1.data.DimensionId);

      // Tier 2 (柱間距)
      const r2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [...vertIds].reverse(),
        startX: 47333.25, startY: lineY_T2,
        endX: -2866.74, endY: lineY_T2
      });
      if (r2.success && r2.data?.DimensionId) createdDims.push(r2.data.DimensionId);
      console.log(`  ✓ 頂部北側柱心雙層標註完成 (${vertNames.join('-')})`);
    }

    // --- 底部 (南側: D -> A) ---
    if (vertIds.length >= 2) {
      const lineY_T1 = minY + offsetTier1;
      const lineY_T2 = minY + offsetTier2;

      // Tier 1 (總跨度)
      const r1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [vertIds[0], vertIds[vertIds.length - 1]],
        startX: -2866.74, startY: lineY_T1,
        endX: 47333.25, endY: lineY_T1
      });
      if (r1.success && r1.data?.DimensionId) createdDims.push(r1.data.DimensionId);

      // Tier 2 (柱間距)
      const r2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: vertIds,
        startX: -2866.74, startY: lineY_T2,
        endX: 47333.25, endY: lineY_T2
      });
      if (r2.success && r2.data?.DimensionId) createdDims.push(r2.data.DimensionId);
      console.log(`  ✓ 底部南側柱心雙層標註完成 (${vertNames.join('-')})`);
    }

    // --- 左側 (西側: 4 -> 1) ---
    if (horizIds.length >= 2) {
      const lineX_T1 = minX + offsetTier1;
      const lineX_T2 = minX + offsetTier2;

      // Tier 1 (總跨度)
      const r1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [horizIds[0], horizIds[horizIds.length - 1]],
        startX: lineX_T1, startY: 32113.73,
        endX: lineX_T1, endY: -19836.27
      });
      if (r1.success && r1.data?.DimensionId) createdDims.push(r1.data.DimensionId);

      // Tier 2 (柱間距)
      const r2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: horizIds,
        startX: lineX_T2, startY: 32113.73,
        endX: lineX_T2, endY: -19836.27
      });
      if (r2.success && r2.data?.DimensionId) createdDims.push(r2.data.DimensionId);
      console.log(`  ✓ 左側西側柱心雙層標註完成 (${horizNames.join('-')})`);
    }

    // --- 右側 (東側: 1 -> 4) ---
    if (horizIds.length >= 2) {
      const lineX_T1 = maxX - offsetTier1;
      const lineX_T2 = maxX - offsetTier2;

      // Tier 1 (總跨度)
      const r1 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [horizIds[horizIds.length - 1], horizIds[0]],
        startX: lineX_T1, startY: -19836.27,
        endX: lineX_T1, endY: 32113.73
      });
      if (r1.success && r1.data?.DimensionId) createdDims.push(r1.data.DimensionId);

      // Tier 2 (柱間距)
      const r2 = await client.sendCommand('create_dimension', {
        viewId: fv.id,
        gridIds: [...horizIds].reverse(),
        startX: lineX_T2, startY: -19836.27,
        endX: lineX_T2, endY: 32113.73
      });
      if (r2.success && r2.data?.DimensionId) createdDims.push(r2.data.DimensionId);
      console.log(`  ✓ 右側東側柱心雙層標註完成 (${horizNames.join('-')})`);
    }

    // 若有有效型式，套用之
    if (activeTypeId) {
      for (const dId of createdDims) {
        try {
          await client.sendCommand('change_element_type', {
            elementId: dId,
            typeId: activeTypeId
          });
        } catch (e) {
          // ignore if cannot change
        }
      }
    }

    console.log(`  ✨ ${fv.name} 標註完成！共建立 ${createdDims.length} 條雙層連續標註`);
  }

  console.log(`\n============================================================`);
  console.log(`「樓板平面圖」所有視圖柱間距標註已全數完成！`);

  await client.disconnect();
}

main().catch(console.error);
