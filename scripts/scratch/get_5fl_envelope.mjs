import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'get-5fl-envelope';
  await client.connect();

  console.log('=== 查詢 5FL 視圖實體外框 ===\n');

  // 切換至 5FL (1334374)
  await client.sendCommand('set_active_view', { viewId: 1334374 });

  const res = await client.sendCommand('align_plan_grids', {
    viewId: 1334374,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  console.log('5FL align_plan_grids 回傳:');
  console.log(JSON.stringify(res.data, null, 2));

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
