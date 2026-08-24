import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'elevation-runner';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備識別當前專案的「立面圖(建築立面)」所有視圖 ===\n');

  // 1. 取得所有視圖 (使用無上限 maxCount: 10000)
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const elevationViews = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || '';

    // 判斷是否為建築立面
    if (viewType === '立面圖' || viewType === '建築立面' || typeName.includes('建築立面') || typeName.includes('立面圖') || ['北', '東', '南', '西'].includes(name)) {
      // 確認 ViewType 是否為 Elevation
      if (info.data?.ViewType === 'Elevation' || viewType.includes('立面') || ['北', '東', '南', '西'].includes(name)) {
        elevationViews.push({
          id: v.ElementId,
          name: name,
          viewType,
          typeName
        });
      }
    }
  }

  console.log(`=== 找到 ${elevationViews.length} 個立面視圖 ===`);
  for (const ev of elevationViews) {
    console.log(`- ID: ${ev.id.toString().padEnd(8)} | 族群: "${ev.viewType}" | 類型: "${ev.typeName}" | 名稱: "${ev.name}"`);
  }

  const gridTypeId = 2240793;  // TABC-DIM_*/ S 2.5-柱心-上右 (頂部柱列線)
  const levelTypeId = 2240801; // TABC-DIM_*/ S 2.5-柱心-下右 (側邊樓層線)

  // 2. 依序為各立面圖建立頂部柱間距與側邊樓層距離標註
  for (const ev of elevationViews) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🚀 開始處理立面視圖: ${ev.name} (View ID: ${ev.id})`);

    // 切換視圖
    await client.sendCommand('set_active_view', { viewId: ev.id });

    // 清理舊標註
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: ev.id });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
      console.log(`  - 已清理 ${dimQuery.data.Elements.length} 個舊標註`);
    }

    // 建立頂部柱間距標註（輔助線朝下指向建築物）
    const gridRes = await client.sendCommand('auto_dimension_elevation_grids', {
      viewId: ev.id,
      typeId: gridTypeId,
      offsetTier1Mm: 5.0,  // Tier 1 距軸號圓圈 5mm (圖紙)
      stepTier2Mm: 6.5     // Tier 2 距 Tier 1 6.5mm (圖紙總計 11.5mm)
    });

    if (gridRes.success && gridRes.data) {
      console.log(`  ✓ 頂部柱心雙層標註完成 (輔助線朝下):`);
      console.log(`    - 軸線: ${gridRes.data.Grids?.join(', ')}`);
      console.log(`    - Tier 1 總跨度: ID ${gridRes.data.TotalDimensionId} (${gridRes.data.TotalValueMm} mm)`);
      console.log(`    - Tier 2 柱間距: ID ${gridRes.data.ContinuousDimensionId} (${gridRes.data.SegmentsCount} 區段)`);
    } else {
      console.error(`  ✗ 頂部標註失敗:`, gridRes.error || gridRes.data);
    }

    // 建立側邊樓層高程標註（輔助線朝右指向建築物）
    const levelRes = await client.sendCommand('auto_dimension_elevation_levels', {
      viewId: ev.id,
      typeId: levelTypeId,
      offsetTier1Mm: 30.0, // Tier 1 外層總高程距標示圈 30mm (圖紙避開文字)
      stepTier2Mm: 6.5     // Tier 2 內層各樓層高距 Tier 1 6.5mm (圖紙總計 36.5mm)
    });

    if (levelRes.success && levelRes.data) {
      console.log(`  ✓ 側邊樓層雙層標註完成 (輔助線朝右):`);
      console.log(`    - 樓層數: ${levelRes.data.LevelCount} 層 (${levelRes.data.Levels?.join(', ')})`);
      console.log(`    - Tier 1 總高程: ID ${levelRes.data.TotalDimensionId} (${levelRes.data.TotalValueMm} mm)`);
      console.log(`    - Tier 2 各層高: ID ${levelRes.data.ContinuousDimensionId} (${levelRes.data.SegmentsCount} 區段)`);
    } else {
      console.error(`  ✗ 側邊標註失敗:`, levelRes.error || levelRes.data);
    }
  }

  console.log(`\n============================================================`);
  console.log(`「立面圖(建築立面)」所有視圖柱間距與樓層距離標註已全數完成！`);

  await client.disconnect();
}

main().catch(console.error);
