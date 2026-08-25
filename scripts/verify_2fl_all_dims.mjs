import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'verify-2fl-all-dims';
  await client.connect();

  const viewId = 695; // 2FL

  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 100 });
  const allDims = dimsRes.data?.Elements || [];

  console.log(`\n================================================================`);
  console.log(`=== 2FL 視圖目前所有尺寸標註檢核報告 (總計 ${allDims.length} 個標註) ===`);
  console.log(`================================================================\n`);

  for (const d of allDims) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    const segmentsParam = info.data?.Parameters?.find(p => p.Name === '數量')?.Value || '1';
    const totalValParam = info.data?.Parameters?.find(p => p.Name === '總長度' || p.Name === '長度' || p.Name === '值')?.Value;
    console.log(`- 標註 ID: ${d.ElementId.toString().padEnd(8)} | 類型: "${info.data?.Type?.padEnd(28)}" | 數量: ${segmentsParam.toString().padEnd(3)} | 長度: ${totalValParam || 'N/A'}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
