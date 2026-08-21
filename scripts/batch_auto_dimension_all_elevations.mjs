import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-elevation-dim-runner';
  await client.connect();

  const elevationViews = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  const typeId = 2240793; // TABC-DIM_*/ S 2.5-柱心-上右

  console.log('=== 開始執行立面圖(建築立面)所有視圖頂部柱間距自動標註 ===\n');

  for (const ev of elevationViews) {
    console.log(`----------------------------------------`);
    console.log(`▶ 處理立面視圖: ${ev.name} (View ID: ${ev.viewId})`);

    // 1. 切換至該視圖
    await client.sendCommand('set_active_view', { viewId: ev.viewId });

    // 2. 清理現有 Dimensions (避免重疊)
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: ev.viewId });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
      console.log(`  - 已清理 ${dimQuery.data.Elements.length} 個舊標註`);
    }

    // 3. 呼叫專屬 auto_dimension_elevation_grids
    const res = await client.sendCommand('auto_dimension_elevation_grids', {
      viewId: ev.viewId,
      typeId: typeId,
      offsetTier1Mm: 5.0,  // Tier 1 距離頂部氣泡 5mm (圖紙)
      stepTier2Mm: 6.5     // Tier 2 距離 Tier 1 6.5mm (圖紙總計 11.5mm)
    });

    if (res.success && res.data) {
      console.log(`  ✓ 成功建立立面標註:`);
      console.log(`    - 軸線數量: ${res.data.GridCount} 條 (${res.data.Grids?.join(', ')})`);
      console.log(`    - 外圈總跨度 (Tier 1): ID ${res.data.TotalDimensionId}, 總長度 = ${res.data.TotalValueMm} mm`);
      console.log(`    - 內圈細部柱間距 (Tier 2): ID ${res.data.ContinuousDimensionId}, 區段數 = ${res.data.SegmentsCount}`);
      console.log(`    - 套用型式: ${res.data.DimensionTypeName || 'TABC-DIM_*/ S 2.5-柱心-上右'}`);
    } else {
      console.error(`  ✗ 標註失敗:`, res.error || res.data);
    }
  }

  console.log(`\n========================================`);
  console.log(`所有立面圖頂部柱心連續標註已完成！`);

  await client.disconnect();
}

main().catch(console.error);
