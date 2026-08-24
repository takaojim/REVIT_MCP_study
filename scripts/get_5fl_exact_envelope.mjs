import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'compute-5fl-envelope';
  await client.connect();

  console.log('=== 計算 5FL (ID: 1334374) 之實體外框極值 ===\n');

  const align5fl = await client.sendCommand('align_plan_grids', {
    viewId: 1334374,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  console.log('5FL 實體外框結果:', JSON.stringify(align5fl.data.PhysicalEnvelopeMm, null, 2));
  console.log('5FL 9間距齊頭坐標:', JSON.stringify(align5fl.data.AlignmentBoundsMm, null, 2));

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
