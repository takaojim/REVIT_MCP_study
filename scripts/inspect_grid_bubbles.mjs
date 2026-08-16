import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  // 查詢各 Grid 的 Curve 端點與 BoundingBox
  const gridsRes = await client.sendCommand('get_all_grids', {});
  console.log('=== Grids 端點座標 ===');
  for (const g of gridsRes.data.Grids) {
    console.log(`Grid [${g.Name}] (${g.Direction}): Start=(${g.StartX}, ${g.StartY}), End=(${g.EndX}, ${g.EndY})`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
