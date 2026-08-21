import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-elevation-levels-runner';
  await client.connect();

  const elevationViews = [
    { name: '北', viewId: 8157 },
    { name: '東', viewId: 8176 },
    { name: '南', viewId: 98984 },
    { name: '西', viewId: 8237 }
  ];

  const typeId = 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  console.log('=== 開始執行立面圖(建築立面)所有視圖側邊樓層高程雙層自動標註 (下右型式) ===\n');

  for (const ev of elevationViews) {
    console.log(`----------------------------------------`);
    console.log(`▶ 處理立面視圖: ${ev.name} (View ID: ${ev.viewId})`);

    // 1. 切換至該視圖
    await client.sendCommand('set_active_view', { viewId: ev.viewId });

    // 2. 清理現有高程 Dimensions，保留頂部水平柱間距標註 (ID <= 2246302)
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: ev.viewId });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        // 保留頂部的柱間距標註
        if (d.ElementId > 2246302) {
          await client.sendCommand('delete_element', { elementId: d.ElementId });
        }
      }
    }

    // 3. 呼叫專屬 auto_dimension_elevation_levels（調整為 30mm 避讓距離）
    const res = await client.sendCommand('auto_dimension_elevation_levels', {
      viewId: ev.viewId,
      typeId: typeId,
      offsetTier1Mm: 30.0, // Tier 1 外層總高程距離標示圈 30mm (圖紙)
      stepTier2Mm: 6.5     // Tier 2 內層各樓層高距離 Tier 1 6.5mm (圖紙總計 36.5mm)
    });

    if (res.success && res.data) {
      console.log(`  ✓ 成功建立樓層高程雙層標註:`);
      console.log(`    - 樓層數量: ${res.data.LevelCount} 層 (${res.data.Levels?.join(', ')})`);
      console.log(`    - 外層總高程 (Tier 1): ID ${res.data.TotalDimensionId}, 總高度 = ${res.data.TotalValueMm} mm`);
      console.log(`    - 內層各樓層高 (Tier 2): ID ${res.data.ContinuousDimensionId}, 區段數 = ${res.data.SegmentsCount}`);
      console.log(`    - 套用型式: ${res.data.DimensionTypeName || 'TABC-DIM_*/ S 2.5-柱心-上右'}`);
    } else {
      console.error(`  ✗ 標註失敗:`, res.error || res.data);
    }
  }

  console.log(`\n========================================`);
  console.log(`所有立面圖側邊樓層高程雙層連續標註已完成！`);

  await client.disconnect();
}

main().catch(console.error);
