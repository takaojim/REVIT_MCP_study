import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  // Grid IDs in order:
  // North: G(786156), F(192192), E(432845), D(432924), C(586414), B(586421), A(586428)
  const northGridIds = [786156, 192192, 432845, 432924, 586414, 586421, 586428];

  console.log('=== 測試使用原生 Grid Reference 建立標註 (完全無 DetailCurve 細線) ===');
  const res = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northGridIds,
    startX: -1691.74,
    startY: 37000,
    endX: 47333.25,
    endY: 37000,
    offset: 0
  });

  console.log('Native Grid Dimension Result:', JSON.stringify(res, null, 2));

  // If successful, delete the test dimension
  if (res.success && res.data?.DimensionId) {
    await client.sendCommand('delete_element', { elementId: res.data.DimensionId });
    console.log('測試標註已清理。');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
