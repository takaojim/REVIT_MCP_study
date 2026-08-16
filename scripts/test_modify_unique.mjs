import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const testId = 1644423;
  // Use a completely unique string to test
  const res = await client.sendCommand('modify_element_parameter', {
    elementId: testId,
    parameterName: '編號',
    value: 'TMP_UNIQUE_999'
  });

  console.log('Modify result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
