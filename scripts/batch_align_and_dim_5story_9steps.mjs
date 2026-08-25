import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-align-dim-5story-9steps';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【5層大專案全樓板平面圖】9 間距 (5,850mm) 齊頭整列 ＋ 上右柱心標註 ===');
  console.log('================================================================\n');

  // 目標標註型式 ID
  const typeIdUpRight = 2240793; // TABC-DIM_*/ S 2.5-柱心-上右

  // 樓板平面圖視圖清單 (5FL 為頂層標準層，RFL/TRFL 繼承 5FL 外框基準)
  const targetViews = [
    { id: 312, name: '1FL', refId: null },
    { id: 695, name: '2FL', refId: null },
    { id: 428158, name: '3FL', refId: null },
    { id: 586080, name: '4FL', refId: null },
    { id: 1334374, name: '5FL', refId: null },
    { id: 586090, name: 'RFL', refId: 1334374 }, // 繼承 5FL 外框
    { id: 586100, name: 'TRFL', refId: 1334374 }  // 繼承 5FL 外框
  ];

  // 北側垂直軸線 (由右至左: A -> B -> C -> D -> E -> F -> G -> H)
  const northContinuousGrids = [586428, 586421, 586414, 432924, 432845, 192192, 786156, 2110013];
  const northTotalGrids = [586428, 2110013];

  // 東側水平軸線 (由下至上: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8)
  const eastContinuousGrids = [192066, 432966, 432630, 586498, 586507, 586516, 2109573, 1353259];
  const eastTotalGrids = [192066, 1353259];

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始執行 9 間距齊頭整列與上右柱心標註...`);

    // 1. 執行 9 間距 (5,850mm) 軸線齊頭整列 (配置 A)
    const alignPayload = {
      viewId: v.id,
      stepCount: 9.0,
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
    const bounds = data.AlignmentBoundsMm;
    const env = data.PhysicalEnvelopeMm;
    console.log(`  ✓ 齊頭整列完成！共調整 ${data.AlignedGridsCount} 條軸線 (基準: ${data.ReferenceViewName})`);
    console.log(`    - 實體外框: 寬 ${(env.Width / 1000).toFixed(2)}m x 深 ${(env.Depth / 1000).toFixed(2)}m`);
    console.log(`    - 9間距齊頭範圍 (Offset 5,850mm): Top=${bounds.TopY.toFixed(1)}, Right=${bounds.RightX.toFixed(1)} mm`);

    // 2. 清除該視圖上舊有尺寸標註
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }

    // 3. 計算上方與右側標準雙層標註放樣位置
    // Tier 1 (外層總跨): 距圓標 650mm
    // Tier 2 (內層柱間距): 距圓標 1300mm
    const topY_tier1 = bounds.TopY - 650.0;
    const topY_tier2 = bounds.TopY - 1300.0;

    const rightX_tier1 = bounds.RightX - 650.0;
    const rightX_tier2 = bounds.RightX - 1300.0;

    const createdDims = [];

    // (a) 北側 Tier 1: 全區總跨 (A ~ H)
    const nTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northTotalGrids,
      startX: bounds.RightX,
      startY: topY_tier1,
      endX: bounds.LeftX,
      endY: topY_tier1,
      typeId: typeIdUpRight
    });
    if (nTotalRes.success) createdDims.push({ side: '北側總跨 (A~H)', id: nTotalRes.data.DimensionId, val: nTotalRes.data.Value, segs: nTotalRes.data.SegmentsCount });

    // (b) 北側 Tier 2: 連續柱間距 (A -> H, 7分段)
    const nContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: northContinuousGrids,
      startX: bounds.RightX,
      startY: topY_tier2,
      endX: bounds.LeftX,
      endY: topY_tier2,
      typeId: typeIdUpRight
    });
    if (nContRes.success) createdDims.push({ side: '北側柱間距 (7段)', id: nContRes.data.DimensionId, val: nContRes.data.Value, segs: nContRes.data.SegmentsCount });

    // (c) 東側 Tier 1: 全區總跨 (1 ~ 8)
    const eTotalRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastTotalGrids,
      startX: rightX_tier1,
      startY: bounds.BottomY,
      endX: rightX_tier1,
      endY: bounds.TopY,
      typeId: typeIdUpRight
    });
    if (eTotalRes.success) createdDims.push({ side: '東側總跨 (1~8)', id: eTotalRes.data.DimensionId, val: eTotalRes.data.Value, segs: eTotalRes.data.SegmentsCount });

    // (d) 東側 Tier 2: 連續柱間距 (1 -> 8, 7分段)
    const eContRes = await client.sendCommand('create_dimension', {
      viewId: v.id,
      gridIds: eastContinuousGrids,
      startX: rightX_tier2,
      startY: bounds.BottomY,
      endX: rightX_tier2,
      endY: bounds.TopY,
      typeId: typeIdUpRight
    });
    if (eContRes.success) createdDims.push({ side: '東側柱間距 (7段)', id: eContRes.data.DimensionId, val: eContRes.data.Value, segs: eContRes.data.SegmentsCount });

    // 🌟 強制切換標註型式為 TABC-DIM_*/ S 2.5-柱心-上右
    let changedCount = 0;
    for (const cd of createdDims) {
      const chg = await client.sendCommand('change_element_type', {
        elementId: cd.id,
        typeId: typeIdUpRight
      });
      if (chg.success) changedCount++;
    }

    console.log(`  ✓ 成功建立 4 道雙層柱心尺寸，型式皆為「TABC-DIM_*/ S 2.5-柱心-上右」(${changedCount}/4)`);
    for (const cd of createdDims) {
      console.log(`    - [${cd.side}] ID: ${cd.id} | 值: ${cd.val} mm | 分段: ${cd.segs}`);
    }

    // 4. 繪製紅色實體外框線與藍色 9 間距齊頭檢測輔助線
    const linesToDraw = [
      // 紅色實體外框 (4邊)
      { startX: env.MinX, startY: env.MaxY, endX: env.MaxX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-北` },
      { startX: env.MaxX, startY: env.MaxY, endX: env.MaxX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-東` },
      { startX: env.MaxX, startY: env.MinY, endX: env.MinX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-南` },
      { startX: env.MinX, startY: env.MinY, endX: env.MinX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-西` },

      // 藍色 9 間距齊頭線框 (4邊)
      { startX: bounds.LeftX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-北` },
      { startX: bounds.RightX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-東` },
      { startX: bounds.RightX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-南` },
      { startX: bounds.LeftX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', { viewId: v.id, lines: linesToDraw });
      console.log(`    - 🎨 成功繪製 8 條檢測輔助線（4 紅 ＋ 4 藍）`);
    } catch (e) {}

    summary.push({
      name: v.name,
      id: v.id,
      grids: data.AlignedGridsCount,
      ref: data.ReferenceViewName || v.name,
      dims: createdDims.length,
      status: 'SUCCESS'
    });
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 全樓板平面圖 9 間距齊頭整列與上右柱心標註完成總覽 ===`);
  console.log(`================================================================`);
  for (const s of summary) {
    console.log(`- 視圖: ${s.name.padEnd(8)} | 軸線: ${s.grids} 條 | 基準: ${s.ref.padEnd(6)} | 標註: ${s.dims} 道 | 狀態: ${s.status}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
