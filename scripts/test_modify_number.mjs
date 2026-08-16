import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const testId = 1644423;
  const res = await client.sendCommand('modify_element_parameter', {
    elementId: testId,
    parameterName: '編號',
    value: 'F301'
  });

  console.log('Modify result with 編號:', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
