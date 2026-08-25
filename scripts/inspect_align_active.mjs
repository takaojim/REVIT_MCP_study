import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-error-' + Date.now();
  await client.connect();

  const activeRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', activeRes.data);

  // 嘗試在當前視圖測試 align_plan_grids
  const res = await client.sendCommand('align_plan_grids', {
    viewId: activeRes.data?.ElementId,
    stepCount: 5.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  console.log('align_plan_grids on active view:', res);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
