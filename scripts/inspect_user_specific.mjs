import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-elements-' + Date.now();
  await client.connect();

  const ids = [717855, 717864, 717875, 717904, 717905, 717914, 717915, 717924, 717925, 717678];

  for (const id of ids) {
    const res = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`\n--- Element ${id} ---`);
    console.log('Type:', res.data?.Type || res.data?.TypeName);
    for (const p of res.data?.Parameters || []) {
      if (['文字', 'Text', '水平對齊', 'Horizontal Alignment', '對齊', 'Alignment', 'X', 'Y'].includes(p.Name) || p.Name.includes('對齊') || p.Name.includes('位移')) {
        console.log(`  ${p.Name}: ${p.Value}`);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
