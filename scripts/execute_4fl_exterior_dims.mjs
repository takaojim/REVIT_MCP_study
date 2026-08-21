import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data.ElementId;
  console.log(`=== 執行 4FL 外牆外側房間牆心尺寸標註 (View ID: ${viewId}) ===`);

  // 使用 auto_dimension_walls
  // 建立建築物外牆外側的連續牆心與開間尺寸
  const res = await client.sendCommand('auto_dimension_walls', {
    viewId: viewId,
    mode: 'overall_bbox',
    offsetMm: 2500 // 距建築外緣 2.5m (圖紙 25mm 處)
  });

  console.log('Result:', JSON.stringify(res.data, null, 2));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
