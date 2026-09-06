import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-area-boundary-placement-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【建地平面圖(樓地板面積)】各樓層視圖抓牆心建立邊界線與面積 ===');
  console.log('=== (支援 5cm 庫板隔間 ＋ 自動去重縫合 ＋ 自動放置面積標籤) ===');
  console.log('================================================================\n');

  // 1. 動態掃描所有視圖，找出屬於「建地平面圖 (樓地板面積)」的視圖
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const allViews = viewsRes.data?.Elements || [];

  const targetAreaPlanViews = [];
  for (const v of allViews) {
    try {
      const vInfo = await client.sendCommand('get_element_info', { elementId: v.ElementId });
      const params = vInfo.data?.Parameters || [];
      const familyParam = params.find(p => p.Name === '族群' || p.Name === '族群和類型');
      const typeParam = params.find(p => p.Name === '類型' || p.Name === '族群與類型');
      const familyStr = familyParam ? familyParam.Value : '';
      const typeStr = typeParam ? typeParam.Value : (vInfo.data?.Type || '');

      if (familyStr.includes('建地平面圖') && typeStr.includes('樓地板面積')) {
        targetAreaPlanViews.push({
          id: v.ElementId,
          name: v.Name,
          family: familyStr,
          type: typeStr
        });
      }
    } catch (e) {}
  }

  console.log(`📌 找到 ${targetAreaPlanViews.length} 個「建地平面圖(樓地板面積)」視圖：`);
  for (const tv of targetAreaPlanViews) {
    console.log(`   - ID: ${tv.id} | Name: "${tv.name}"`);
  }
  console.log('');

  const summary = [];

  for (const tv of targetAreaPlanViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 開始處理視圖: 【${tv.name}】 (ID: ${tv.id})`);

    // A. 切換作用中視圖
    try {
      await client.sendCommand('set_active_view', { viewId: tv.id });
    } catch (e) {}

    // B. 抓牆心建立區域邊界線 (包含 5cm 庫板)
    let boundaryResult = null;
    try {
      boundaryResult = await client.sendCommand('generate_area_boundaries', {
        viewId: tv.id,
        minThicknessMm: 45.0,     // 包含 5cm 庫板 (50mm)
        includePanels: true,      // 開啟庫板白名單
        includeRailings: true,    // 陽台欄杆路徑
        snapToSlabEdge: true,     // 依建築技術規則吸附陽台樓板外緣
        viewTemplate: '計入容積', // 律定視圖樣板
        clearExisting: true,      // 清除舊區域線以確保完全乾淨
        mergeToleranceMm: 2.5,    // 2.5mm 平行線合併
        snapGapToleranceMm: 5.0   // 5mm 端點吸附縫合
      });
      console.log(`  ✓ 區域邊界線建立完成: ${boundaryResult.data?.CreatedBoundaryLinesCount} 條 (掃描 ${boundaryResult.data?.TotalWallsScanned} 道牆，優化前 ${boundaryResult.data?.ValidCurvesExtracted} 條 -> 優化後 ${boundaryResult.data?.CleanCurvesOptimized} 條)`);
    } catch (err) {
      console.log(`  ❌ 建立邊界線失敗:`, err.message);
      summary.push({ view: tv.name, id: tv.id, boundaries: 0, areas: 0, status: 'BOUNDARY_FAILED' });
      continue;
    }

    // C. 自動放置區域面積標籤 (方案 B 純幾何拓撲掃描)
    let areaResult = null;
    try {
      areaResult = await client.sendCommand('place_areas_in_view', {
        viewId: tv.id,
        useTopology: true,
        clearExisting: true,
        defaultName: '居室',
        defaultUsage: '宿舍',
        countInGross: true,
        countInFloorArea: true,
        viewTemplate: '計入容積'
      });
      console.log(`  ✓ 區域面積 (Area) 放置完成: ${areaResult.data?.CreatedAreasCount} 個`);
      if (areaResult.data?.Areas && areaResult.data.Areas.length > 0) {
        for (const a of areaResult.data.Areas) {
          console.log(`    - [${a.Name} #${a.Number}] 面積: ${a.AreaM2} m² (座標: X=${a.LocationX}, Y=${a.LocationY})`);
        }
      }
    } catch (err) {
      console.log(`  ⚠️ 放置面積標籤提示:`, err.message);
    }

    summary.push({
      view: tv.name,
      id: tv.id,
      boundaryLines: boundaryResult.data?.CreatedBoundaryLinesCount || 0,
      areasPlaced: areaResult?.data?.CreatedAreasCount || 0,
      status: 'SUCCESS'
    });
  }

  // 4. 檢核「P樓地板面積檢討」明細表連動成果
  console.log('\n================================================================');
  console.log('=== 檢核「P樓地板面積檢討」明細表 (ID: 424481) 即時連動 ===');
  console.log('================================================================');
  try {
    const schedRes = await client.sendCommand('read_schedule', { scheduleId: 424481 });
    console.log(`明細表總列數: ${schedRes.data?.RowCount}`);
    if (schedRes.data?.Rows && schedRes.data.Rows.length > 0) {
      for (let r = 0; r < Math.min(10, schedRes.data.Rows.length); r++) {
        console.log(`  Row ${r}:`, JSON.stringify(schedRes.data.Rows[r]));
      }
    }
  } catch (err) {
    console.log('  讀取明細表提示:', err.message);
  }

  console.log('\n================================================================');
  console.log('=== 執行成果統計表 ===');
  console.log('================================================================');
  console.table(summary);

  process.exit(0);
}

main().catch(err => {
  console.error('執行致命錯誤:', err);
  process.exit(1);
});
