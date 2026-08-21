import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-negative-z';
  await client.connect();

  const northViewId = 8157;
  await client.sendCommand('set_active_view', { viewId: northViewId });

  // 取得北立面 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: northViewId });
  const grids = gridsRes.data?.Elements || [];
  const gridMap = {};
  for (const g of grids) gridMap[g.Name] = g.ElementId;

  // 清除目前北立面的 3 條舊 Dimensions
  const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: northViewId });
  for (const d of existingDims.data?.Elements || []) {
    await client.sendCommand('delete_element', { elementId: d.ElementId });
  }

  // 測試負向 Z（例如 -33500 與 -32800）
  console.log('在北立面測試 Z = -33,500 mm (總跨度)...');
  const d1 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: [gridMap['A'], gridMap['H']],
    startX: 47333.25, startY: 38067, startZ: -33500,
    endX: -1691.74, endY: 38067, endZ: -33500
  });
  console.log('Z = -33.5m 標註 ID:', d1.data?.DimensionId);

  console.log('在北立面測試 Z = -32,800 mm (連續尺寸)...');
  const ordered = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => gridMap[n]);
  const d2 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: ordered,
    startX: 47333.25, startY: 38067, startZ: -32800,
    endX: -1691.74, endY: 38067, endZ: -32800
  });
  console.log('Z = -32.8m 標註 ID:', d2.data?.DimensionId);

  // 套用型式 (上右)
  if (d1.data?.DimensionId && d2.data?.DimensionId) {
    await client.sendCommand('change_element_type', {
      elementIds: [d1.data.DimensionId, d2.data.DimensionId],
      typeId: 2240793 // TABC-DIM_*/ S 2.5-柱心-上右
    });
    console.log('已套用 TABC 上右型式');
  }

  await client.disconnect();
}

main().catch(console.error);
