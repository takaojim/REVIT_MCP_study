import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-demo-details';
  await client.connect();

  const viewId = 695; // 2FL

  console.log('=== 深入解析 2FL 上所有尺寸標註之幾何放樣座標與型式 ===\n');

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 100 });
  const dims = dimsRes.data?.Elements || [];

  for (const d of dims) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`- 標註 ID: ${d.ElementId} | Name: "${d.Name}" | Type: "${dInfo.data?.Type}"`);
    for (const p of dInfo.data?.Parameters || []) {
      if (['長度', '尺寸', '類型', '族群與類型', '視圖', '標註字體大小', '標註文字'].includes(p.Name) || p.Name.includes('線') || p.Name.includes('標註')) {
        console.log(`    ${p.Name}: ${p.Value}`);
      }
    }
  }

  // 查詢視圖上的線條座標
  console.log('\n=== 查詢 2FL 上的示範線條（紅線、綠線、紫線、青色階梯標註線）===');
  const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 100 });
  for (const l of linesRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: l.ElementId });
    console.log(`- 線 ID: ${l.ElementId}, Name: "${l.Name}"`);
    for (const p of info.data?.Parameters || []) {
      if (['長度', '線條樣式', 'LineStyle', '圖形'].includes(p.Name) || p.Name.includes('長度') || p.Name.includes('座標')) {
        console.log(`    ${p.Name}: ${p.Value}`);
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
