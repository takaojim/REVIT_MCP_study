import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-dimensions-2';
  await client.connect();

  console.log('=== Querying Dimensions in Project ===');
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', maxCount: 1000 });
  const dims = dimsRes.data?.Elements || [];
  console.log(`Found ${dims.length} Dimensions:`);
  for (const d of dims.slice(0, 10)) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`- Dim ID: ${d.ElementId}, Type: "${dInfo.data?.Type}"`);
  }

  console.log('\n=== Checking 4 Architectural Elevation Views ===');
  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  for (const e of elevs) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: e.id });
    console.log(`\nView ${e.id} ("${e.name}"): Scale = 1:${vInfo.data?.Scale || 100}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
