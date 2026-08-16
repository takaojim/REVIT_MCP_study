import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158;

  // 1. Query structural columns on 3FL with parameters
  const cols = await client.sendCommand('query_elements', { category: '結構柱' });
  console.log('--- Structural Columns ---');
  for (const c of cols.data.Elements.slice(0, 15)) {
    const params = await client.sendCommand('get_element_parameters', { elementId: c.ElementId });
    console.log(`Col ${c.ElementId} (${c.Name}):`, params.data ? Object.keys(params.data).slice(0, 10) : 'none');
  }

  // 2. Query Grids
  const grids = await client.sendCommand('query_elements', { category: 'Grids' });
  console.log('--- Grids ---');
  for (const g of grids.data.Elements) {
    const geom = await client.sendCommand('get_element_geometry', { elementId: g.ElementId });
    console.log(`Grid ${g.Name} (${g.ElementId}):`, JSON.stringify(geom.data));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
