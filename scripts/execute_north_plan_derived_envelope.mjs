import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'plan-derived-elevation-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【平面外牆定位線法】精確解析立面實體外輪廓 (North Elevation) ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保 TABC 標註型式
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  // 2. 從平面角度查詢所有牆體，抓取「最西側外牆面 (Left)」與「最東側外牆面 (Right)」
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  let minWallLeftX = Infinity;
  let maxWallRightX = -Infinity;
  let bestLeftWall = null;
  let bestRightWall = null;

  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      const d = info.data;
      if (d.Thickness < 120) continue; // 排除薄板矮牆
      if (d.Length < 1000) continue;   // 排除短牆

      const sx = d.StartX;
      const ex = d.EndX;
      const sy = d.StartY;
      const ey = d.EndY;

      // 南北向外牆（垂直於 X 軸）
      const isVert = Math.abs(ex - sx) < 100;
      const avgX = (sx + ex) / 2.0;
      const halfThick = d.Thickness / 2.0;

      const leftFace = avgX - halfThick;
      const rightFace = avgX + halfThick;

      if (leftFace < minWallLeftX) {
        minWallLeftX = leftFace;
        bestLeftWall = { id: w.ElementId, name: d.Name, level: d.Level, avgX, thickness: d.Thickness, leftFace };
      }
      if (rightFace > maxWallRightX) {
        maxWallRightX = rightFace;
        bestRightWall = { id: w.ElementId, name: d.Name, level: d.Level, avgX, thickness: d.Thickness, rightFace };
      }
    }
  }

  console.log('📌 【平面外牆解析成果】:');
  console.log(`   最西側外牆: ${bestLeftWall?.name} (${bestLeftWall?.level}), 柱心 X=${bestLeftWall?.avgX.toFixed(1)} mm, 外皮 Left X = ${minWallLeftX.toFixed(1)} mm`);
  console.log(`   最東側外牆: ${bestRightWall?.name} (${bestRightWall?.level}), 柱心 X=${bestRightWall?.avgX.toFixed(1)} mm, 外皮 Right X = ${maxWallRightX.toFixed(1)} mm`);

  // 3. 查詢樓層高程 (GL 與 最高頂層)
  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels' });
  const glLevel = levelsRes.data?.Elements?.find(l => l.Name === 'GL');
  const trflLevel = levelsRes.data?.Elements?.find(l => l.Name === 'TRFL');

  const bottomZ = 0.0;       // GL 地盤線高程
  const topZ = 18550.0;      // TRFL 屋突實體頂面高程 (或包含女兒牆)

  console.log(`   底層 GL 高程: Bottom Z = ${bottomZ.toFixed(1)} mm`);
  console.log(`   頂層 TRFL 高程: Top Z = ${topZ.toFixed(1)} mm\n`);

  // 4. 清理視圖舊圖元
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
  }

  // 5. 轉換為立面視圖投影座標 (View Origin X = 7324.9 mm, vRight = -X)
  // X_target -> u = 7324.9 - X_target
  const viewOriginX = 7324.9;
  const uLeftRed = viewOriginX - minWallLeftX;     // 左側紅線投影
  const uRightRed = viewOriginX - maxWallRightX;   // 右側紅線投影
  const vBottomRed = bottomZ;                      // 底部紅線投影
  const vTopRed = topZ;                            // 頂部紅線投影

  // 5 個間距藍線 (退縮 3,250 mm)
  const step5 = 3250.0;
  const uLeftBlue = uLeftRed + step5;     // 左側齊頭藍線
  const uRightBlue = uRightRed - step5;   // 右側藍線
  const vBottomBlue = vBottomRed - step5; // 底部藍線
  const vTopBlue = vTopRed + step5;       // 頂部齊頭藍線

  const guideLines = [
    // 🔴 紅線 (Step 0: 由平面外牆完成面推導)
    { startX: uLeftRed + 1000, startY: vBottomRed, endX: uRightRed - 1000, endY: vBottomRed, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-GL地盤線' },
    { startX: uLeftRed + 1000, startY: vTopRed, endX: uRightRed - 1000, endY: vTopRed, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-TRFL頂面' },
    { startX: uLeftRed, startY: vBottomRed - 1000, endX: uLeftRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-西外牆皮' },
    { startX: uRightRed, startY: vBottomRed - 1000, endX: uRightRed, endY: vTopRed + 1000, color: { r: 255, g: 0, b: 0 }, label: 'Step 0-紅線-東外牆皮' },

    // 🔵 藍線 (Step 5: 5個間距 3,250mm 齊頭線)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-頂部氣泡齊頭線' },
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-左側樓層齊頭線' },
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-底部邊界' },
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: 'Step 5-藍線-右側邊界' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: guideLines
  });
  console.log(`✓ 4 條平面推導紅線 (Step 0) 與 4 條齊頭藍線 (Step 5) 繪製完成:`, lineRes.data?.LinesCreated || lineRes);

  // 6. 頂部柱心雙層標註 (Step 4 總跨, Step 3 連續)
  console.log('\n--- 建立頂部柱心雙層標註 (D~A 軸) ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log(`  ✓ 頂部柱心標註: 總跨 ID ${gridDimRes.data?.TotalDimensionId}, 連續 ID ${gridDimRes.data?.ContinuousDimensionId}`);

  // 7. 側邊樓層高程雙層標註 (GL~TRFL)
  console.log('\n--- 建立側邊樓層高程雙層標註 (GL~TRFL) ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });
  console.log(`  ✓ 側邊樓層標註: 總建高 ID ${levelDimRes.data?.TotalDimensionId}, 連續層高 ID ${levelDimRes.data?.ContinuousDimensionId}`);

  console.log('\n================================================================');
  console.log('=== 🎉 【平面外牆定位線法】全流程執行完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
