import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-refs';
  await client.connect();

  const viewId = 695; // 2FL

  // 查詢使用者剛才建立的 3 道示範牆心標註
  const demoDimIds = [2250275, 2250367, 2250683];

  for (const id of demoDimIds) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`\n=== 標註 ID ${id} ===`);
    console.log(`- 名稱: "${info.data?.Name}" | 類型: "${info.data?.Type}"`);
    console.log(`- 參數:`, JSON.stringify(info.data?.Parameters?.filter(p => p.Value && p.Value !== '0'), null, 2));
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
