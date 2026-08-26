import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-exact-4mm-id-' + Date.now();
  await client.connect();

  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test',
    x: 3000,
    y: 3550
  });
  const testId = r.data?.ElementId;

  // Let's test 694885, 456564, 456526, 456610
  const candidateIds = [694885, 456564, 456526, 456530, 456610, 501966];
  for (const tid of candidateIds) {
    try {
      await client.sendCommand('change_element_type', { elementId: testId, typeId: tid });
      const info = await client.sendCommand('get_element_info', { elementId: testId });
      console.log(`TypeId ${tid} -> "${info.data?.Type || info.data?.TypeName || info.data?.Name}"`);
    } catch(e) {}
  }

  await client.sendCommand('delete_element', { elementId: testId });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
