import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views' });
  const allViews = viewsRes.data.Elements;

  const targetFloorNames = ['1FL', '3FL', '4FL', '5FL', 'RFL', 'RF'];
  const matchedViews = [];

  for (const v of allViews) {
    for (const name of targetFloorNames) {
      if (v.Name === name || v.Name === `${name} 平面圖` || v.Name === `${name}平面圖` || v.Name === `樓層 ${name}`) {
        // inspect view info
        try {
          await client.sendCommand('set_active_view', { viewId: v.ElementId });
          const active = await client.sendCommand('get_active_view', {});
          if (active.data?.ViewType === 'FloorPlan') {
            matchedViews.push({
              targetName: name,
              viewId: v.ElementId,
              name: active.data.Name,
              viewType: active.data.ViewType,
              levelName: active.data.LevelName
            });
          }
        } catch (e) {}
      }
    }
  }

  console.log('=== 找到的平面視圖清單 ===');
  console.table(matchedViews);

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
