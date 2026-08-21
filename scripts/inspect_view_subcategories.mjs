import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-view-subcats';
  await client.connect();

  const ids = [395082, 395092, 637412, 395030, 395040, 395051, 395061];
  for (const id of ids) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`\n=== View ID: ${id}, Name: "${info.data?.Name}" ===`);
    for (const p of info.data?.Parameters || []) {
      if (p.Value && p.Value !== '-1' && p.Value !== '<無>') {
        console.log(`  ${p.Name}: ${p.Value}`);
      }
    }
  }

  await client.disconnect();
}

main().catch(console.error);
