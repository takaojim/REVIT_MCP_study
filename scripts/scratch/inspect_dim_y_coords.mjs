import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-y-coords';
  await client.connect();

  const viewId = 695; // 2FL

  // 取得 2FL 上所有標註之詳細線段座標
  // 透過 C# get_element_info 或專屬方式解析其曲線與座標
  const dimIds = [2248564, 2248565, 2250275, 2250367, 2250683];

  console.log('=== 檢驗 2FL 上方 5 道標註之 Y 座標階梯間距 ===\n');

  for (const id of dimIds) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`ID ${id}: Type="${info.data?.Type}" | Name="${info.data?.Name}"`);
  }

  // 查詢視圖上的線條以確認使用者畫的青色間距輔助線 (右側那幾條青色線)
  const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 200 });
  console.log(`\nLines Count: ${linesRes.data?.Count}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
