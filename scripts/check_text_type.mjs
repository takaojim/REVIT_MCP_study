import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-type-id-' + Date.now();
  await client.connect();

  // Let's create a temporary text note and see what default type it has, or test change_element_type
  const testRes = await client.sendCommand('create_text_note', {
    viewId: 711441,
    text: 'Test 4mm',
    x: 3000,
    y: 3550
  });

  console.log('Created test note:', testRes.data);
  const testId = testRes.data?.ElementId;

  // Let's test different type IDs around 501966 or search for 4mm
  // We can query element parameters of testId
  const info = await client.sendCommand('get_element_info', { elementId: testId });
  console.log('Test note info:', info.data);

  // Let's delete testId
  await client.sendCommand('delete_element', { elementId: testId });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
