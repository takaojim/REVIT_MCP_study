import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typesRes = await client.sendCommand('list_dimension_types', {});
  const allTypes = typesRes.data?.DimensionTypes || [];

  const tabcTypes = allTypes.filter(t => t.DimensionTypeName.includes('柱心') || t.DimensionTypeName.includes('TABC'));
  console.log('=== 柱心 / TABC 相關 Dimension Types ===');
  console.table(tabcTypes);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
