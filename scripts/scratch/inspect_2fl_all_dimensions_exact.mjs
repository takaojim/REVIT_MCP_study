import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-2fl-dims-exact';
  await client.connect();

  const viewId = 695; // 2FL

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 100 });
  const dims = dimsRes.data?.Elements || [];

  console.log(`=== 2FL 上共有 ${dims.length} 個尺寸標註 ===\n`);

  for (const d of dims) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`----------------------------------------------------------------`);
    console.log(`標註 ID: ${d.ElementId} | Name: "${d.Name}" | Type: "${info.data?.Type}"`);
    for (const p of info.data?.Parameters || []) {
      if (['長度', '尺寸', '類型', '族群與類型', '視圖', '標註文字', '長度單位', '數量'].includes(p.Name) || p.Name.includes('標註') || p.Name.includes('線')) {
        console.log(`  ${p.Name}: ${p.Value}`);
      }
    }
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
