import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-elevation-dimension';
  await client.connect();

  console.log('=== 測試立面圖建立尺寸標註 ===\n');

  const northViewId = 8157; // 北立面
  await client.sendCommand('set_active_view', { viewId: northViewId });

  // 取得北立面的 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: northViewId });
  const grids = gridsRes.data?.Elements || [];
  console.log(`北立面 Grids:`, grids);

  const gridMap = {};
  for (const g of grids) {
    gridMap[g.Name] = g.ElementId;
  }

  // 取得北立面的 Levels
  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels', viewId: northViewId });
  console.log(`北立面 Levels:`, levelsRes.data?.Elements);

  // 測試建立尺寸標註 (A 到 H)
  // Let's test calling create_dimension on north elevation
  try {
    console.log('嘗試在北立面建立標註...');
    const dimRes = await client.sendCommand('create_dimension', {
      viewId: northViewId,
      gridIds: [gridMap['A'], gridMap['H']],
      startX: 47333.25,
      startY: 0,
      endX: -1691.74,
      endY: 0
    });
    console.log('建立總尺寸結果:', dimRes);

    if (dimRes.data?.DimensionId) {
      console.log('成功建立總尺寸 ID:', dimRes.data.DimensionId);
    }
  } catch (err) {
    console.error('建立失敗:', err);
  }

  await client.disconnect();
}

main().catch(console.error);
