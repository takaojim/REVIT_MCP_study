import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'active-plan-dimension-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功 ===\n');

  // 1. 取得標註型式
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];

  let typeIdUpRight = null;
  let typeIdDownRight = null;

  for (const dt of dimTypes) {
    if (dt.DimensionTypeName.includes('柱心-上右') || dt.DimensionTypeName.includes('上右')) typeIdUpRight = dt.DimensionTypeId;
    if (dt.DimensionTypeName.includes('柱心-下右') || dt.DimensionTypeName.includes('下右')) typeIdDownRight = dt.DimensionTypeId;
  }
  if (!typeIdUpRight) {
    const tabc = dimTypes.find(dt => dt.DimensionTypeName.includes('TABC-DIM_*/ S') || dt.DimensionTypeName.includes('TABC-DIM') || dt.DimensionTypeName === 'DIMing');
    typeIdUpRight = tabc ? tabc.DimensionTypeId : null;
    typeIdDownRight = tabc ? tabc.DimensionTypeId : null;
  }

  console.log(`[標註型式配置] 北/東(上右): ${typeIdUpRight}, 南/西(下右): ${typeIdDownRight}\n`);

  // 2. 取得當前作用中視圖 (Active View)
  const viewRes = await client.sendCommand('get_active_view', {});
  if (!viewRes.success || !viewRes.data?.ElementId) {
    console.error('❌ 無法取得當前作用中視圖：', viewRes.error || '未知錯誤');
    process.exit(1);
  }

  const activeView = viewRes.data;
  const viewId = activeView.ElementId;
  const scale = activeView.Scale || 100;

  console.log(`📌 當前作用中平面視圖:`);
  console.log(`   - 視圖名稱: "${activeView.Name}"`);
  console.log(`   - 視圖 ID  : ${viewId}`);
  console.log(`   - 視圖類型: ${activeView.ViewType}`);
  console.log(`   - 比例     : 1:${scale}\n`);

  // 3. 清理當前視圖中的既有舊標註
  const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  if (dimQuery.data?.Elements?.length > 0) {
    let delCount = 0;
    for (const d of dimQuery.data.Elements) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
        delCount++;
      } catch (e) {}
    }
    console.log(`🧹 已清理既有 ${delCount} 道舊尺寸標註。\n`);
  }

  // 4. 取得視圖中可見的 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const grids = gridsRes.data?.Elements || [];
  const gridMap = new Map();
  for (const g of grids) {
    gridMap.set(g.Name, g.ElementId);
  }
  console.log(`📐 視圖可用軸線: ${Array.from(gridMap.keys()).join(', ')}`);

  // 垂直軸線 (1, 2, 3, 4)
  const vertNames = ['1', '2', '3', '4'].filter(n => gridMap.has(n));
  const vertIds = vertNames.map(n => gridMap.get(n));

  // 水平軸線 (A, B, C, D)
  const horizNames = ['A', 'B', 'C', 'D'].filter(n => gridMap.has(n));
  const horizIds = horizNames.map(n => gridMap.get(n));

  const offset1 = 5.0 * scale;   // 5mm 圖紙 -> 模型 500mm
  const offset2 = 11.5 * scale;  // 11.5mm 圖紙 -> 模型 1150mm

  // 當前專案真實軸號極值基準 (mm)
  const topBubbleY = 4500;
  const botBubbleY = -18000;
  const leftBubbleX = -2000;
  const rightBubbleX = 18500;

  const createdDims = [];

  // --- 1. 北側 (頂部: 垂直軸線 1-4，由右至左繪製，使 5mm 輔助線朝下指向建物) ---
  if (vertIds.length >= 2) {
    const lineY_T1 = topBubbleY - offset1;
    const lineY_T2 = topBubbleY - offset2;

    // Tier 1 (總跨度 1-4)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[vertIds.length - 1], vertIds[0]],
      startX: 16000, startY: lineY_T1,
      endX: 0, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '北側總尺寸' });
    }

    // Tier 2 (柱間距 4-3-2-1)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...vertIds].reverse(),
      startX: 16000, startY: lineY_T2,
      endX: 0, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '北側柱間距' });
    }
    console.log(`  ✓ 北側頂部柱心雙層標註完成 (${vertNames.join('-')})`);
  }

  // --- 2. 南側 (底部: 垂直軸線 1-4，由左至右繪製，使 5mm 輔助線朝上指向建物) ---
  if (vertIds.length >= 2) {
    const lineY_T1 = botBubbleY + offset1;
    const lineY_T2 = botBubbleY + offset2;

    // Tier 1 (總跨度 1-4)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[0], vertIds[vertIds.length - 1]],
      startX: 0, startY: lineY_T1,
      endX: 16000, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '南側總尺寸' });
    }

    // Tier 2 (柱間距 1-2-3-4)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: vertIds,
      startX: 0, startY: lineY_T2,
      endX: 16000, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '南側柱間距' });
    }
    console.log(`  ✓ 南側底部柱心雙層標註完成 (${vertNames.join('-')})`);
  }

  // --- 3. 西側 (左側: 水平軸線 A-D，由頂至底繪製，使 5mm 輔助線朝右指向建物) ---
  if (horizIds.length >= 2) {
    const lineX_T1 = leftBubbleX + offset1;
    const lineX_T2 = leftBubbleX + offset2;

    // Tier 1 (總跨度 A-D)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[0], horizIds[horizIds.length - 1]],
      startX: lineX_T1, startY: 3000,
      endX: lineX_T1, endY: -16000
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '西側總尺寸' });
    }

    // Tier 2 (柱間距 A-B-C-D)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: horizIds,
      startX: lineX_T2, startY: 3000,
      endX: lineX_T2, endY: -16000
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '西側柱間距' });
    }
    console.log(`  ✓ 西側左側柱心雙層標註完成 (${horizNames.join('-')})`);
  }

  // --- 4. 東側 (右側: 水平軸線 A-D，由底至頂繪製，使 5mm 輔助線朝左指向建物) ---
  if (horizIds.length >= 2) {
    const lineX_T1 = rightBubbleX - offset1;
    const lineX_T2 = rightBubbleX - offset2;

    // Tier 1 (總跨度 D-A)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[horizIds.length - 1], horizIds[0]],
      startX: lineX_T1, startY: -16000,
      endX: lineX_T1, endY: 3000
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '東側總尺寸' });
    }

    // Tier 2 (柱間距 D-C-B-A)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...horizIds].reverse(),
      startX: lineX_T2, startY: -16000,
      endX: lineX_T2, endY: 3000
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '東側柱間距' });
    }
    console.log(`  ✓ 東側右側柱心雙層標註完成 (${horizNames.join('-')})`);
  }

  // 5. 套用專屬標註型式
  for (const d of createdDims) {
    if (d.typeId) {
      try {
        await client.sendCommand('change_element_type', {
          elementId: d.id,
          typeId: d.typeId
        });
      } catch (e) {
        // ignore
      }
    }
  }

  console.log(`\n✨ 視圖【${activeView.Name}】標註完成！共建立 ${createdDims.length} 條雙層連續標註。`);

  await client.disconnect();
  console.log('\n========================================');
  console.log('🏁 作業執行完畢！');
  console.log('========================================');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
