import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-fire-views-detail';
  await client.connect();

  for (const id of [395082, 395092, 637412]) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`\n=== View ID: ${id}, Name: "${info.data?.Name}" ===`);
    console.log(`  Type: ${info.data?.Type}`);
    for (const p of info.data?.Parameters || []) {
      if (['族群', '類型', '視圖名稱', '視圖比例', '關聯的樓層', '圖紙名稱', '圖紙號碼'].includes(p.Name)) {
        console.log(`  ${p.Name}: ${p.Value}`);
      }
    }
  }

  await client.disconnect();
}

main().catch(console.error);
