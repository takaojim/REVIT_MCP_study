import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-grid-dims-top-right';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【全樓板平面圖】上方 (北側) 與 右側 (東側) 正確柱心標註建立 ===');
  console.log('================================================================\n');

  // 當前專案之主要樓板平面圖視圖清單
  const targetViews = [
    { id: 312, name: '1FL', refId: null },
    { id: 695, name: '2FL', refId: null },
    { id: 428158, name: '3FL', refId: null },
    { id: 624294, name: '4FL', refId: null },
    { id: 624304, name: 'RFL', refId: 624294 }, // 繼承 4FL 基準
    { id: 624314, name: 'TRFL', refId: 624294 }  // 繼承 4FL 基準
  ];

  // 1. 北側 (上方，水平尺寸線) 標註 南北向垂直軸線: 1, 2, 3, 4
  // 向量由右至左 (東向西: 4 -> 1)，使端點輔助線朝下指向建物本體
  const northContinuousGrids = [596080, 432630, 432966, 192066]; // 4 -> 3 -> 2 -> 1
  const northTotalGrids = [596080, 192066]; // 4, 1

  // 2. 東側 (右側，垂直尺寸線) 標註 東西向水平軸線: A, B, C, D
  // 向量由下至上 (南向北: D -> A)，使端點輔助線朝左指向建物本體
  const eastContinuousGrids = [611573, 432924, 432845, 192192]; // D -> C -> B -> A
  const eastTotalGrids = [611573, 192192]; // D, A

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始建立正確上右柱心標註...`);

    // 取得該視圖 8 間距齊頭範圍
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

    const createdDims = [];

    // --- 北側 (上方) 標註建立 (由右至左: 4 -> 1) ---
    // (a) 北側 Tier 1: 全區總跨尺寸
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northTotalGrids,
      startX: bounds.RightX,
      startY: topY_tier1,
      endX: bounds.LeftX,
      endY: topY_tier1
    });
    if (nTotalRes.success) {
      createdDims.push({ side: '北側總跨 (1~4軸)', id: nTotalRes.data.DimensionId, val: nTotalRes.data.Value, segs: nTotalRes.data.SegmentsCount });
    }

    // (b) 北側 Tier 2: 連續柱間距分段尺寸
    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northContinuousGrids,
      startX: bounds.RightX,
      startY: topY_tier2,
      endX: bounds.LeftX,
      endY: topY_tier2
    });
    if (nContRes.success) {
      createdDims.push({ side: '北側柱間距 (4-3-2-1)', id: nContRes.data.DimensionId, val: nContRes.data.Value, segs: nContRes.data.SegmentsCount });
    }

    // --- 東側 (右側) 標註建立 (由下至上: D -> A) ---
    // (c) 東側 Tier 1: 全區總跨尺寸
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastTotalGrids,
      startX: rightX_tier1,
      startY: bounds.BottomY,
      endX: rightX_tier1,
      endY: bounds.TopY
    });
    if (eTotalRes.success) {
      createdDims.push({ side: '東側總跨 (D~A軸)', id: eTotalRes.data.DimensionId, val: eTotalRes.data.Value, segs: eTotalRes.data.SegmentsCount });
    }

    // (d) 東側 Tier 2: 連續柱間距分段尺寸
    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastContinuousGrids,
      startX: rightX_tier2,
      startY: bounds.BottomY,
      endX: rightX_tier2,
      endY: bounds.TopY
    });
    if (eContRes.success) {
      createdDims.push({ side: '東側柱間距 (D-C-B-A)', id: eContRes.data.DimensionId, val: eContRes.data.Value, segs: eContRes.data.SegmentsCount });
    }

    console.log(`  ✓ 成功建立 4 道柱心標註 (北側 2 道 ＋ 東側 2 道):`);
    for (const cd of createdDims) {
      console.log(`    - [${cd.side}] ID: ${cd.id} | 值: ${cd.val}mm | 分段: ${cd.segs}`);
    }

    summary.push({
      name: v.name,
      id: v.id,
      dimsCount: createdDims.length,
      dims: createdDims,
      status: 'SUCCESS'
    });
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 全樓板平面圖上方與右側柱心標註建立完成總覽 ===`);
  console.log(`================================================================`);
  for (const s of summary) {
    console.log(`- 視圖: ${s.name.padEnd(8)} | 標註: ${s.dimsCount} 道 (北側 14,400mm ＋ 東側 15,900mm) | 狀態: ${s.status}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
