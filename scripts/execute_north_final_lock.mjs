import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-final-lock-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】依使用者對齊紅線 鎖定 5 間距藍線 ＋ 雙向雙層標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 清除舊的藍線 (ID 709099 ~ 709102) 與舊尺寸標註，【嚴格保留使用者的 4 條紅線 709095 ~ 709098】
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const blueLineIds = [709099, 709100, 709101, 709102];
  for (const id of blueLineIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch (e) {}
  }
  console.log(`✓ 已清除舊標註與舊藍線，使用者對齊的 4 條紅線已完整保留！`);

  // 3. 計算 5 個間距藍線 (Step 5 = 3,250 mm)
  // 基準紅線座標:
  // 左紅線: u = 6548.1 mm
  // 右紅線: u = -8701.9 mm
  // 底紅線: v = 0.0 mm
  // 頂紅線: v = 18550.0 mm
  const uLeft = 6548.1;
  const uRight = -8701.9;
  const vBottom = 0.0;
  const vTop = 18550.0;

  const step5 = 3250.0;
  const uLeftBlue = uLeft + step5;     // 9798.1 mm (左側樓層線標示圈齊頭線)
  const uRightBlue = uRight - step5;   // -11951.9 mm
  const vBottomBlue = vBottom - step5; // -3250.0 mm
  const vTopBlue = vTop + step5;       // 21800.0 mm (頂部軸線氣泡齊頭線)

  const blueLinesToDraw = [
    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-頂部氣泡齊頭線' },
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-左側樓層齊頭線' },
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: '藍線-底部邊界' },
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: blueLinesToDraw
  });
  console.log(`✓ 4 條 5 間距齊頭藍線繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 4. 頂部柱心雙層標註 (Step 4 總跨, Step 3 連續柱心)
  console.log('\n--- 建立頂部雙層柱心標註 (D~A 軸) ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註完成: 總跨 ID ${gridDimRes.data?.TotalDimensionId}, 連續 ID ${gridDimRes.data?.ContinuousDimensionId}`);

  // 5. 側邊樓層線高程雙層標註 (Step 4 總建高, Step 3 連續層高 GL~TRFL)
  console.log('\n--- 建立側邊雙層樓層高程標註 (GL~TRFL) ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註完成: 總建高 ID ${levelDimRes.data?.TotalDimensionId}, 連續層高 ID ${levelDimRes.data?.ContinuousDimensionId}`);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】5 間距藍線齊頭與雙向雙層標註全部完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
