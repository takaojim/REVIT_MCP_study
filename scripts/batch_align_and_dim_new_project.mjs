import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'new-project-align-dim-9steps';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【新專案全樓板平面圖】9 間距 (5,850mm) 軸線齊頭 ＋ 上右柱心標註 ===');
  console.log('================================================================\n');

  // 1. 取得當前視圖以確認連線與模型狀態
  const activeViewRes = await client.sendCommand('get_active_view', {});
  console.log(`📍 當前作用中視圖: "${activeViewRes.data?.Name}" (ID: ${activeViewRes.data?.ViewId}, Type: ${activeViewRes.data?.ViewType})\n`);

  // 2. 查詢專案中所有樓板平面圖
  const allViewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const floorPlans = (allViewsRes.data?.Elements || []).filter(v => {
    const name = v.Name || '';
    return (v.Type === '樓板平面圖' || v.Type === 'FloorPlan') &&
           !name.includes('複製') && !name.includes('Copy') && !name.includes('敷地') && !name.includes('Site') &&
           !name.includes('管線') && !name.includes('機電') && !name.includes('結構') && !name.includes('區劃');
  });

  console.log(`📋 探索到 ${floorPlans.length} 個主要建築樓板平面圖視圖:`);
  for (const fp of floorPlans) {
    console.log(`  - 視圖: "${fp.Name}" (ID: ${fp.ElementId})`);
  }

  // 3. 查詢標註型式 (找 TABC-DIM_*/ S 2.5-柱心-上右)
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];
  let typeUpRight = dimTypes.find(t => t.DimensionTypeName.includes('柱心-上右') || t.DimensionTypeName.includes('上右'));
  if (!typeUpRight) {
    typeUpRight = dimTypes.find(t => t.DimensionTypeName.includes('TABC-DIM') && t.FamilyName === '線性尺寸標註型式');
  }
  console.log(`\n🏷️ 匹配標註型式: "${typeUpRight?.DimensionTypeName}" (ID: ${typeUpRight?.DimensionTypeId})\n`);

  // 4. 查詢專案軸線並分析方向 (垂直軸線 vs 水平軸線)
  const sampleViewId = floorPlans[0]?.ElementId || activeViewRes.data?.ViewId;
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: sampleViewId, maxCount: 200 });
  const allGrids = gridsRes.data?.Elements || [];
  console.log(`📐 專案軸線清單 (${allGrids.length} 條):`);

  // 取得軸線幾何方位與座標
  // 透過 align_plan_grids 試跑 sample view 來取得軸線分組與幾何 Envelope
  const sampleAlign = await client.sendCommand('align_plan_grids', {
    viewId: sampleViewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  console.log('Sample View Align Result:', sampleAlign.data?.Message);

  // 判斷哪些樓層為主要樓層，哪些為屋頂/屋突層 (繼承最頂層標準層外框)
  // 找出最高主要樓層 (如 5FL 或 4FL)
  let topMainFloor = null;
  const mainFloorCandidates = floorPlans.filter(f => {
    const n = f.Name.toUpperCase();
    return !n.includes('RFL') && !n.includes('TRFL') && !n.includes('RF') && !n.includes('ROOF') && !n.includes('屋') && !n.includes('突');
  });

  // 依樓層名稱排序尋找頂層主要樓層
  for (const m of mainFloorCandidates) {
    if (!topMainFloor) topMainFloor = m;
    else {
      // 比較如 5FL > 4FL > 3FL > 2FL > 1FL
      if (m.Name.localeCompare(topMainFloor.Name, undefined, { numeric: true }) > 0) {
        topMainFloor = m;
      }
    }
  }
  console.log(`🌟 判斷頂層主要樓層為: "${topMainFloor?.Name}" (ID: ${topMainFloor?.ElementId})\n`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
