import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-datum';
  await client.connect();

  console.log('=== 1. Inspecting 4 Elevation Views Grids & Levels ===');

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  for (const e of elevs) {
    console.log(`\n========================================`);
    console.log(`>>> Checking Elevation: ${e.name} (View ID: ${e.id}) <<<`);
    console.log(`========================================`);

    // Let's test auto_dimension_elevation_grids (dry check or info)
    try {
      const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
        viewId: e.id
      });
      console.log('Grid Dimension Result:', JSON.stringify(gridDimRes.data, null, 2));
    } catch (err) {
      console.log('Grid Dimension query info:', err.message);
    }

    // Let's test auto_dimension_elevation_levels
    try {
      const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
        viewId: e.id
      });
      console.log('Level Dimension Result:', JSON.stringify(levelDimRes.data, null, 2));
    } catch (err) {
      console.log('Level Dimension query info:', err.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
