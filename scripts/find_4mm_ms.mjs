import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-exact-4mm-ms-' + Date.now();
  await client.connect();

  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test',
    x: 3000,
    y: 3550
  });
  const testId = r.data?.ElementId;

  // Let's test ranges around 501900~502100, 717000~718000, 456500~456700
  const ranges = [
    [501950, 502000],
    [717800, 718000],
    [456500, 456700],
    [501800, 501950]
  ];

  let targetTypeId = null;
  for (const [start, end] of ranges) {
    for (let id = start; id <= end; id++) {
      try {
        const res = await client.sendCommand('change_element_type', { elementId: testId, typeId: id });
        if (res.data?.ChangedCount === 1) {
          const info = await client.sendCommand('get_element_info', { elementId: testId });
          const name = info.data?.Type || info.data?.TypeName || info.data?.Name;
          console.log(`Valid Type: ID ${id} -> "${name}"`);
          if (name === '4 mm 微軟正黑體' || name.includes('4 mm 微軟正黑體') || name.includes('4mm 微軟正黑體')) {
            console.log(`\n🎉 FOUND IT! TypeId: ${id} is "${name}"`);
            targetTypeId = id;
            break;
          }
        }
      } catch(e) {}
    }
    if (targetTypeId) break;
  }

  await client.sendCommand('delete_element', { elementId: testId });
  console.log('Result targetTypeId:', targetTypeId);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
