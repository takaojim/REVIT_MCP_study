import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'list-linear-dims';
  await client.connect();

  const typesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = typesRes.data?.DimensionTypes || [];

  console.log(`=== 線性尺寸標註型式清單 ===`);
  const linear = dimTypes.filter(t => t.FamilyName === '線性尺寸標註型式');
  for (const t of linear) {
    console.log(`ID: ${t.DimensionTypeId.toString().padEnd(8)} | Name: "${t.DimensionTypeName}"`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
