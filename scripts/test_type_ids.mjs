import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-type-ids-' + Date.now();
  await client.connect();

  // Create a note and test types
  const r = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test',
    x: 3000,
    y: 3550
  });

  const testId = r.data?.ElementId;

  // Let's test candidate type IDs
  // We know 501966 is 3mm, 456564 is 4.5mm
  // Let's test a range of IDs or query parameters of note 717855 if it exists
  const candidates = [501966, 456564, 501965, 501967, 501968, 501969, 501970, 456563, 456565, 694885];
  for (const tid of candidates) {
    try {
      await client.sendCommand('change_element_type', { elementId: testId, typeId: tid });
      const info = await client.sendCommand('get_element_info', { elementId: testId });
      console.log(`TypeId ${tid} -> TypeName: "${info.data?.Type || info.data?.TypeName}"`);
    } catch(e) {}
  }

  await client.sendCommand('delete_element', { elementId: testId });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
