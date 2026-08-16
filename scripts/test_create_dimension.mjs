import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158;

  // Let's test create_dimension
  const res = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 0,
    startY: 0,
    endX: 3000,
    endY: 0,
    offset: 500
  });

  console.log('create_dimension result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
