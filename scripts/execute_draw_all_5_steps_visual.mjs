import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'draw-5-steps-visual-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】繪製完整 5 個間距階梯標尺線 (Step 1 ~ Step 5) ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 清除舊有的藍線與標註，【嚴格保留使用者的 4 條紅線 709095 ~ 709098】
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  const redLineIds = [709095, 709096, 709097, 709098];
  for (const l of oldLines.data?.Elements || []) {
    if (!redLineIds.includes(l.ElementId)) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }
  }
  console.log(`✓ 已清除舊輔助線與舊標註，使用者對齊的 4 條紅線已完整保留！`);

  // 3. 基準紅線座標 (Step 0)
  const uLeft = 6548.1;
  const uRight = -8701.9;
  const vBottom = 0.0;
  const vTop = 18550.0;

  const stepSize = 650.0; // 每個間距 650mm (圖紙 6.5mm)
  const linesToDraw = [];

  // 為 頂部、左側、底部、右側 分別繪製 1 ~ 5 階標尺線
  for (let s = 1; s <= 5; s++) {
    const dist = s * stepSize;
    const isStep5 = (s === 5);
    // Step 5 為深藍色，Step 1~4 為淡藍色/青色輔助線
    const color = isStep5 ? { r: 0, g: 100, b: 255 } : { r: 100, g: 180, b: 255 };

    const uLeftStep = uLeft + dist;
    const uRightStep = uRight - dist;
    const vBottomStep = vBottom - dist;
    const vTopStep = vTop + dist;

    // 頂部水平階梯線 (Step 1~5)
    linesToDraw.push({
      startX: uLeft + 3250 + 1000,
      startY: vTopStep,
      endX: uRight - 3250 - 1000,
      endY: vTopStep,
      color: color,
      label: `頂部-Step ${s} (${dist}mm)${isStep5 ? ' [藍線齊頭]' : ''}`
    });

    // 左側垂直階梯線 (Step 1~5)
    linesToDraw.push({
      startX: uLeftStep,
      startY: vBottom - 3250 - 1000,
      endX: uLeftStep,
      endY: vTop + 3250 + 1000,
      color: color,
      label: `左側-Step ${s} (${dist}mm)${isStep5 ? ' [藍線齊頭]' : ''}`
    });

    // 底部水平階梯線 (Step 1~5)
    linesToDraw.push({
      startX: uLeft + 3250 + 1000,
      startY: vBottomStep,
      endX: uRight - 3250 - 1000,
      endY: vBottomStep,
      color: color,
      label: `底部-Step ${s} (${dist}mm)`
    });

    // 右側垂直階梯線 (Step 1~5)
    linesToDraw.push({
      startX: uRightStep,
      startY: vBottom - 3250 - 1000,
      endX: uRightStep,
      endY: vTop + 3250 + 1000,
      color: color,
      label: `右側-Step ${s} (${dist}mm)`
    });
  }

  console.log(`\n--- 繪製四向 5 個等距階梯輔助線 (共 ${linesToDraw.length} 條線段) ---`);
  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: linesToDraw
  });
  console.log(`✓ 5 個等距階梯標尺線繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 4. 頂部柱心雙層標註 (精準掛在 Step 4 總跨 與 Step 3 連續柱心)
  console.log('\n--- 建立頂部雙層柱心標註 (D~A 軸，鎖定於 Step 4 & Step 3) ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註完成: 總跨 ID ${gridDimRes.data?.TotalDimensionId}, 連續 ID ${gridDimRes.data?.ContinuousDimensionId}`);

  // 5. 側邊樓層線高程雙層標註 (精準掛在 Step 4 總建高 與 Step 3 連續層高)
  console.log('\n--- 建立側邊雙層樓層高程標註 (GL~TRFL，鎖定於 Step 4 & Step 3) ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註完成: 總建高 ID ${levelDimRes.data?.TotalDimensionId}, 連續層高 ID ${levelDimRes.data?.ContinuousDimensionId}`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】5 個間距完整階梯標尺線與雙向標註全部完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
