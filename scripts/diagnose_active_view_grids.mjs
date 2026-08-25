import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'diagnose-grid-alignment-' + Date.now();
  await client.connect();

  // 1. 取得當前作用中視圖
  const activeViewRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', activeViewRes.data);

  const viewId = activeViewRes.data?.ViewId || 268781;

  // 2. 查詢該視圖中的所有軸線當前曲線與端點
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId, maxCount: 100 });
  console.log(`\n視圖中的軸線數量: ${gridsRes.data?.Elements?.length}`);

  // 3. 測試 align_plan_grids
  console.log('\n--- 執行 align_plan_grids ---');
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    referenceViewId: 1334374,
    stepCount: 5.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  console.log('align_plan_grids result:', alignRes);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
