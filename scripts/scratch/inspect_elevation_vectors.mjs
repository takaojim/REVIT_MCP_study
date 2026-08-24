import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-vectors';
  await client.connect();

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  for (const e of elevs) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: e.id });
    console.log(`\nView ${e.name} (${e.id}):`);
    // Check parameters
    const originP = vInfo.data?.Parameters?.find(p => p.Name === '原點' || p.Name === 'Origin');
    console.log('Parameters count:', vInfo.data?.Parameters?.length);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
