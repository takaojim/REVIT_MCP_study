import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdUpRight = 2110318;
  const typeIdDownRight = 2110326;

  // Grid IDs: G to A
  const allXGridIds = [786156, 192192, 432845, 432924, 586414, 586421, 586428];
  // Reversed: A to G
  const reversedXGridIds = [586428, 586421, 586414, 432924, 432845, 192192, 786156];

  console.log('=== 測試反向建立北側柱心尺寸線 (X從大到小: 47333 -> -1691) ===');

  // 1. 刪除北側目前的尺寸 2111924 (或現有的北側柱心尺寸)
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of dimsRes.data.Elements) {
    if (d.Name.includes('柱心')) {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    }
  }

  // 2. 測試以反向向量建立北側柱心尺寸 (從 A 到 G，startX=47333, endX=-1691)
  const nDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: reversedXGridIds,
    startX: 47333.25,
    startY: 34000,
    endX: -1691.74,
    endY: 34000
  });
  console.log('反向建立結果:', nDim.data);

  if (nDim.success) {
    await client.sendCommand('change_element_type', {
      elementIds: [nDim.data.DimensionId],
      typeId: typeIdUpRight
    });
    console.log('已套用 柱心-上右 標註形式。');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
