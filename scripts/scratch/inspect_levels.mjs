import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-levels';
  await client.connect();

  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels', maxCount: 100 });
  console.log('Levels:', JSON.stringify(levelsRes.data, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
