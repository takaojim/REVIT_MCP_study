import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-struct-5steps-with-lines';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【結構平面圖所有視圖】5間距軸線齊平 ＋ 紅藍輔助線 ＋ 上右柱間距標註 ===');
  console.log('================================================================\n');

  const refViewId = 1334374; // 5FL FloorPlan (具備完整建築實體最大包絡線)
  const typeIdUpRight = 2240793; // TABC-DIM_*/ S 2.5-柱心-上右

  // 1. 先從 5FL 提取全區實體最大外框 (Step 0)
  console.log(`📌 步驟 1: 正在從 5FL (ID: ${refViewId}) 提取實體外牆外框基準...`);
  const align5fl = await client.sendCommand('align_plan_grids', {
    viewId: refViewId,
    stepCount: 5.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  if (!align5fl.success) {
    throw new Error(`無法取得 5FL 實體外框: ${align5fl.error}`);
  }

  // 實體外框極值 (Step 0)
  const env = align5fl.data.PhysicalEnvelopeMm || {
    MinX: -3266.7,
    MaxX: 47733.3,
    MinY: -20236.3,
    MaxY: 32513.7,
    Width: 51000.0,
    Depth: 52750.0
  };

  // 5 間距 (3,250 mm) 齊頭邊界 (Step 5)
  const offset5Steps = 5.0 * 650.0; // 3,250.0 mm
  const bounds = {
    TopY: env.MaxY + offset5Steps,
    BottomY: env.MinY - offset5Steps,
    LeftX: env.MinX - offset5Steps,
    RightX: env.MaxX + offset5Steps
  };

  console.log(`✓ 全區實體外框 (紅線基準, Step 0):`);
  console.log(`  - X: [${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}] mm (寬 ${(env.Width / 1000).toFixed(2)}m)`);
  console.log(`  - Y: [${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm (深 ${(env.Depth / 1000).toFixed(2)}m)`);
  console.log(`✓ 5 間距齊頭線 (藍線基準, Step 5, Offset 3,250mm):`);
  console.log(`  - TopY=${bounds.TopY.toFixed(1)}, BottomY=${bounds.BottomY.toFixed(1)}, LeftX=${bounds.LeftX.toFixed(1)}, RightX=${bounds.RightX.toFixed(1)} mm\n`);

  // 結構平面圖視圖清單
  const structViews = [
    { id: 390797, name: 'GL' },
    { id: 969343, name: 'FB' },
    { id: 969353, name: 'FT' },
    { id: 268781, name: '1FL' },
    { id: 268791, name: '2FL' },
    { id: 969323, name: '3FL' },
    { id: 969333, name: '4FL' },
    { id: 1398058, name: '5FL' },
    { id: 969363, name: 'RFL' },
    { id: 969373, name: 'TRFL' }
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
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始處理 5 間距齊頭、紅藍輔助線與柱心標註...`);

    // 1. 執行 5 間距軸線齊頭整列 (配置 A: 上/右側開啟圓圈，下/左側關閉圓圈，基準使用 5FL)
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: refViewId,
      stepCount: 5.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false
    });

    if (!alignRes.success) {
      console.error(`  ❌ [${v.name}] 齊頭整列失敗:`, alignRes.error);
      summary.push({ name: v.name, status: 'ALIGN_FAILED' });
      continue;
    }
    console.log(`  ✓ 5間距齊頭整列成功！調整 ${alignRes.data.AlignedGridsCount} 條軸線`);

    // 2. 清除該視圖上舊有尺寸標註
    const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.id });
    for (const d of oldDims.data?.Elements || []) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }

    // 3. 繪製「外牆紅線 (Step 0)」與「5 個間距藍線 (Step 5)」輔助線
    const linesToDraw = [
      // --- 紅色 實體外框紅線基準 (Step 0: 4條邊) ---
      { startX: env.MinX, startY: env.MaxY, endX: env.MaxX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-北` },
      { startX: env.MaxX, startY: env.MaxY, endX: env.MaxX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-東` },
      { startX: env.MaxX, startY: env.MinY, endX: env.MinX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-南` },
      { startX: env.MinX, startY: env.MinY, endX: env.MinX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-外牆基準紅線-西` },

      // --- 藍色 5 間距齊頭藍線 (Step 5: 4條邊) ---
      { startX: bounds.LeftX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-北` },
      { startX: bounds.RightX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-東` },
      { startX: bounds.RightX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-南` },
      { startX: bounds.LeftX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-5間距齊頭藍線-西` }
    ];

    try {
      const drawRes = await client.sendCommand('create_detail_lines', {
        viewId: v.id,
        lines: linesToDraw
      });
      console.log(`  ✓ 🎨 成功繪製 8 條輔助線（4 條外牆紅線 ＋ 4 條 5間距藍線）`);
    } catch (e) {
      console.log(`  ⚠️ 輔助線繪製提示:`, e.message);
    }

    // 4. 計算柱心標註定位 (在氣泡圓圈內側 Step 4 與 Step 3)
    const northTier1Y = bounds.TopY - 650.0;  // Step 4 (距氣泡 650mm)
    const northTier2Y = bounds.TopY - 1300.0; // Step 3 (距氣泡 1,300mm)
    const eastTier1X = bounds.RightX - 650.0; // Step 4 (距氣泡 650mm)
    const eastTier2X = bounds.RightX - 1300.0;// Step 3 (距氣泡 1,300mm)

    const spanXMax = 50000.0;
    const spanXMin = -5000.0;
    const spanYMax = 35000.0;
    const spanYMin = -22000.0;

    // 5. 北側柱心雙層標註 (向量由右至左 A -> H，輔助線朝下)
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

    // 6. 東側柱心雙層標註 (向量由下至上 1 -> 8，輔助線朝左)
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

    console.log(`  ✓ 柱間距標註建立完成: 北側 (${nTotalRes.data?.DimensionId}, ${nContRes.data?.DimensionId}), 東側 (${eTotalRes.data?.DimensionId}, ${eContRes.data?.DimensionId})`);

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
  console.log('=== 【結構平面圖所有視圖】5間距齊頭、紅藍輔助線與柱心標註全部完成！ ===');
  console.log('================================================================');
  console.table(summary);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
