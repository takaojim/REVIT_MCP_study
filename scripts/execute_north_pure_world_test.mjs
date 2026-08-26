import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'pure-world-test-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【純世界座標測試】精確繪製北向立面 4 條紅線與 4 條藍線 ===');
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

  // 2. 定義純粹的世界座標 (World Coordinates in mm)
  // 西側外牆皮: X = 776.8 mm (或 826.8 mm)
  // 東側外牆皮: X = 16026.8 mm
  // GL地盤線: Z = 0.0 mm
  // TRFL最高頂面: Z = 18550.0 mm

  const leftWallX = 776.8;
  const rightWallX = 16026.8;
  const glZ = 0.0;
  const trflZ = 18550.0;

  const step5 = 3250.0; // 5 個間距 (650mm * 5)
  const leftBlueX = leftWallX - step5;    // -2473.2 mm
  const rightBlueX = rightWallX + step5;  // 19276.8 mm
  const botBlueZ = glZ - step5;           // -3250.0 mm
  const topBlueZ = trflZ + step5;         // 21800.0 mm

  const lines = [
    // 🔴 4 條 Step 0 基準紅線 (純世界座標)
    { startX: leftWallX, startY: glZ - 1000, endX: leftWallX, endY: trflZ + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-西外牆完成面皮 (X=776.8)' },
    { startX: rightWallX, startY: glZ - 1000, endX: rightWallX, endY: trflZ + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-東外牆完成面皮 (X=16026.8)' },
    { startX: leftWallX - 1000, startY: glZ, endX: rightWallX + 1000, endY: glZ, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-GL地盤基準線 (Z=0)' },
    { startX: leftWallX - 1000, startY: trflZ, endX: rightWallX + 1000, endY: trflZ, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-TRFL屋突頂面 (Z=18550)' },

    // 🔵 4 條 Step 5 齊頭藍線 (各外推 5 個間距 3,250mm)
    { startX: leftBlueX, startY: botBlueZ - 1500, endX: leftBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線 (X=-2473.2)' },
    { startX: rightBlueX, startY: botBlueZ - 1500, endX: rightBlueX, endY: topBlueZ + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界 (X=19276.8)' },
    { startX: leftBlueX - 1500, startY: botBlueZ, endX: rightBlueX + 1500, endY: botBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界 (Z=-3250)' },
    { startX: leftBlueX - 1500, startY: topBlueZ, endX: rightBlueX + 1500, endY: topBlueZ, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線 (Z=21800)' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: lines
  });
  console.log('✓ 4 條紅線與 4 條藍線繪製完成:', lineRes.data);

  // 3. 建立頂部柱心雙層標註與左側樓層雙層標註
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
  console.log('=== 🎉 【純世界座標測試完成】請在 Revit 檢視線條是否精準貼齊！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
