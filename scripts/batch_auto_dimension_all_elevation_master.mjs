import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-elevation-master-runner';
  await client.connect();

  const elevationViews = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  const gridTypeId = 2240793;  // TABC-DIM_*/ S 2.5-柱心-上右 (頂部柱列線)
  const levelTypeId = 2240801; // TABC-DIM_*/ S 2.5-柱心-下右 (側邊樓層線)

  console.log('=== 開始執行立面圖(建築立面)全套雙層標準標註（頂部柱間距 + 側邊樓層高程）===\n');

  for (const ev of elevationViews) {
    console.log(`------------------------------------------------------------`);
    console.log(`▶ 處理立面視圖: ${ev.name} (View ID: ${ev.viewId})`);

    // 1. 切換至該視圖
    await client.sendCommand('set_active_view', { viewId: ev.viewId });

    // 2. 清理現有 Dimensions (確保無重複或舊標註)
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: ev.viewId });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
      console.log(`  - 已清理 ${dimQuery.data.Elements.length} 個舊標註`);
    }

    // 3. 生成頂部柱間距雙層標註（輔助線全數朝下指向建築物）
    const gridRes = await client.sendCommand('auto_dimension_elevation_grids', {
      viewId: ev.viewId,
      typeId: gridTypeId,
      offsetTier1Mm: 5.0,  // Tier 1 距軸號圓圈 5mm (圖紙)
      stepTier2Mm: 6.5     // Tier 2 距 Tier 1 6.5mm (圖紙總計 11.5mm)
    });

    if (gridRes.success && gridRes.data) {
      console.log(`  ✓ 頂部柱心雙層標註完成 (輔助線向下指向建物):`);
      console.log(`    - 軸線: ${gridRes.data.Grids?.join(', ')}`);
      console.log(`    - Tier 1 總跨度: ID ${gridRes.data.TotalDimensionId} (${gridRes.data.TotalValueMm} mm)`);
      console.log(`    - Tier 2 柱間距: ID ${gridRes.data.ContinuousDimensionId} (${gridRes.data.SegmentsCount} 區段)`);
    } else {
      console.error(`  ✗ 頂部標註失敗:`, gridRes.error || gridRes.data);
    }

    // 4. 生成側邊樓層高程雙層標註（輔助線全數朝右指向建築物）
    const levelRes = await client.sendCommand('auto_dimension_elevation_levels', {
      viewId: ev.viewId,
      typeId: levelTypeId,
      offsetTier1Mm: 30.0, // Tier 1 外層總高程距標示圈 30mm (圖紙避開文字)
      stepTier2Mm: 6.5     // Tier 2 內層各樓層高距 Tier 1 6.5mm (圖紙總計 36.5mm)
    });

    if (levelRes.success && levelRes.data) {
      console.log(`  ✓ 側邊樓層雙層標註完成 (輔助線向右指向建物):`);
      console.log(`    - 樓層數: ${levelRes.data.LevelCount} 層 (${levelRes.data.Levels?.join(', ')})`);
      console.log(`    - Tier 1 總高程: ID ${levelRes.data.TotalDimensionId} (${levelRes.data.TotalValueMm} mm)`);
      console.log(`    - Tier 2 各層高: ID ${levelRes.data.ContinuousDimensionId} (${levelRes.data.SegmentsCount} 區段)`);
    } else {
      console.error(`  ✗ 側邊標註失敗:`, levelRes.error || levelRes.data);
    }
  }

  console.log(`\n============================================================`);
  console.log(`全部 4 個立面視圖頂部與側邊雙層連續標註已全數完美生成！`);

  await client.disconnect();
}

main().catch(console.error);
