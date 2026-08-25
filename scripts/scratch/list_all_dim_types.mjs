import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'list-dim-types';
  await client.connect();

  const typesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = typesRes.data?.DimensionTypes || [];

  console.log(`=== 專案中共有 ${dimTypes.length} 個標註型式 ===`);
  for (const t of dimTypes) {
    console.log(JSON.stringify(t));
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
