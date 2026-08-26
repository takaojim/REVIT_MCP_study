import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'solid-projection-live-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【視圖實體幾何外輪廓精準放樣】北向立面 4 紅線 + 4 藍線 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 清理舊尺寸與舊線條
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }
  console.log('✓ 已清理視圖舊標註與線條');

  // 2. 依據真實外牆實體面幾何 (西外牆皮 X=826.8, 東外牆皮 X=16026.8, GL Z=0, TRFL Z=18550)
  const leftX = 826.8;
  const rightX = 16026.8;
  const botZ = 0.0;
  const topZ = 18550.0;

  const step5 = 3250.0; // 5 個間距 3,250 mm
  const leftBlueX = leftX - step5;    // -2423.2 mm
  const rightBlueX = rightX + step5;  // 19276.8 mm
  const botBlueZ = botZ - step5;      // -3250.0 mm
  const topBlueZ = topZ + step5;      // 21800.0 mm

  console.log(`📌 實體外輪廓基準 (Step 0 紅線):`);
  console.log(`   西外牆皮: X = ${leftX} mm, 東外牆皮: X = ${rightX} mm`);
  console.log(`   GL 地盤線: Z = ${botZ} mm, TRFL 頂面: Z = ${topZ} mm`);
  console.log(`📌 5 間距齊頭外框 (Step 5 藍線: 各外推 3,250 mm):`);
  console.log(`   左側齊頭線: X = ${leftBlueX} mm, 頂部齊頭線: Z = ${topBlueZ} mm\n`);

  const lines = [
    // 🔴 4 條 Step 0 基準紅線
    { startX: leftX, startY: botZ - 1000, endX: leftX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-西外牆實體面 (X=826.8)' },
    { startX: rightX, startY: botZ - 1000, endX: rightX, endY: topZ + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-東外牆實體面 (X=16026.8)' },
    { startX: leftX - 1000, startY: botZ, endX: rightX + 1000, endY: botZ, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-GL地盤基準線 (Z=0)' },
    { startX: leftX - 1000, startY: topZ, endX: rightX + 1000, endY: topZ, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-TRFL實體頂面 (Z=18550)' },

    // 🔵 4 條 Step 5 齊頭藍線
    { startX: leftBlueX, startY: botBlueZ - 1500, endX: leftBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線 (X=-2423.2)' },
    { startX: rightBlueX, startY: botBlueZ - 1500, endX: rightBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界 (X=19276.8)' },
    { startX: leftBlueX - 1500, startY: botBlueZ, endX: rightBlueX + 1500, endY: botBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界 (Z=-3250)' },
    { startX: leftBlueX - 1500, startY: topBlueZ, endX: rightBlueX + 1500, endY: topBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線 (Z=21800)' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: lines
  });
  console.log('✓ 4 條紅線與 4 條藍線繪製完成:', lineRes.data);

  // 3. 建立標準頂部雙層柱心標註與左側雙層樓層標註
  const typeIdUpRight = 689724;
  const typeIdDownRight = 689732;

  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log('✓ 頂部柱心雙層標註完成: 總跨 ID', gridDimRes.data?.TotalDimensionId, ', 連續 ID', gridDimRes.data?.ContinuousDimensionId);

  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log('✓ 側邊樓層雙層標註完成: 總高 ID', levelDimRes.data?.TotalDimensionId, ', 連續 ID', levelDimRes.data?.ContinuousDimensionId);

  console.log('\n================================================================');
  console.log('=== 🎉 【實測完成】請在 Revit 檢視 4 條紅線是否精準貼齊粗紅線！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
