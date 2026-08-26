import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'fix-blue-lines-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【修正藍線】北向立面 精確 5 個間距 (3,250 mm) 藍線放樣 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面
  const redLineIds = [709336, 709337, 709338, 709339];

  // 1. 清理舊尺寸與錯誤藍線 (保留 4 條紅線)
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
  console.log('✓ 已清除舊藍線與尺寸，保留 4 條基準紅線');

  // 2. 依紅線位置 (X_left=826.8, X_right=16026.8, Z_bot=0, Z_top=18550) 精確向外外推 5 間距 (3,250 mm):
  const leftX = 826.8;
  const rightX = 16026.8;
  const botZ = 0.0;
  const topZ = 18550.0;

  const step5 = 3250.0; // 5 個間距 3,250 mm
  const leftBlueX = leftX - step5;    // -2423.2 mm (精確外推 3,250mm)
  const rightBlueX = rightX + step5;  // 19276.8 mm (精確外推 3,250mm)
  const botBlueZ = botZ - step5;      // -3250.0 mm (精確外推 3,250mm)
  const topBlueZ = topZ + step5;      // 21800.0 mm (精確外推 3,250mm)

  console.log(`📌 基準紅線 (Step 0):`);
  console.log(`   左側 X = ${leftX} mm, 右側 X = ${rightX} mm`);
  console.log(`   底層 Z = ${botZ} mm, 頂層 Z = ${topZ} mm`);
  console.log(`📌 5 個等距藍線 (Step 5: 各退縮 3,250 mm):`);
  console.log(`   左側藍線 X = ${leftBlueX} mm (貼齊左側樓層標示圈)`);
  console.log(`   頂部藍線 Z = ${topBlueZ} mm (貼齊頂部軸號氣泡圓圈)`);
  console.log(`   右側藍線 X = ${rightBlueX} mm, 底部藍線 Z = ${botBlueZ} mm\n`);

  const blueLines = [
    // 🔵 頂部藍線 (貼齊頂部軸號氣泡圓圈下緣)
    { startX: leftBlueX - 1500, startY: topBlueZ, endX: rightBlueX + 1500, endY: topBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線 (Z=21800)' },
    // 🔵 左側藍線 (貼齊左側樓層標示圈)
    { startX: leftBlueX, startY: botBlueZ - 1500, endX: leftBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線 (X=-2423.2)' },
    // 🔵 底部藍線
    { startX: leftBlueX - 1500, startY: botBlueZ, endX: rightBlueX + 1500, endY: botBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界 (Z=-3250)' },
    // 🔵 右側藍線
    { startX: rightBlueX, startY: botBlueZ - 1500, endX: rightBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界 (X=19276.8)' }
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
  console.log('=== 🎉 【修正完成】請在 Revit 檢視藍線與紅線之間精準 5 個間距！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
