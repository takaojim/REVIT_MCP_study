import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'north-perfect-step5-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】依使用者 4 條基準紅線 精準更新 4 藍線與雙向標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面
  const redLineIds = [709336, 709337, 709338, 709339];

  // 1. 清理舊尺寸與舊線條 (嚴格保留使用者的 4 條基準紅線)
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    if (!redLineIds.includes(l.ElementId)) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }
  }
  console.log('✓ 已清理舊圖元，保留使用者 4 條基準紅線 (IDs: ' + redLineIds.join(', ') + ')');

  // 2. 依使用者 4 條紅線精確外推 5 個間距 (3,250 mm) 繪製 4 條藍線
  // 紅線邊界 (SketchPlane X = 21986.03 mm):
  // 左紅線 (西外牆皮): Y = -15060.41 mm, Z in [0, 19050]
  // 右紅線 (東外牆皮): Y = 1689.59 mm, Z in [0, 19050]
  // 底紅線 (GL地盤線): Z = 0.0 mm, Y in [-15060.41, 1689.59]
  // 頂紅線 (TRFL頂面): Z = 19050.0 mm, Y in [-15060.41, 1689.59]

  const yLeftRed = -15060.41;
  const yRightRed = 1689.59;
  const zBottomRed = 0.0;
  const zTopRed = 19050.0;

  const step5 = 3250.0;
  const yLeftBlue = yLeftRed - step5;    // -18310.41 mm (左側樓層線齊頭)
  const yRightBlue = yRightRed + step5;  // 4939.59 mm
  const zBottomBlue = zBottomRed - step5;// -3250.0 mm
  const zTopBlue = zTopRed + step5;      // 22300.0 mm (頂部軸號圓圈齊頭)

  console.log(`📌 基準紅線 (Step 0):`);
  console.log(`   左側 Y = ${yLeftRed} mm, 右側 Y = ${yRightRed} mm`);
  console.log(`   底層 Z = ${zBottomRed} mm, 頂層 Z = ${zTopRed} mm`);
  console.log(`📌 齊頭藍線 (Step 5: 各外推 5 間距 3,250mm):`);
  console.log(`   左側藍線 Y = ${yLeftBlue} mm, 頂部藍線 Z = ${zTopBlue} mm\n`);

  // 注意：在北向立面中，startX/endX 對應於視圖橫軸 (Y)，startY/endY 對應於高程 (Z)
  const blueLines = [
    // 🔵 頂部藍線 (貼齊頂部所有軸號圓圈下緣)
    { startX: yLeftBlue - 1500, startY: zTopBlue, endX: yRightBlue + 1500, endY: zTopBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線 (Z=22300)' },
    // 🔵 左側藍線 (貼齊左側所有樓層線標示圈)
    { startX: yLeftBlue, startY: zBottomBlue - 1500, endX: yLeftBlue, endY: zTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線 (Y=-18310.4)' },
    // 🔵 底部藍線
    { startX: yLeftBlue - 1500, startY: zBottomBlue, endX: yRightBlue + 1500, endY: zBottomBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界 (Z=-3250)' },
    // 🔵 右側藍線
    { startX: yRightBlue, startY: zBottomBlue - 1500, endX: yRightBlue, endY: zTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界 (Y=4939.6)' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: blueLines
  });
  console.log('✓ 4 條 5 間距標準藍線繪製完成:', lineRes.data);

  // 3. 建立標準頂部雙層柱心標註與左側雙層樓層標註
  const typeIdUpRight = 689724;
  const typeIdDownRight = 689732;

  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log('✓ 頂部柱心雙層標註完成:', gridDimRes.data?.TotalDimensionId, gridDimRes.data?.ContinuousDimensionId);

  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log('✓ 側邊樓層雙層標註完成:', levelDimRes.data?.TotalDimensionId, levelDimRes.data?.ContinuousDimensionId);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面更新完成】請在 Revit 檢視 4 條藍線與雙向標註！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
