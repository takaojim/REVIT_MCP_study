import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-grid-coords';
  await client.connect();

  console.log('=== 查詢當前專案 8 條軸線之精確座標與方位 ===\n');

  const gridIds = [192192, 432845, 432924, 611573, 192066, 432966, 432630, 596080];
  const gridInfos = [];

  for (const id of gridIds) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    const loc = await client.sendCommand('get_element_location', { elementId: id });
    gridInfos.push({
      id: id,
      name: info.data?.Name,
      type: info.data?.Type,
      location: loc.data
    });
    console.log(`- 軸線 [${info.data?.Name}] (ID: ${id}):`, JSON.stringify(loc.data));
  }

  // 查詢當前專案中已存在的標註型式
  const dims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: 695 });
  console.log(`\n2FL 現有標註數量: ${dims.data?.Count || 0}`);
  for (const d of dims.data?.Elements || []) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`- 標註 (ID: ${d.ElementId}): Name="${d.Name}", Type="${dInfo.data?.Type}"`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
