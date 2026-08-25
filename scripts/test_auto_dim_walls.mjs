import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-auto-dim-walls';
  await client.connect();

  const viewId = 695; // 2FL

  console.log('=== 測試呼叫 auto_dimension_walls (overall_bbox) ===');
  const bboxRes = await client.sendCommand('auto_dimension_walls', {
    viewId: viewId,
    mode: 'overall_bbox',
    offsetMm: 3250
  });
  console.log('BBox Result:', JSON.stringify(bboxRes.data, null, 2));

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
