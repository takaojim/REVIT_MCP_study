import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const dimsRes = await client.sendCommand('query_elements', {
    category: 'Dimensions',
    maxCount: 5000,
    returnFields: ['名稱', '值']
  });

  const dims = dimsRes.data?.Elements || [];
  const toDelete = dims.filter(d => d.ElementId >= 2245090);
  console.log(`Found ${toDelete.length} recently created internal dimensions to delete.`);

  for (const d of toDelete) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {}
  }

  const curvesRes = await client.sendCommand('query_elements', {
    category: 'Lines',
    maxCount: 5000,
    returnFields: ['名稱']
  });
  const curves = curvesRes.data?.Elements || [];
  const curvesToDelete = curves.filter(c => c.ElementId >= 2245090);
  console.log(`Found ${curvesToDelete.length} helper lines to delete.`);

  for (const c of curvesToDelete) {
    try {
      await client.sendCommand('delete_element', { elementId: c.ElementId });
    } catch (e) {}
  }

  console.log('✅ 內部標註已全數徹底清除！');

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
