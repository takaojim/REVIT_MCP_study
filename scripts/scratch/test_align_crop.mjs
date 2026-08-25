import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-align-crop';
  await client.connect();

  // Find a roof or top floor element
  const floors = await client.sendCommand('query_elements', { category: 'Floors', maxCount: 10 });
  console.log('Floors:', floors.data?.Elements?.map(f => ({ Id: f.ElementId, Name: f.Name })));

  const walls = await client.sendCommand('query_elements', { category: 'Walls', maxCount: 10 });
  console.log('Walls:', walls.data?.Elements?.map(w => ({ Id: w.ElementId, Name: w.Name })));

  // Test align_view_cropbox_to_element on South (98984) with a wall / floor
  if (walls.data?.Elements?.length > 0) {
    const wallId = walls.data.Elements[0].ElementId;
    console.log(`\nTesting align_view_cropbox_to_element on South (98984) with Wall ${wallId} and padding 5000mm:`);
    const res = await client.sendCommand('align_view_cropbox_to_element', {
      viewId: 98984,
      elementId: wallId,
      padding_mm: 5000
    });
    console.log('Result:', JSON.stringify(res.data, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
