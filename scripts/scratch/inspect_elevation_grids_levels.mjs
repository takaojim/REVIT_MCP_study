import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-grids';
  await client.connect();

  console.log('=== Grids Query ===');
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', maxCount: 100 });
  for (const g of gridsRes.data?.Elements || []) {
    console.log(`Grid ID: ${g.ElementId} | Name: ${g.Name}`);
  }

  console.log('\n=== Levels Query ===');
  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels', maxCount: 100 });
  for (const l of levelsRes.data?.Elements || []) {
    const lInfo = await client.sendCommand('get_element_info', { elementId: l.ElementId });
    const elev = lInfo.data?.Parameters?.find(p => p.Name === '立面' || p.Name === 'Elevation' || p.Name === '高度')?.Value;
    console.log(`Level ID: ${l.ElementId} | Name: ${l.Name} | Elev: ${elev}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
