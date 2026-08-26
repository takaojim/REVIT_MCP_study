import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-exact-4mm-' + Date.now();
  await client.connect();

  // Let's create a test note
  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test',
    x: 3000,
    y: 3550
  });
  const testId = r.data?.ElementId;

  // Let's test a wider range of candidate TypeIDs
  // Let's test around 456560, 463330, 501960, 694800~695000, 698700~699200
  const candidateRanges = [
    [456560, 456570],
    [463330, 463360],
    [501960, 501970],
    [694830, 694900],
    [698700, 698750],
    [699160, 699200]
  ];

  const results = [];

  for (const [start, end] of candidateRanges) {
    for (let id = start; id <= end; id++) {
      try {
        const changeRes = await client.sendCommand('change_element_type', { elementId: testId, typeId: id });
        if (changeRes.data?.ChangedCount === 1) {
          const info = await client.sendCommand('get_element_info', { elementId: testId });
          const name = info.data?.Type || info.data?.TypeName || info.data?.Name;
          results.push({ id, name });
          console.log(`VALID Type ID ${id} -> "${name}"`);
        }
      } catch(e) {}
    }
  }

  console.log('\nAll Valid Types:', results);

  await client.sendCommand('delete_element', { elementId: testId });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
