import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-dimensions';
  await client.connect();

  console.log('=== Step 1: Querying All DimensionTypes in Project (L-032) ===');
  const dimTypesRes = await client.sendCommand('query_elements', { category: 'DimensionTypes', maxCount: 1000 });
  const dimTypes = dimTypesRes.data?.Elements || [];
  console.log(`Found ${dimTypes.length} DimensionTypes:`);
  for (const dt of dimTypes) {
    console.log(`- ID: ${dt.ElementId}, Name: "${dt.Name}"`);
  }

  console.log('\n=== Step 2: Checking 4 Architectural Elevation Views ===');
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
