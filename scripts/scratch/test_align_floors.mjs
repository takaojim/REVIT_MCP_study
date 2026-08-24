import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-align-all-elevations';
  await client.connect();

  console.log('=== Checking all exterior walls and roof elements ===');
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', maxCount: 100 });
  const floorsRes = await client.sendCommand('query_elements', { category: 'Floors', maxCount: 100 });
  const roofsRes = await client.sendCommand('query_elements', { category: 'Roofs', maxCount: 100 });

  console.log('Roofs:', roofsRes.data?.Elements?.length);
  const elements = [
    ...(wallsRes.data?.Elements || []),
    ...(floorsRes.data?.Elements || []),
    ...(roofsRes.data?.Elements || [])
  ];

  // Let's test on South (98984) and East (8176)
  // We want to find an element that spans the building or use multiple elements / padding
  for (const f of floorsRes.data?.Elements || []) {
    const res = await client.sendCommand('align_view_cropbox_to_element', {
      viewId: 98984, // South
      elementId: f.ElementId,
      padding_mm: 8000
    });
    console.log(`South with Floor ${f.ElementId} (${f.Name}):`, JSON.stringify(res.data?.NewCropBox_mm));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
