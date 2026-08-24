import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-2fl-wall-dims-3sides';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 牆心標註】右側 (東)、左側 (西)、下側 (南) 三層標註實作 ===');
  console.log('================================================================\n');

  // 1. 取得 2FL 實體外框極值
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const env = alignRes.data.PhysicalEnvelopeMm;
  const bounds = alignRes.data.AlignmentBoundsMm;
  console.log(`實體外框極值: X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm\n`);

  // 2. 清除該視圖上舊有的非柱心尺寸（保留使用者在北側示範的標註）
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of oldDims.data?.Elements || []) {
    // 若為先前測試建立的舊尺寸，予以清理；保留 North 示範 (2250275, 2250367, 2250683) 與 North 柱心
    if (d.ElementId >= 2251200) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }
  }

  // 3. 呼叫專屬 auto_dimension_wall_centerlines 執行三側 (East, West, South) 三層標註
  console.log(`🚀 執行東、西、南三側牆心三層階梯標註...`);
  const dimRes = await client.sendCommand('auto_dimension_wall_centerlines', {
    viewId: viewId,
    sides: ['east', 'west', 'south'],
    stepMm: 650.0,
    dimensionTypeId: typeIdWallDot
  });

  if (dimRes.success) {
    console.log(`\n✓ 成功建立 ${dimRes.data?.CreatedDimensionsCount || 0} 道牆心標註！`);
    console.log(`  標註型式: "${dimRes.data?.DimensionTypeName || 'TABC-DIM_dot 牆心'}"`);
    console.log(`\n📋 標註清單詳細資訊:`);
    for (const d of dimRes.data?.Dimensions || []) {
      console.log(`  - [${d.Side} 側 - 第 ${d.Layer} 層 (${d.Description})] Dimension ID: ${d.DimensionId}, 分段數: ${d.Segments || 1}`);
    }
  } else {
    console.error(`❌ 牆心標註執行失敗:`, dimRes.error);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
