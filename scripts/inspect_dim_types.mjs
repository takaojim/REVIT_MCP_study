import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-types';
  await client.connect();

  const type1 = await client.sendCommand('get_element_info', { elementId: 2240793 });
  console.log('=== DimensionType 上右 (2240793) ===');
  for (const p of type1.data?.Parameters || []) {
    console.log(`  ${p.Name}: ${p.Value}`);
  }

  const type2 = await client.sendCommand('get_element_info', { elementId: 2240801 });
  console.log('\n=== DimensionType 下右 (2240801) ===');
  for (const p of type2.data?.Parameters || []) {
    console.log(`  ${p.Name}: ${p.Value}`);
  }

  // 查詢專案中所有的 DimensionTypes
  const allTypes = await client.sendCommand('query_elements', { category: 'DimensionTypes' });
  console.log('\n=== 專案中所有標註型式 ===');
  for (const t of allTypes.data?.Elements || []) {
    console.log(`  ID: ${t.ElementId}, Name: ${t.Name}`);
  }

  await client.disconnect();
}

main().catch(console.error);
