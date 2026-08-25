import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'new-proj-struct-5steps-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【新專案】結構平面所有視圖 5 間距 柱心標註 ＋ 氣泡齊頭 ＋ 輔助線 ===');
  console.log('================================================================\n');

  // 1. 查詢新專案中所有視圖，過濾結構平面圖
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  const structViews = [];
  for (const v of allViews) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';
    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || info.data?.Name || '';
    const isTemplate = info.data?.IsTemplate || false;

    if (!name.startsWith('{') && !isTemplate) {
      const typeStr = (info.data?.Type || '').toString();
      // 排除圖例、明細表、立面圖
      if (typeStr.includes('圖例') || typeStr.includes('明細表') || typeStr.includes('立面') || typeStr.includes('剖面')) {
        continue;
      }
      if (typeStr.includes('平面') || info.data?.ViewType === 'FloorPlan' || info.data?.ViewType === 'StructuralPlan' || info.data?.ViewType === 'EngineeringPlan') {
        structViews.push({
          id: v.ElementId,
          name: name,
          viewType: info.data?.ViewType || viewType || typeStr,
          scale: info.data?.Scale || 100
        });
      }
    }
  }

  // 備用搜尋
  if (structViews.length === 0) {
    for (const v of allViews) {
      const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
      const name = v.Name || info.data?.Name || '';
      if (!name.startsWith('{') && (info.data?.ViewType === 'FloorPlan' || info.data?.ViewType === 'EngineeringPlan')) {
        structViews.push({ id: v.ElementId, name: name, viewType: info.data?.ViewType });
      }
    }
  }

  console.log(`✓ 找到 ${structViews.length} 個結構平面視圖:`);
  for (const sv of structViews) {
    console.log(`  - 視圖: "${sv.name}" (ID: ${sv.id}, Type: ${sv.viewType})`);
  }

  // 2. 標註型式解析
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];
  let targetDimType = dimTypeList.find(t => t.DimensionTypeName?.includes('柱心-上右')) ||
                      dimTypeList.find(t => t.DimensionTypeName?.includes('柱心')) ||
                      dimTypeList.find(t => t.DimensionTypeName?.includes('TABC')) ||
                      dimTypeList[0];
  const typeIdUpRight = targetDimType?.DimensionTypeId;
  console.log(`✓ 套用柱心標註型式: "${targetDimType?.DimensionTypeName}" (ID: ${typeIdUpRight})`);

  // 3. 軸線配置 (新專案 8 條軸線: 1~4 與 A~D)
  // 北側垂直軸線 (由右至左: 4 -> 3 -> 2 -> 1)
  const northContinuousGrids = [596080, 432630, 432966, 192066];
  const northTotalGrids = [596080, 192066];

  // 東側水平軸線 (由下至上: D -> C -> B -> A)
  const eastContinuousGrids = [611573, 432924, 432845, 192192];
  const eastTotalGrids = [611573, 192192];

  const summary = [];

  for (const v of structViews) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始執行 5 間距齊頭與柱心標註...`);

    let alignRes;
    try {
      alignRes = await client.sendCommand('align_plan_grids', {
        viewId: v.id,
        stepCount: 5.0,
        stepMm: 650.0,
        usePhysicalEnvelope: true,
        showAllBubbles: false
      });
    } catch (err) {
      console.log(`  ⚠️ 略過視圖 (可能為樣板或非實體平面): ${err.message}`);
      summary.push({ name: v.name, id: v.id, status: 'SKIPPED_TEMPLATE' });
      continue;
    }

    if (!alignRes || !alignRes.success) {
      console.log(`  ⚠️ 齊頭整列略過: ${alignRes?.error}`);
      summary.push({ name: v.name, id: v.id, status: 'SKIPPED' });
      continue;
    }

    const data = alignRes.data;
    const env = data.PhysicalEnvelopeMm;
    const bounds = data.AlignmentBoundsMm;

    console.log(`  ✓ 齊平整列完成！共調整 ${data.AlignedGridsCount} 條軸線`);
    console.log(`    - 實體外框 (紅線): X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}]`);
    console.log(`    - 5間距齊平 (藍線): Top=${bounds.TopY.toFixed(1)}, Right=${bounds.RightX.toFixed(1)} mm`);

    // (B) 清理舊尺寸標註
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }

    // (C) 繪製 4 條外牆紅線 (Step 0) 與 4 條 5間距藍線 (Step 5)
    const linesToDraw = [
      // 紅線 (Step 0)
      { startX: env.MinX, startY: env.MaxY, endX: env.MaxX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: env.MaxX, startY: env.MaxY, endX: env.MaxX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: env.MaxX, startY: env.MinY, endX: env.MinX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: env.MinX, startY: env.MinY, endX: env.MinX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },
      // 藍線 (Step 5)
      { startX: bounds.LeftX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-北` },
      { startX: bounds.RightX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-東` },
      { startX: bounds.RightX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-南` },
      { startX: bounds.LeftX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`  ✓ 🎨 成功繪製 8 條輔助線（4 紅 ＋ 4 藍）`);
    } catch (e) {}

    // (D) 建立北側 (上方) 與 東側 (右側) 雙層柱心標註
    // Tier 1 總跨: Step 4 (距氣泡 650mm)
    // Tier 2 連續: Step 3 (距氣泡 1300mm)
    const northTier1Y = bounds.TopY - 650.0;
    const northTier2Y = bounds.TopY - 1300.0;
    const eastTier1X = bounds.RightX - 650.0;
    const eastTier2X = bounds.RightX - 1300.0;

    const spanXMax = env.MaxX + 2000.0;
    const spanXMin = env.MinX - 2000.0;
    const spanYMax = env.MaxY + 2000.0;
    const spanYMin = env.MinY - 2000.0;

    // 北側總跨 (4, 1) 由右至左 (東向西)
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northTotalGrids,
      startX: spanXMax,
      startY: northTier1Y,
      endX: spanXMin,
      endY: northTier1Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nTotalRes.success && nTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nTotalRes.data.DimensionId, typeId: typeIdUpRight });
    }

    // 北側連續 (4 -> 3 -> 2 -> 1) 由右至左
    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northContinuousGrids,
      startX: spanXMax,
      startY: northTier2Y,
      endX: spanXMin,
      endY: northTier2Y,
      dimensionTypeId: typeIdUpRight
    });
    if (nContRes.success && nContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: nContRes.data.DimensionId, typeId: typeIdUpRight });
    }

    // 東側總跨 (D, A) 由下至上 (南向北)
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastTotalGrids,
      startX: eastTier1X,
      startY: spanYMin,
      endX: eastTier1X,
      endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eTotalRes.success && eTotalRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eTotalRes.data.DimensionId, typeId: typeIdUpRight });
    }

    // 東側連續 (D -> C -> B -> A) 由下至上
    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastContinuousGrids,
      startX: eastTier2X,
      startY: spanYMin,
      endX: eastTier2X,
      endY: spanYMax,
      dimensionTypeId: typeIdUpRight
    });
    if (eContRes.success && eContRes.data?.DimensionId) {
      await client.sendCommand('change_element_type', { elementId: eContRes.data.DimensionId, typeId: typeIdUpRight });
    }

    console.log(`  ✓ 柱間距標註完成:`);
    console.log(`    - 北側總跨 ID: ${nTotalRes.data?.DimensionId}, 連續 ID: ${nContRes.data?.DimensionId}`);
    console.log(`    - 東側總跨 ID: ${eTotalRes.data?.DimensionId}, 連續 ID: ${eContRes.data?.DimensionId}`);

    summary.push({
      name: v.name,
      id: v.id,
      northTotal: nTotalRes.data?.DimensionId,
      northCont: nContRes.data?.DimensionId,
      eastTotal: eTotalRes.data?.DimensionId,
      eastCont: eContRes.data?.DimensionId,
      status: 'SUCCESS'
    });
  }

  console.log('\n================================================================');
  console.log('=== 【新專案】所有結構平面視圖 5 間距柱心標註全數完成！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
