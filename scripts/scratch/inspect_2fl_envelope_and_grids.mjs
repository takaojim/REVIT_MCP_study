import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-2fl-envelope';
  await client.connect();

  console.log('=== 連線成功，開始檢視 2FL 視圖之圖元包絡與軸線氣泡 ===\n');

  // 1. 取得作用中視圖 (2FL)
  const viewRes = await client.sendCommand('get_active_view', {});
  const activeView = viewRes.data;
  console.log(`📌 作用中視圖: "${activeView.Name}" (ID: ${activeView.ElementId}), 比例 1:${activeView.Scale}`);
  const viewId = activeView.ElementId;
  const scale = activeView.Scale || 100;

  // 2. 查詢視圖中的軸線 (Grids)
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const grids = gridsRes.data?.Elements || [];
  console.log(`\n📌 軸線數量: ${grids.length} 條`);

  const gridDetails = [];
  for (const g of grids) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    // 取得軸線幾何與邊界
    gridDetails.push({
      id: g.ElementId,
      name: g.Name,
      info: info.data
    });
  }

  // 3. 查詢 2FL 視圖中的實體圖元以計算建築物最外緣包絡 (Walls, Floors, Roofs, Structural Columns, Generic Models, etc.)
  console.log(`\n📌 正在抓取 2FL 實體圖元 (牆體、樓板、結構柱、屋頂/雨遮、一般模型)...`);

  const categoriesToInspect = [
    'Walls',
    'Floors',
    'StructuralColumns',
    'Roofs',
    'GenericModels',
    'Railings',
    'CurtainWallPanels'
  ];

  const envelope = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  };

  const categoryStats = {};

  for (const cat of categoriesToInspect) {
    try {
      const res = await client.sendCommand('query_elements', { category: cat, viewId: viewId, maxCount: 10000 });
      const elements = res.data?.Elements || [];
      categoryStats[cat] = elements.length;

      for (const el of elements) {
        if (el.BoundingBox) {
          const bb = el.BoundingBox;
          if (bb.Min && bb.Max) {
            // 轉為 mm
            const minX_mm = bb.Min.X * 304.8;
            const maxX_mm = bb.Max.X * 304.8;
            const minY_mm = bb.Min.Y * 304.8;
            const maxY_mm = bb.Max.Y * 304.8;

            // 排除無效或無限大的邊界
            if (Math.abs(minX_mm) < 1000000 && Math.abs(minY_mm) < 1000000) {
              envelope.minX = Math.min(envelope.minX, minX_mm);
              envelope.maxX = Math.max(envelope.maxX, maxX_mm);
              envelope.minY = Math.min(envelope.minY, minY_mm);
              envelope.maxY = Math.max(envelope.maxY, maxY_mm);
            }
          }
        }
      }
    } catch (e) {
      categoryStats[cat] = `Query Error: ${e.message}`;
    }
  }

  console.log(`\n📊 視圖圖元統計:`, JSON.stringify(categoryStats, null, 2));

  console.log(`\n📐 實體幾何外框最大包絡 (Envelope mm):`);
  console.log(`   - 西側(Min X): ${envelope.minX.toFixed(1)} mm`);
  console.log(`   - 東側(Max X): ${envelope.maxX.toFixed(1)} mm`);
  console.log(`   - 南側(Min Y): ${envelope.minY.toFixed(1)} mm`);
  console.log(`   - 北側(Max Y): ${envelope.maxY.toFixed(1)} mm`);
  console.log(`   - 總寬度 (X) : ${(envelope.maxX - envelope.minX).toFixed(1)} mm`);
  console.log(`   - 總深度 (Y) : ${(envelope.maxY - envelope.minY).toFixed(1)} mm`);

  // 4. 計算 9 個間距
  const stepMm = 6.5 * (scale / 100) * 100; // 6.5mm * 100 = 650 mm (65 cm)
  const nineStepsMm = 9 * stepMm; // 9 * 650 = 5850 mm (585 cm)
  const eightStepsMm = 8 * stepMm; // 8 * 650 = 5200 mm (520 cm)

  console.log(`\n📏 模矩與齊頭距離計算 (比例 1:${scale}):`);
  console.log(`   - 基準模矩 1U (6.5mm 出圖) = ${stepMm.toFixed(1)} mm`);
  console.log(`   - 8 個間距 (8U)             = ${eightStepsMm.toFixed(1)} mm`);
  console.log(`   - 9 個間距 (9U)             = ${nineStepsMm.toFixed(1)} mm`);

  console.log(`\n🎯 9 個間距之四向氣泡齊頭坐標 (從最外緣實體向外延伸 9U = ${nineStepsMm} mm):`);
  const target9U = {
    topY: envelope.maxY + nineStepsMm,
    bottomY: envelope.minY - nineStepsMm,
    leftX: envelope.minX - nineStepsMm,
    rightX: envelope.maxX + nineStepsMm
  };
  console.log(`   - 北側氣泡齊頭線 (Top Y)   : ${target9U.topY.toFixed(1)} mm`);
  console.log(`   - 南側氣泡齊頭線 (Bottom Y): ${target9U.bottomY.toFixed(1)} mm`);
  console.log(`   - 西側氣泡齊頭線 (Left X)  : ${target9U.leftX.toFixed(1)} mm`);
  console.log(`   - 東側氣泡齊頭線 (Right X) : ${target9U.rightX.toFixed(1)} mm`);

  console.log(`\n🎯 (對照) 8 個間距之四向氣泡齊頭坐標 (從最外緣實體向外延伸 8U = ${eightStepsMm} mm):`);
  const target8U = {
    topY: envelope.maxY + eightStepsMm,
    bottomY: envelope.minY - eightStepsMm,
    leftX: envelope.minX - eightStepsMm,
    rightX: envelope.maxX + eightStepsMm
  };
  console.log(`   - 北側氣泡齊頭線 (Top Y)   : ${target8U.topY.toFixed(1)} mm`);
  console.log(`   - 南側氣泡齊頭線 (Bottom Y): ${target8U.bottomY.toFixed(1)} mm`);
  console.log(`   - 西側氣泡齊頭線 (Left X)  : ${target8U.leftX.toFixed(1)} mm`);
  console.log(`   - 東側氣泡齊頭線 (Right X) : ${target8U.rightX.toFixed(1)} mm`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
