import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = '2fl-scheme-a-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備為 2FL 執行【方案甲】柱心雙層標註 ===\n');

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

  console.log(`[標註型式] 北/東(上右): ${typeIdUpRight}, 南/西(下右): ${typeIdDownRight}\n`);

  // 2. 切換並取得 2FL 視圖 (View ID: 695)
  const viewId = 695;
  await client.sendCommand('set_active_view', { viewId: viewId });
  const viewRes = await client.sendCommand('get_active_view', {});
  const activeView = viewRes.data;
  const scale = activeView?.Scale || 100;

  console.log(`📌 作用中平面視圖:`);
  console.log(`   - 視圖名稱: "${activeView?.Name}"`);
  console.log(`   - 視圖 ID  : ${viewId}`);
  console.log(`   - 比例     : 1:${scale}\n`);

  // 3. 清理 2FL 中的既有舊標註
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

  // 4. 動態取得 2FL 軸線圖元與幾何座標
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const allGrids = gridsRes.data?.Elements || [];

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

  vertGrids.sort((a, b) => a.coord - b.coord);
  horizGrids.sort((a, b) => b.coord - a.coord);

  const minGridX = vertGrids[0].coord; // 1201.8 mm
  const maxGridX = vertGrids[vertGrids.length - 1].coord; // 15601.8 mm
  const minGridY = horizGrids[horizGrids.length - 1].coord; // -14635.4 mm
  const maxGridY = horizGrids[0].coord; // 1264.6 mm

  console.log(`📐 2FL 軸線幾何中心範圍:`);
  console.log(`   - 垂直軸線: ` + vertGrids.map(g => `${g.name}(${g.coord.toFixed(1)}mm)`).join(', '));
  console.log(`   - 水平軸線: ` + horizGrids.map(g => `${g.name}(${g.coord.toFixed(1)}mm)`).join(', '));

  // 5. 【方案甲】實體氣泡端點基準與 65cm 等距定位 (單位: mm)
  // 間距規則：氣泡圓圈 -> 650 mm -> Tier 1 (外層總長) -> 650 mm -> Tier 2 (內層柱間距)
  const step65 = 650.0; // 65 cm = 650 mm

  // Revit 專案中真實軸號氣泡圓圈端點位置 (mm):
  const realBubbleLeftX = -2547.2;   // 西側 (左) 氣泡圓圈中心
  const realBubbleRightX = 20190.8;  // 東側 (右) 氣泡圓圈中心
  const realBubbleTopY = 5013.6;     // 北側 (上) 氣泡圓圈中心
  const realBubbleBotY = -18384.4;   // 南側 (下) 氣泡圓圈中心

  console.log(`\n📏 方案甲定位基準與 65cm 間距階梯:`);
  console.log(`   - 西側(左): 氣泡=${realBubbleLeftX.toFixed(1)} -> Tier 1=${(realBubbleLeftX + step65).toFixed(1)} -> Tier 2=${(realBubbleLeftX + step65 * 2).toFixed(1)} mm`);
  console.log(`   - 東側(右): 氣泡=${realBubbleRightX.toFixed(1)} -> Tier 1=${(realBubbleRightX - step65).toFixed(1)} -> Tier 2=${(realBubbleRightX - step65 * 2).toFixed(1)} mm`);
  console.log(`   - 北側(上): 氣泡=${realBubbleTopY.toFixed(1)} -> Tier 1=${(realBubbleTopY - step65).toFixed(1)} -> Tier 2=${(realBubbleTopY - step65 * 2).toFixed(1)} mm`);
  console.log(`   - 南側(下): 氣泡=${realBubbleBotY.toFixed(1)} -> Tier 1=${(realBubbleBotY + step65).toFixed(1)} -> Tier 2=${(realBubbleBotY + step65 * 2).toFixed(1)} mm\n`);

  const createdDims = [];
  const vertIds = vertGrids.map(g => g.id);
  const horizIds = horizGrids.map(g => g.id);

  // --- 1. 北側 (上方: 垂直軸線 4-1，由右至左繪製，輔助線 ⬇️ 朝下指向建物) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = realBubbleTopY - step65;
    const lineY_T2 = realBubbleTopY - (step65 * 2);

    // Tier 1 (全區總跨度: 由右至左 4 -> 1)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[vertIds.length - 1], vertIds[0]],
      startX: maxGridX, startY: lineY_T1,
      endX: minGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '北側外層總尺寸 (距泡泡65cm)' });
    }

    // Tier 2 (柱心連續分段: 由右至左 4 -> 3 -> 2 -> 1)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...vertIds].reverse(),
      startX: maxGridX, startY: lineY_T2,
      endX: minGridX, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '北側內層柱間距 (距第1層65cm)' });
    }
    console.log(`  ✓ 北側頂部柱心雙層標註建立完成 (Y_T1=${lineY_T1.toFixed(1)}, Y_T2=${lineY_T2.toFixed(1)})`);
  }

  // --- 2. 南側 (下方: 垂直軸線 1-4，由左至右繪製，輔助線 ⬆️ 朝上指向建物) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = realBubbleBotY + step65;
    const lineY_T2 = realBubbleBotY + (step65 * 2);

    // Tier 1 (全區總跨度: 由左至右 1 -> 4)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[0], vertIds[vertIds.length - 1]],
      startX: minGridX, startY: lineY_T1,
      endX: maxGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '南側外層總尺寸 (距泡泡65cm)' });
    }

    // Tier 2 (柱心連續分段: 由左至右 1 -> 2 -> 3 -> 4)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: vertIds,
      startX: minGridX, startY: lineY_T2,
      endX: maxGridX, endY: lineY_T2
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '南側內層柱間距 (距第1層65cm)' });
    }
    console.log(`  ✓ 南側底部柱心雙層標註建立完成 (Y_T1=${lineY_T1.toFixed(1)}, Y_T2=${lineY_T2.toFixed(1)})`);
  }

  // --- 3. 西側 (左側: 水平軸線 A-D，由頂至底繪製，輔助線 ➡️ 朝右指向建物) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = realBubbleLeftX + step65;
    const lineX_T2 = realBubbleLeftX + (step65 * 2);

    // Tier 1 (全區總跨度: 由頂至底 A -> D)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[0], horizIds[horizIds.length - 1]],
      startX: lineX_T1, startY: maxGridY,
      endX: lineX_T1, endY: minGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '西側外層總尺寸 (距泡泡65cm)' });
    }

    // Tier 2 (柱心連續分段: 由頂至底 A -> B -> C -> D)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: horizIds,
      startX: lineX_T2, startY: maxGridY,
      endX: lineX_T2, endY: minGridY
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdDownRight, name: '西側內層柱間距 (距第1層65cm)' });
    }
    console.log(`  ✓ 西側左側柱心雙層標註建立完成 (X_T1=${lineX_T1.toFixed(1)}, X_T2=${lineX_T2.toFixed(1)})`);
  }

  // --- 4. 東側 (右側: 水平軸線 D-A，由底至頂繪製，輔助線 ⬅️ 朝左指向建物) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = realBubbleRightX - step65;
    const lineX_T2 = realBubbleRightX - (step65 * 2);

    // Tier 1 (全區總跨度: 由底至頂 D -> A)
    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[horizIds.length - 1], horizIds[0]],
      startX: lineX_T1, startY: minGridY,
      endX: lineX_T1, endY: maxGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '東側外層總尺寸 (距泡泡65cm)' });
    }

    // Tier 2 (柱心連續分段: 由底至頂 D -> C -> B -> A)
    const r2 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [...horizIds].reverse(),
      startX: lineX_T2, startY: minGridY,
      endX: lineX_T2, endY: maxGridY
    });
    if (r2.success && r2.data?.DimensionId) {
      createdDims.push({ id: r2.data.DimensionId, typeId: typeIdUpRight, name: '東側內層柱間距 (距第1層65cm)' });
    }
    console.log(`  ✓ 東側右側柱心雙層標註建立完成 (X_T1=${lineX_T1.toFixed(1)}, X_T2=${lineX_T2.toFixed(1)})`);
  }

  // 6. 套用專屬柱心標註型式 (上右 / 下右)
  console.log(`\n🏷️ 正在為 2FL 的 ${createdDims.length} 道標註套用專屬型式...`);
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

  console.log(`\n✨ 視圖【2FL】方案甲柱心雙層標註已全數完成！共建立 ${createdDims.length} 條雙層連續標註。`);

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
