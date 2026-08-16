import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('=== 2FL Dimensions 詳細座標 ===');

  for (const d of dimsRes.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`\nID: ${d.ElementId}, Name: ${d.Name}`);
    // Check parameters like Origin / Location
    const params = info.data?.Parameters || [];
    const relevant = params.filter(p => p.Name.includes('標高') || p.Name.includes('線') || p.Name.includes('長度') || p.Name.includes('值'));
    console.log(relevant);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
