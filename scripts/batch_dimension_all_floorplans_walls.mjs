import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-dimension-all-floorplans-walls-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【樓板平面圖 所有視圖】牆心尺寸標註批次自動建立 ===');
  console.log('================================================================\n');

  // 1. 確認並取得標註型式: TABC-DIM_dot 牆心
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];

  const wallType = dimTypes.find(t => t.DimensionTypeName === 'TABC-DIM_dot 牆心') ||
                   dimTypes.find(t => t.DimensionTypeName?.includes('牆心')) ||
                   dimTypes.find(t => t.DimensionTypeName?.includes('dot'));
  const typeIdWall = wallType ? wallType.DimensionTypeId : 708965;
  console.log(`📌 牆心標註型式: "${wallType?.DimensionTypeName}" (ID: ${typeIdWall})\n`);

  // 2. 目標樓板平面圖視圖清單 (包含 GL, 1FL, 2FL, 3FL, 4FL, RFL, TRFL)
  const targetFloorPlans = [
    { name: 'GL', id: 390778 },
    { name: '1FL', id: 312 },
    { name: '2FL', id: 695 },
    { name: '3FL', id: 428158 },
    { name: '4FL', id: 624294 },
    { name: 'RFL', id: 624304 },
    { name: 'TRFL', id: 624314 }
  ];

  const results = [];

  for (const fp of targetFloorPlans) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 開始處理視圖: 【${fp.name}】 (ID: ${fp.id})`);

    // A. 設定作用中視圖
    try {
      await client.sendCommand('set_active_view', { viewId: fp.id });
    } catch (e) {
      console.log(`  切換視圖提示: ${e.message}`);
    }

    // B. 清理視圖中雜亂的舊牆心標註 (保留柱心標註)
    const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fp.id, maxCount: 500 });
    let deletedCount = 0;
    for (const d of existingDims.data?.Elements || []) {
      const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
      const typeName = dInfo.data?.Type || '';
      // 清除 DIMing 或 舊牆心標註，保留柱心標註
      if (typeName === 'DIMing' || typeName.includes('牆心') || (typeName.includes('dot') && !typeName.includes('柱心'))) {
        try {
          await client.sendCommand('delete_element', { elementId: d.ElementId });
          deletedCount++;
        } catch (e) {}
      }
    }
    if (deletedCount > 0) {
      console.log(`  🧹 已清理 ${deletedCount} 個舊有/臨時牆心標註 (已完整保留柱心標註)`);
    }

    // C. 建立外牆全跨邊界標註 (overall_bbox)
    let bboxCount = 0;
    const newDimIds = [];
    try {
      const resBbox = await client.sendCommand('auto_dimension_walls', {
        viewId: fp.id,
        mode: 'overall_bbox',
        offsetMm: 2200
      });
      if (resBbox.success && resBbox.data?.Dimensions) {
        for (const item of resBbox.data.Dimensions) {
          if (item.DimensionId) {
            newDimIds.push(item.DimensionId);
            bboxCount++;
          }
        }
        console.log(`  ✓ 外牆總尺寸 (overall_bbox) 建立完成: ${bboxCount} 條`);
      }
    } catch (e) {
      console.log(`  ⚠️ overall_bbox 標註略過: ${e.message}`);
    }

    // D. 建立連續牆心分段標註 (chained)
    let chainedCount = 0;
    try {
      const resChained = await client.sendCommand('auto_dimension_walls', {
        viewId: fp.id,
        mode: 'chained',
        offsetMm: 1300
      });
      if (resChained.success && resChained.data?.Dimensions) {
        for (const item of resChained.data.Dimensions) {
          if (item.DimensionId) {
            newDimIds.push(item.DimensionId);
            chainedCount++;
          }
        }
        console.log(`  ✓ 牆心連續分段尺寸 (chained) 建立完成: ${chainedCount} 條`);
      }
    } catch (e) {
      console.log(`  ⚠️ chained 標註略過: ${e.message}`);
    }

    // E. 批次將新建立的標註型式統一為 TABC-DIM_dot 牆心
    let typeUpdatedCount = 0;
    for (const dimId of newDimIds) {
      try {
        const changeRes = await client.sendCommand('change_element_type', {
          elementId: dimId,
          typeId: typeIdWall
        });
        if (changeRes.success) typeUpdatedCount++;
      } catch (e) {}
    }

    console.log(`  🎨 標註型式設定: ${typeUpdatedCount}/${newDimIds.length} 個標註已套用 "${wallType?.DimensionTypeName}"`);

    results.push({
      view: fp.name,
      id: fp.id,
      overallDims: bboxCount,
      chainedDims: chainedCount,
      totalNewDims: newDimIds.length,
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【樓板平面圖 所有視圖】牆心尺寸標註批次建立全數完成！ ===');
  console.log('================================================================\n');
  console.table(results);

  process.exit(0);
}

main().catch(err => {
  console.error('執行致命錯誤:', err);
  process.exit(1);
});
