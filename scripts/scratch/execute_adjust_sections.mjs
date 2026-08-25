import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-adjust-sections';
  await client.connect();

  console.log('=== Executing adjust_section_datums on 4 Architectural Section Views ===');
  const sectionIds = [590271, 624109, 624490, 693638]; // 剖面 1, 2, 3, 4

  const res = await client.sendCommand('adjust_section_datums', {
    viewIds: sectionIds
  });

  console.log('Result:', JSON.stringify(res.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
