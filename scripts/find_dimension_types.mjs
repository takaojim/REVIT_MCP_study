import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. Query all Dimension Types in the document
  const typesRes = await client.sendCommand('list_dimension_types', {});
  console.log('=== Dimension Types in Project ===');
  console.log(JSON.stringify(typesRes.data, null, 2));

  // 2. Query all existing dimensions on 2FL to see which ones have 柱心
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('\n=== Existing Dimensions on 2FL ===');
  for (const d of dimsRes.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`ID: ${d.ElementId}, Name: ${d.Name}, TypeId: ${info.data?.TypeId}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
