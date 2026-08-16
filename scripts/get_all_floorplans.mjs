import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const floorPlans = [];

  for (const v of viewsRes.data.Elements) {
    try {
      await client.sendCommand('set_active_view', { viewId: v.ElementId });
      const active = await client.sendCommand('get_active_view', {});
      if (active.data?.ViewType === 'FloorPlan') {
        floorPlans.push({
          viewId: v.ElementId,
          name: active.data.Name,
          levelName: active.data.LevelName
        });
      }
    } catch (e) {}
  }

  console.log('=== All FloorPlan Views in Project ===');
  console.table(floorPlans);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
