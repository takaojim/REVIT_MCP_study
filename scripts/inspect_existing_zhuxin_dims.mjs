import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of dimsRes.data.Elements) {
    if (d.Name.includes('柱心')) {
      console.log(`ID: ${d.ElementId}, Name: ${d.Name}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
