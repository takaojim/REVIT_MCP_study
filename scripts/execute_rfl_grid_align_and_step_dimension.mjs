import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'rfl-standard-align-and-dim-runner';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【階段 1 + 階段 2】RFL 軸線 5,200mm 齊頭整列與 65cm 標準標註 ===');
  console.log('================================================================\n');

  // 1. 取得當前視圖 (RFL: 624304)
  const viewRes = await client.sendCommand('get_active_view', {});
  const activeView = viewRes.data;
  const viewId = activeView?.ElementId || 624304;
  const scale = activeView?.Scale || 100;

  console.log(`📌 當前作用中平面視圖:`);
  console.log(`   - 視圖名稱: "${activeView?.Name}"`);
  console.log(`   - 視圖 ID  : ${viewId}`);
  console.log(`   - 比例     : 1:${scale}\n`);

  // 2. 清理 RFL 中的既有舊標註
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

  // 3. 【階段 1】執行軸線四向齊頭整列 (5,200 mm 延伸 = 8 個 650mm 模矩)
  const offsetMm = 5200.0;
  console.log(`📐 正在執行【階段 1：軸線四向齊頭整列】（外緣延伸 ${offsetMm} mm）...`);
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    offsetMm: offsetMm,
    showAllBubbles: true
  });

  if (!alignRes.success) {
    console.error('❌ 軸線齊頭整列失敗:', alignRes.error);
    process.exit(1);
  }

  const bounds = alignRes.data.AlignmentBounds;
  console.log(`  ✓ 齊頭整列完成！四向氣泡基準線：`);
  console.log(`    - 北側(上): Y = ${bounds.TopY.toFixed(1)} mm`);
  console.log(`    - 南側(下): Y = ${bounds.BottomY.toFixed(1)} mm`);
  console.log(`    - 西側(左): X = ${bounds.LeftX.toFixed(1)} mm`);
  console.log(`    - 東側(右): X = ${bounds.RightX.toFixed(1)} mm\n`);

  // 4. 動態取得 2FL/RFL 垂直與水平軸線圖元 ID
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
          coord: res.data.min.x
        });
      }
    } else {
      const res = await client.sendCommand('calculate_grid_bounds', { yGrids: [g.Name], offset_mm: 0 });
      if (res.success && res.data) {
        horizGrids.push({
          id: g.ElementId,
          name: g.Name,
          coord: res.data.min.y
        });
      }
    }
  }

  vertGrids.sort((a, b) => a.coord - b.coord);
  horizGrids.sort((a, b) => b.coord - a.coord);

  const minGridX = vertGrids[0].coord;
  const maxGridX = vertGrids[vertGrids.length - 1].coord;
  const minGridY = horizGrids[horizGrids.length - 1].coord;
  const maxGridY = horizGrids[0].coord;

  // 5. 取得標註型式
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

  // 6. 【階段 2】生成四向標準階梯柱心雙層連續標註 (每階精確 650 mm)
  const step65 = 650.0;
  const createdDims = [];
  const vertIds = vertGrids.map(g => g.id);
  const horizIds = horizGrids.map(g => g.id);

  console.log(`📏 正在執行【階段 2：標準階梯標註】（氣泡 -> 65cm -> 第1層 -> 65cm -> 第2層）...`);

  // --- 北側 (上方) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = bounds.TopY - step65;
    const lineY_T2 = bounds.TopY - (step65 * 2);

    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[vertIds.length - 1], vertIds[0]],
      startX: maxGridX, startY: lineY_T1,
      endX: minGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '北側外層總尺寸' });
    }

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

  // --- 南側 (下方) ---
  if (vertGrids.length >= 2) {
    const lineY_T1 = bounds.BottomY + step65;
    const lineY_T2 = bounds.BottomY + (step65 * 2);

    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [vertIds[0], vertIds[vertIds.length - 1]],
      startX: minGridX, startY: lineY_T1,
      endX: maxGridX, endY: lineY_T1
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '南側外層總尺寸' });
    }

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

  // --- 西側 (左側) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = bounds.LeftX + step65;
    const lineX_T2 = bounds.LeftX + (step65 * 2);

    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[0], horizIds[horizIds.length - 1]],
      startX: lineX_T1, startY: maxGridY,
      endX: lineX_T1, endY: minGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdDownRight, name: '西側外層總尺寸' });
    }

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

  // --- 東側 (右側) ---
  if (horizGrids.length >= 2) {
    const lineX_T1 = bounds.RightX - step65;
    const lineX_T2 = bounds.RightX - (step65 * 2);

    const r1 = await client.sendCommand('create_dimension', {
      viewId: viewId,
      gridIds: [horizIds[horizIds.length - 1], horizIds[0]],
      startX: lineX_T1, startY: minGridY,
      endX: lineX_T1, endY: maxGridY
    });
    if (r1.success && r1.data?.DimensionId) {
      createdDims.push({ id: r1.data.DimensionId, typeId: typeIdUpRight, name: '東側外層總尺寸' });
    }

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

  // 7. 套用專屬柱心標註型式
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

  console.log(`\n✨ 視圖【${activeView.Name}】齊頭整列與標準柱心標註已全數完成！共建立 ${createdDims.length} 條雙層連續標註。`);

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
