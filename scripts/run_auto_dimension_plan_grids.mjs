import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'plan-grids-auto';
  await client.connect();

  console.log('=== 連線 Revit 成功，準備呼叫 auto_dimension_plan_grids ===\n');

  // 1. 取得所有樓板平面圖視圖
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 10000 });
  const floorPlanViews = [];

  for (const v of viewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const pList = info.data?.Parameters || [];
    const getVal = (name) => pList.find(p => p.Name === name)?.Value || '';

    const viewType = getVal('視圖類型') || getVal('族群') || '';
    const typeName = getVal('類型') || '';
    const name = v.Name || '';

    const isFloorPlan = (
      info.data?.ViewType === 'FloorPlan' ||
      viewType === '樓板平面圖' ||
      typeName.includes('樓板平面圖') ||
      typeName.includes('建築平面圖') ||
      (viewType.includes('平面') && !viewType.includes('天花板') && !viewType.includes('結構') && !viewType.includes('建地平面圖') && !typeName.includes('防火區劃'))
    );

    if (isFloorPlan && !name.startsWith('{')) {
      floorPlanViews.push({
        id: v.ElementId,
        name: name,
        scale: info.data?.Scale || 100
      });
    }
  }

  console.log(`=== 找到 ${floorPlanViews.length} 個「樓板平面圖」視圖 ===`);
  for (const fv of floorPlanViews) {
    console.log(`- ID: ${fv.id.toString().padEnd(8)} | 名稱: "${fv.name}" | 比例: 1:${fv.scale}`);
  }

  // 2. 依序執行 auto_dimension_plan_grids
  for (const fv of floorPlanViews) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🚀 開始處理視圖: ${fv.name} (View ID: ${fv.id})`);

    // 切換視圖
    await client.sendCommand('set_active_view', { viewId: fv.id });

    // 清理舊標註
    const dimQuery = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: fv.id });
    if (dimQuery.data?.Elements?.length > 0) {
      for (const d of dimQuery.data.Elements) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
      console.log(`  - 已清理 ${dimQuery.data.Elements.length} 個舊標註`);
    }

    // 呼叫自動平面軸線標註（讀取幾何端點自適應）
    try {
      const res = await client.sendCommand('auto_dimension_plan_grids', {
        viewId: fv.id,
        offsetTier1Mm: 5.0,  // Tier 1 距軸號 5mm
        stepTier2Mm: 6.5     // Tier 2 距 Tier 1 6.5mm (總計 11.5mm)
      });

      if (res.success && res.data?.Success) {
        console.log(`  ✨ ${fv.name} 標註成功！`);
        console.log(`    - 垂直軸線: ${res.data.VerticalGrids?.join(', ')}`);
        console.log(`    - 水平軸線: ${res.data.HorizontalGrids?.join(', ')}`);
        console.log(`    - 建立標註數量: ${res.data.CreatedDimensionsCount} 條`);
      } else {
        console.log(`  ℹ 標註提示:`, res.data?.Message || res.error);
      }
    } catch (e) {
      console.error(`  ✗ 標註異常:`, e.message);
    }
  }

  console.log(`\n============================================================`);
  console.log(`「樓板平面圖」所有視圖自適應軸線標註已全數完成！`);

  await client.disconnect();
}

main().catch(console.error);
