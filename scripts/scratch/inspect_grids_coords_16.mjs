import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-grids-coords-16';
  await client.connect();

  console.log('=== 檢測 16 條軸線方位與順序 ===\n');

  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: 695, // 2FL
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  console.log('Align result on 2FL:', alignRes.data);

  // 查詢當前專案所有 16 條軸線
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: 695 });
  console.log(`\n軸線總數: ${gridsRes.data?.Count}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
