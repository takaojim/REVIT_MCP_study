import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-grid-dim-north';
  await client.connect();

  console.log('=== Testing create_dimension on 北向立面 (8157) ===');

  // North view: X is along X axis, Z is up (Z=23500mm), Y is constant (e.g. Y=0)
  const res = await client.sendCommand('create_dimension', {
    viewId: 8157,
    gridIds: [192066, 432966, 432630, 596080], // 1, 2, 3, 4
    startX: 1201.8,
    startY: 0,
    startZ: 23500,
    endX: 15601.8,
    endY: 0,
    endZ: 23500
  });

  console.log('Grid Dim Result:', JSON.stringify(res.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
