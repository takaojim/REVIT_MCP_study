import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-4mm-black-' + Date.now();
  await client.connect();

  // Let's create a test note
  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test 4mm',
    x: 3000,
    y: 3550
  });
  const testId = r.data?.ElementId;

  // Let's search around common ranges
  // In the document, types can be around 456560~456600, 501900~502000, 694800~695000, 717800~717900
  const ranges = [
    [456500, 456600],
    [501900, 502000],
    [694800, 694900],
    [717800, 718000]
  ];

  const found = [];
  for (const [start, end] of ranges) {
    for (let id = start; id <= end; id++) {
      try {
        const res = await client.sendCommand('change_element_type', { elementId: testId, typeId: id });
        if (res.data?.ChangedCount === 1) {
          const info = await client.sendCommand('get_element_info', { elementId: testId });
          const name = info.data?.Type || info.data?.TypeName || info.data?.Name;
          console.log(`Found Type: ID ${id} -> "${name}"`);
          found.push({ id, name });
        }
      } catch(e) {}
    }
  }

  console.log('\nAll Found Types:', found);

  await client.sendCommand('delete_element', { elementId: testId });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
