import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-elevation-dims';
  await client.connect();

  console.log('=== Testing Dimension Creation on Elevation Views ===');

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  for (const e of elevs) {
    console.log(`\n--- Testing Elevation: ${e.name} (${e.id}) ---`);
    try {
      const gridRes = await client.sendCommand('auto_dimension_elevation_grids', {
        viewId: e.id,
        typeId: 572166 // DIMing
      });
      console.log(`Grid Dims on ${e.name}:`, JSON.stringify(gridRes.data, null, 2));
    } catch (err) {
      console.log(`Grid Dims on ${e.name} failed:`, err.message);
    }

    try {
      const levelRes = await client.sendCommand('auto_dimension_elevation_levels', {
        viewId: e.id,
        typeId: 572166 // DIMing
      });
      console.log(`Level Dims on ${e.name}:`, JSON.stringify(levelRes.data, null, 2));
    } catch (err) {
      console.log(`Level Dims on ${e.name} failed:`, err.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
