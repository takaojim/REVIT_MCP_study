import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'floor-plan-scheme-b-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備執行【方案B：5MM 三等距階梯標準】四向動態對稱柱心標註 ===\n');

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

  console.log(`[標註型式確認] 北側/東側(上右): ${typeIdUpRight}, 南側/西側(下右): ${typeIdDownRight}\n`);

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

  // 4. 動態取得視圖中所有軸線圖元
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const allGrids = gridsRes.data?.Elements || [];

  if (allGrids.length < 2) {
    console.error('❌ 視圖中的軸線數量不足！');
    process.exit(1);
  }

  // 分辨垂直 (X) 與 水平 (Y) 軸線並動態取得精確幾何座標
  const vertGrids = [];
  const horizGrids = [];

  for (const g of allGrids) {
    const isNamedNumber = /^\d+$/.test(g.Name);
    if (isNamedNumber) {
      const res = await client.sendCommand('calculate_grid_bounds', { xGrids: [g.Name], offset_mm: 0 });
      if (res.success && res.data) {
        vertGrids.push({
          id: g.ElementId,
          name: g.Name,
          coord: res.data.min.x // X 座標 (mm)
        });
      }
    } else {
      const res = await client.sendCommand('calculate_grid_bounds', { yGrids: [g.Name], offset_mm: 0 });
      if (res.success && res.data) {
        horizGrids.push({
          id: g.ElementId,
          name: g.Name,
          coord: res.data.min.y // Y 座標 (mm)
        });
      }
    }
  }

  // 幾何排序：
  // 垂直軸線由左至右 (X 座標由小到大: 1 -> 2 -> 3 -> 4)
  vertGrids.sort((a, b) => a.coord - b.coord);
  // 水平軸線由上至下 (Y 座標由大到小: A -> B -> C -> D)
  horizGrids.sort((a, b) => b.coord - a.coord);

  console.log(`📐 動態讀取與幾何排序完成:`);
  console.log(`   - 垂直軸線 (${vertGrids.length} 條): ` + vertGrids.map(g => `${g.name}(${g.coord.toFixed(1)}mm)`).join(', '));
  console.log(`   - 水平軸線 (${horizGrids.length} 條): ` + horizGrids.map(g => `${g.name}(${g.coord.toFixed(1)}mm)`).join(', '));

  const minGridX = vertGrids[0].coord;
  const maxGridX = vertGrids[vertGrids.length - 1].coord;
  const minGridY = horizGrids[horizGrids.length - 1].coord;
  const maxGridY = horizGrids[0].coord;

  console.log(`\n🏢 全區柱心幾何包絡極值:`);
  console.log(`   - X 向跨度: [${minGridX.toFixed(1)} ~ ${maxGridX.toFixed(1)}] mm (總寬 ${(maxGridX - minGridX).toFixed(1)} mm)`);
  console.log(`   - Y 向跨度: [${minGridY.toFixed(1)} ~ ${maxGridY.toFixed(1)}] mm (總深 ${(maxGridY - minGridY).toFixed(1)} mm)\n`);

  // 5. 方案 B：5MM 三等距階梯標準與四向對稱氣泡基準計算
  // 軸號氣泡圓圈向外統一延伸 30.0 mm (圖紙) -> 模型 3000 mm (1:100)
  const bubbleExtension = 30.0 * scale; 
  // Tier 1（外層總長）：距氣泡圓圈向建物退縮 5.0 mm (圖紙) -> 模型 500 mm
  const tier1Offset = 5.0 * scale;
  // Tier 2（內層柱間距）：距 Tier 1 再向建物退縮 5.0 mm (圖紙) -> 模型 500 mm (距氣泡共 10.0 mm = 1000 mm)
  const tier2Offset = 10.0 * scale;

  // 四向對稱氣泡中心基準線 (Bubble Datum Lines)
  const bubbleTopY = maxGridY + bubbleExtension;
  const bubbleBotY = minGridY - bubbleExtension;
  const bubbleLeftX = minGridX - bubbleExtension;
  const bubbleRightX = maxGridX + bubbleExtension;

  console.log(`📏 方案 B 階梯定位參數 (出圖比例 1:${scale}):`);
  console.log(`   - 氣泡圓圈對稱基準: 北=${bubbleTopY.toFixed(1)}, 南=${bubbleBotY.toFixed(1)}, 西=${bubbleLeftX.toFixed(1)}, 東=${bubbleRightX.toFixed(1)} mm`);
  console.log(`   - Tier 1 外層線退縮: ${tier1Offset.toFixed(1)} mm (距圓圈 5mm)`);
  console.log(`   - Tier 2 內層線退縮: ${tier2Offset.toFixed(1)} mm (距 Tier 1 5mm，等距階梯)\n`);

  const createdDims = [];
  const vertIds = vertGrids.map(g => g.id);
  const horizIds = horizGrids.map(g => g.id);

  // --- 1. 北側 (上方: 垂直軸線，由右至左繪製，輔助線 ⬇️ 朝下指向建物) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = bubbleTopY - tier1Offset;
    const lineY_T2 = bubbleTopY - tier2Offset;

    // Tier 1 (全區總跨度: 由右至左 4 -> 1)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[vertIds.length - 1], vertIds[0]],
      startX: maxGridX, startY: lineY_T1,
      endX: minGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '北側外層總尺寸' });
    }

    // Tier 2 (柱心連續分段: 由右至左 4 -> 3 -> 2 -> 1)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...vertIds].reverse(),
      startX: maxGridX, startY: lineY_T2,
      endX: minGridX, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '北側內層柱間距' });
    }
    console.log(`  ✓ 北側頂部柱心雙層標註建立完成 (Y_T1=${lineY_T1.toFixed(1)}, Y_T2=${lineY_T2.toFixed(1)})`);
  }

  // --- 2. 南側 (下方: 垂直軸線，由左至右繪製，輔助線 ⬆️ 朝上指向建物) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = bubbleBotY + tier1Offset;
    const lineY_T2 = bubbleBotY + tier2Offset;

    // Tier 1 (全區總跨度: 由左至右 1 -> 4)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[0], vertIds[vertIds.length - 1]],
      startX: minGridX, startY: lineY_T1,
      endX: maxGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '南側外層總尺寸' });
    }

    // Tier 2 (柱心連續分段: 由左至右 1 -> 2 -> 3 -> 4)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: vertIds,
      startX: minGridX, startY: lineY_T2,
      endX: maxGridX, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '南側內層柱間距' });
    }
    console.log(`  ✓ 南側底部柱心雙層標註建立完成 (Y_T1=${lineY_T1.toFixed(1)}, Y_T2=${lineY_T2.toFixed(1)})`);
  }

  // --- 3. 西側 (左側: 水平軸線，由頂至底繪製，輔助線 ➡️ 朝右指向建物) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = bubbleLeftX + tier1Offset;
    const lineX_T2 = bubbleLeftX + tier2Offset;

    // Tier 1 (全區總跨度: 由頂至底 A -> D)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[0], horizIds[horizIds.length - 1]],
      startX: lineX_T1, startY: maxGridY,
      endX: lineX_T1, endY: minGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '西側外層總尺寸' });
    }

    // Tier 2 (柱心連續分段: 由頂至底 A -> B -> C -> D)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: horizIds,
      startX: lineX_T2, startY: maxGridY,
      endX: lineX_T2, endY: minGridY
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '西側內層柱間距' });
    }
    console.log(`  ✓ 西側左側柱心雙層標註建立完成 (X_T1=${lineX_T1.toFixed(1)}, X_T2=${lineX_T2.toFixed(1)})`);
  }

  // --- 4. 東側 (右側: 水平軸線，由底至頂繪製，輔助線 ⬅️ 朝左指向建物) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = bubbleRightX - tier1Offset;
    const lineX_T2 = bubbleRightX - tier2Offset;

    // Tier 1 (全區總跨度: 由底至頂 D -> A)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[horizIds.length - 1], horizIds[0]],
      startX: lineX_T1, startY: minGridY,
      endX: lineX_T1, endY: maxGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '東側外層總尺寸' });
    }

    // Tier 2 (柱心連續分段: 由底至頂 D -> C -> B -> A)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...horizIds].reverse(),
      startX: lineX_T2, startY: minGridY,
      endX: lineX_T2, endY: maxGridY
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '東側內層柱間距' });
    }
    console.log(`  ✓ 東側右側柱心雙層標註建立完成 (X_T1=${lineX_T1.toFixed(1)}, X_T2=${lineX_T2.toFixed(1)})`);
  }

  // 6. 套用專屬柱心標註型式 (上右 / 下右)
  console.log(`\n🏷️ 正在為 ${createdDims.length} 道標註套用專屬型式...`);
  for (const d of createdDims) {
    if (d.typeId) {
      try {
        await client.sendCommand('change_element_type', {
          elementId: d.id,
          typeId: d.typeId
        });
      } catch (e) {
        console.warn(`  - 變更型式提示 [${d.name}]:`, e.message);
      }
    }
  }

  console.log(`\n✨ 視圖【${activeView.Name}】四向動態對稱柱心標註已全數完成！共建立 ${createdDims.length} 條雙層連續標註。`);

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
