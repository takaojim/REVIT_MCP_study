import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  // 查詢 2FL 視圖中現存的各類尺寸線的 BoundingBox 與座標
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  console.log('=== 2FL 上所有現有尺寸線座標 ===');

  for (const d of dimsRes.data.Elements) {
    if (d.ElementId === 1981003 || d.ElementId === 1982553 || d.ElementId === 2040413 || d.ElementId === 1651167) {
      console.log(`Original Dim ID ${d.ElementId} (${d.Name})`);
    }
  }

  // 查詢 Grid A, G, 1, 7 的 BoundingBox
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  for (const g of gridsRes.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: g.ElementId });
    console.log(`Grid ID ${g.ElementId} (${g.Name}):`, info.data?.Parameters?.filter(p => p.Name.includes('線') || p.Name.includes('標高') || p.Name.includes('長度')));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
