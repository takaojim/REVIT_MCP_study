import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-all-text-types-' + Date.now();
  await client.connect();

  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test',
    x: 3000,
    y: 3550
  });
  const testId = r.data?.ElementId;

  // Let's test ranges around 450000~470000 and 690000~710000
  const ranges = [
    [456500, 456650],
    [463300, 463500],
    [501950, 502000],
    [694800, 695000],
    [698700, 699300]
  ];

  const types = [];
  for (const [s, e] of ranges) {
    for (let id = s; id <= e; id++) {
      try {
        const res = await client.sendCommand('change_element_type', { elementId: testId, typeId: id });
        if (res.data?.ChangedCount === 1) {
          const info = await client.sendCommand('get_element_info', { elementId: testId });
          const name = info.data?.Type || info.data?.TypeName || info.data?.Name;
          types.push({ id, name });
        }
      } catch(e) {}
    }
  }

  console.log('\n--- All Found TextNoteTypes ---');
  for (const t of types) {
    console.log(`ID: ${t.id} -> "${t.name}"`);
  }

  await client.sendCommand('delete_element', { elementId: testId });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
