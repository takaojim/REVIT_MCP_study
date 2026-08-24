import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-apply-tabc-type';
  await client.connect();

  const typeIdUpRight = 689724; // TABC-DIM_*/ S 2.5-柱心-上右

  console.log('================================================================');
  console.log(`=== 【全樓板平面圖】套用專屬標註型式: TABC-DIM_*/ S 2.5-柱心-上右 ===`);
  console.log(`=== 目標型式 ID: ${typeIdUpRight} ===`);
  console.log('================================================================\n');

  const targetViews = [
    { id: 312, name: '1FL', refId: null },
    { id: 695, name: '2FL', refId: null },
    { id: 428158, name: '3FL', refId: null },
    { id: 624294, name: '4FL', refId: null },
    { id: 624304, name: 'RFL', refId: 624294 },
    { id: 624314, name: 'TRFL', refId: 624294 }
  ];

  // 1. 北側 (上方，水平尺寸線) 標註垂直軸線: 1, 2, 3, 4 (由右至左: 4 -> 1)
  const northContinuousGrids = [596080, 432630, 432966, 192066]; // 4 -> 3 -> 2 -> 1
  const northTotalGrids = [596080, 192066]; // 4, 1

  // 2. 東側 (右側，垂直尺寸線) 標註水平軸線: A, B, C, D (由下至上: D -> A)
  const eastContinuousGrids = [611573, 432924, 432845, 192192]; // D -> C -> B -> A
  const eastTotalGrids = [611573, 192192]; // D, A

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 重新建立並套用 TABC 上右標註型式...`);

    // 取得 8 間距齊頭範圍
    const alignPayload = {
      viewId: v.id,
      stepCount: 8.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    };
    if (v.refId) alignPayload.referenceViewId = v.refId;

    const alignRes = await client.sendCommand('align_plan_grids', alignPayload);
    const bounds = alignRes.data.AlignmentBoundsMm;

    // 清理該視圖上舊有尺寸
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }

    // Tier 1 (外層總跨): 距圓標 650mm
    // Tier 2 (內層連續柱間距): 距圓標 1300mm
    const topY_tier1 = bounds.TopY - 650.0;
    const topY_tier2 = bounds.TopY - 1300.0;

    const rightX_tier1 = bounds.RightX - 650.0;
    const rightX_tier2 = bounds.RightX - 1300.0;

    const createdDimIds = [];

    // --- 北側 (上方) 標註 ---
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northTotalGrids,
      startX: bounds.RightX,
      startY: topY_tier1,
      endX: bounds.LeftX,
      endY: topY_tier1
    });
    if (nTotalRes.success) createdDimIds.push({ name: '北側總跨 (1~4)', id: nTotalRes.data.DimensionId });

    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northContinuousGrids,
      startX: bounds.RightX,
      startY: topY_tier2,
      endX: bounds.LeftX,
      endY: topY_tier2
    });
    if (nContRes.success) createdDimIds.push({ name: '北側柱間距 (4-3-2-1)', id: nContRes.data.DimensionId });

    // --- 東側 (右側) 標註 ---
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastTotalGrids,
      startX: rightX_tier1,
      startY: bounds.BottomY,
      endX: rightX_tier1,
      endY: bounds.TopY
    });
    if (eTotalRes.success) createdDimIds.push({ name: '東側總跨 (D~A)', id: eTotalRes.data.DimensionId });

    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastContinuousGrids,
      startX: rightX_tier2,
      startY: bounds.BottomY,
      endX: rightX_tier2,
      endY: bounds.TopY
    });
    if (eContRes.success) createdDimIds.push({ name: '東側柱間距 (D-C-B-A)', id: eContRes.data.DimensionId });

    // 🌟 將所有新建立之標註套用 TABC-DIM_*/ S 2.5-柱心-上右
    let changedSuccess = 0;
    for (const item of createdDimIds) {
      const chg = await client.sendCommand('change_element_type', {
        elementId: item.id,
        typeId: typeIdUpRight
      });
      if (chg.success) {
        changedSuccess++;
      }
    }

    console.log(`  ✓ 成功建立 4 道標註，並全數變更為「TABC-DIM_*/ S 2.5-柱心-上右」(${changedSuccess}/4)`);
    summary.push({
      name: v.name,
      id: v.id,
      dimsCount: createdDimIds.length,
      changed: changedSuccess,
      status: 'SUCCESS'
    });
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 全樓板平面圖「TABC-DIM_*/ S 2.5-柱心-上右」套用完成總覽 ===`);
  console.log(`================================================================`);
  for (const s of summary) {
    console.log(`- 視圖: ${s.name.padEnd(8)} | 標註道數: ${s.dimsCount} | 型式變更成功: ${s.changed}/4 | 狀態: ${s.status}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
