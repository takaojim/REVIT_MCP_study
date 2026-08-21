import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-z-heights';
  await client.connect();

  const northViewId = 8157;
  await client.sendCommand('set_active_view', { viewId: northViewId });

  // 取得北立面 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: northViewId });
  const grids = gridsRes.data?.Elements || [];
  const gridMap = {};
  for (const g of grids) gridMap[g.Name] = g.ElementId;

  // 清除目前北立面的 Dimensions
  const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: northViewId });
  for (const d of existingDims.data?.Elements || []) {
    await client.sendCommand('delete_element', { elementId: d.ElementId });
  }

  // 測試建立幾條不同 Z 值的標註：
  // 1. Z = 40,000 mm (40m)
  console.log('建立 Z = 40,000 mm 標註...');
  const d40 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: [gridMap['A'], gridMap['H']],
    startX: 47333.25, startY: 38067, startZ: 40000,
    endX: -1691.74, endY: 38067, endZ: 40000
  });
  console.log('Z=40m 標註 ID:', d40.data?.DimensionId);

  // 2. Z = 35,000 mm (35m)
  console.log('建立 Z = 35,000 mm 標註...');
  const d35 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: [gridMap['A'], gridMap['H']],
    startX: 47333.25, startY: 38067, startZ: 35000,
    endX: -1691.74, endY: 38067, endZ: 35000
  });
  console.log('Z=35m 標註 ID:', d35.data?.DimensionId);

  // 3. Z = 30,000 mm (30m)
  console.log('建立 Z = 30,000 mm 標註...');
  const d30 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: [gridMap['A'], gridMap['H']],
    startX: 47333.25, startY: 38067, startZ: 30000,
    endX: -1691.74, endY: 38067, endZ: 30000
  });
  console.log('Z=30m 標註 ID:', d30.data?.DimensionId);

  await client.disconnect();
}

main().catch(console.error);
