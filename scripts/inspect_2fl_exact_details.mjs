import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();

  const viewId = 695; // 2FL

  const script = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('=== 2FL 尺寸標註數量:', script.data.Elements.length, '===');

  for (const d of script.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`\n----------------------------------------`);
    console.log(`ID: ${d.ElementId} | Name: ${d.Name}`);
    console.log(`Parameters:`, info.data.Parameters);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
