import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-grid-top';
  await client.connect();

  console.log('=== 連線成功，檢查立面圖頂部軸線高度 ===\n');

  const northViewId = 8157;
  await client.sendCommand('set_active_view', { viewId: northViewId });

  // 取得北立面的 Grids
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: northViewId });
  const grids = gridsRes.data?.Elements || [];
  const gridMap = {};
  for (const g of grids) gridMap[g.Name] = g.ElementId;

  // 先清空北立面的舊 Dimensions
  const existingDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: northViewId });
  for (const d of existingDims.data?.Elements || []) {
    await client.sendCommand('delete_element', { elementId: d.ElementId });
  }

  // 測試不同 Z 高度（例如 Z = 32000, 33500）
  // 建立頂部總尺寸 A -> H
  console.log('在北立面建立頂部總尺寸 (Z = 33,500 mm)...');
  const res1 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: [gridMap['A'], gridMap['H']],
    startX: 47333.25,
    startY: 0,
    startZ: 33500,
    endX: -1691.74,
    endY: 0,
    endZ: 33500
  });
  console.log('總尺寸結果:', res1);

  // 建立頂部細部連續尺寸 A -> H
  console.log('在北立面建立頂部細部連續尺寸 (Z = 32,800 mm)...');
  const ordered = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => gridMap[n]);
  const res2 = await client.sendCommand('create_dimension', {
    viewId: northViewId,
    gridIds: ordered,
    startX: 47333.25,
    startY: 0,
    startZ: 32800,
    endX: -1691.74,
    endY: 0,
    endZ: 32800
  });
  console.log('連續尺寸結果:', res2);

  // 套用型式 (上右)
  const typesRes = await client.sendCommand('list_dimension_types', {});
  const typeUpRight = typesRes.data?.DimensionTypes?.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右');
  if (typeUpRight && res1.data?.DimensionId && res2.data?.DimensionId) {
    await client.sendCommand('change_element_type', {
      elementIds: [res1.data.DimensionId, res2.data.DimensionId],
      typeId: typeUpRight.DimensionTypeId
    });
    console.log('已成功套用型式 TABC-DIM_*/ S 2.5-柱心-上右');
  }

  await client.disconnect();
}

main().catch(console.error);
