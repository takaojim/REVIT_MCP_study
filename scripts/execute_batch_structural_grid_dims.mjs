import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-structural-grid-dims';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【結構平面圖所有視圖】5 間距軸線齊頭 ＋ 上右柱心標註 ===');
  console.log('================================================================\n');

  // 目標柱心標註型式 ID: TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdUpRight = 2240793;

  // 結構平面圖視圖清單 (5FL 為標準層基準)
  const structViews = [
    { id: 390797, name: 'GL', refId: 1398058 },
    { id: 969343, name: 'FB', refId: 1398058 },
    { id: 969353, name: 'FT', refId: 1398058 },
    { id: 268781, name: '1FL', refId: null },
    { id: 268791, name: '2FL', refId: null },
    { id: 969323, name: '3FL', refId: null },
    { id: 969333, name: '4FL', refId: null },
    { id: 1398058, name: '5FL', refId: null },
    { id: 969363, name: 'RFL', refId: 1398058 },
    { id: 969373, name: 'TRFL', refId: 1398058 }
  ];

  // 北側垂直軸線 (由右至左: A -> B -> C -> D -> E -> F -> G -> H)
  const northContinuousGrids = [586428, 586421, 586414, 432924, 432845, 192192, 786156, 2110013];
  const northTotalGrids = [586428, 2110013];

  // 東側水平軸線 (由下至上: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8)
  const eastContinuousGrids = [192066, 432966, 432630, 586498, 586507, 586516, 2109573, 1353259];
  const eastTotalGrids = [192066, 1353259];

  const summary = [];

  for (const v of structViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始執行 5 間距齊頭與上右柱間距標註...`);

    // 1. 執行 5 間距 (3,250mm) 軸線齊頭整列 (配置 A: 上/右開啟氣泡，下/左關閉氣泡)
    const alignPayload = {
      viewId: v.id,
      stepCount: 5.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    };
    if (v.refId) alignPayload.referenceViewId = v.refId;

    const alignRes = await client.sendCommand('align_plan_grids', alignPayload);
    if (!alignRes.success) {
      console.error(`  ❌ 齊頭整列失敗:`, alignRes.error);
      summary.push({ name: v.name, status: 'ALIGN_FAILED' });
      continue;
    }

    const data = alignRes.data;
    const bounds = data.AlignmentBounds;
    console.log(`  ✓ 5間距齊頭整列完成！共調整 ${data.AlignedGridsCount} 條軸線`);
    console.log(`    - 氣泡圓圈定位 (Step 5, Offset 3,250mm): Top=${bounds.TopY.toFixed(1)}, Right=${bounds.RightX.toFixed(1)} mm`);

    // 2. 清除該視圖上舊有尺寸標註
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }

    // 3. 計算尺寸線定位座標 (5 個間距梯級)
    // 氣泡圓圈位於 Step 5 (bounds.TopY, bounds.RightX)
    // Tier 1 (外層總跨): 距氣泡 650mm (Step 4)
    // Tier 2 (內層連續柱間距): 距氣泡 1300mm (Step 3)
    const northTier1Y = bounds.TopY - 650.0;
    const northTier2Y = bounds.TopY - 1300.0;
    const eastTier1X = bounds.RightX - 650.0;
    const eastTier2X = bounds.RightX - 1300.0;

    // 4. 建立北側 (上方，水平尺寸線) 雙層柱心標註
    // 向量由右至左 (東向西: A -> H)，使輔助線朝下指向建物本體
    const spanXMax = 50000.0;
    const spanXMin = -5000.0;

    // (A) 北側外層總跨 (A, H)
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

    // (B) 北側內層連續柱間距 (A -> H)
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

    // 5. 建立東側 (右側，垂直尺寸線) 雙層柱心標註
    // 向量由下至上 (南向北: 1 -> 8)，使輔助線朝左指向建物本體
    const spanYMax = 35000.0;
    const spanYMin = -22000.0;

    // (A) 東側外層總跨 (1, 8)
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

    // (B) 東側內層連續柱間距 (1 -> 8)
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

    console.log(`  ✓ [${v.name}] 上右柱間距標註建立完成:`);
    console.log(`    - 北側總跨 ID: ${nTotalRes.data?.DimensionId}, 連續柱間距 ID: ${nContRes.data?.DimensionId}`);
    console.log(`    - 東側總跨 ID: ${eTotalRes.data?.DimensionId}, 連續柱間距 ID: ${eContRes.data?.DimensionId}`);

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
  console.log('=== 【結構平面圖所有視圖】5 間距齊頭與柱心標註處理結果 ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
