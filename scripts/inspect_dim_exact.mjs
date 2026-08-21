import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-exact';
  await client.connect();

  console.log('=== 檢查 Dimension 2246297 與北立面視圖空間幾何 ===\n');

  const dimInfo = await client.sendCommand('get_element_info', { elementId: 2246297 });
  console.log('Dimension 2246297 資訊:', JSON.stringify(dimInfo.data, null, 2));

  // 取得北立面 (View ID: 8157) 幾何參數
  const viewInfo = await client.sendCommand('get_element_info', { elementId: 8157 });
  console.log('\n北立面詳細參數:');
  for (const p of viewInfo.data?.Parameters || []) {
    console.log(`  ${p.Name} = ${p.Value} (${p.Type})`);
  }

  await client.disconnect();
}

main().catch(console.error);
