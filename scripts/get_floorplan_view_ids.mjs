import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'get-fp-ids';
  await client.connect();

  const allViewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const views = [];

  for (const v of allViewsRes.data?.Elements || []) {
    const info = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const name = info.data?.Name;
    if (['1FL', '2FL', '3FL', '4FL', '5FL', 'RFL', 'TRFL', 'GL'].includes(name)) {
      views.push({ id: v.ElementId, name: name, type: info.data?.Type });
      console.log(`FloorPlan: "${name}" -> ID: ${v.ElementId} (${info.data?.Type})`);
    }
  }

  // 查詢 16 條軸線的座標與排序
  // 檢查 A~H 與 1~8
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: views[0]?.id });
  console.log(`\nGrids Count: ${gridsRes.data?.Count}`);
  for (const g of gridsRes.data?.Elements || []) {
    console.log(`Grid: ID ${g.ElementId}, Name "${g.Name}"`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
