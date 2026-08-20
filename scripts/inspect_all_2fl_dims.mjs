import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: 695 });
  console.log('=== 2FL Dimensions Count:', dimsRes.data.Elements.length, '===');

  for (const d of dimsRes.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`\n========================================`);
    console.log(`Dimension ID: ${d.ElementId} | Name: ${d.Name}`);
    console.log(`========================================`);
    console.log(JSON.stringify(info.data, null, 2));
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
