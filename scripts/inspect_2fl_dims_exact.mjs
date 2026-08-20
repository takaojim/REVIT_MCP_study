import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();
  
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: 695 });
  console.log('=== 2FL 平面圖所有尺寸標註圖元 (Count:', dimsRes.data.Elements.length, ') ===');
  
  for (const d of dimsRes.data.Elements) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    const pMap = {};
    if (info.data?.Parameters) {
      for (const p of info.data.Parameters) {
        pMap[p.Name] = p.Value;
      }
    }
    console.log({
      Id: d.ElementId,
      Name: d.Name,
      TotalLength: pMap['總長度'] || pMap['長度'] || pMap['值'],
      Count: pMap['數量'],
      Leader: pMap['引線'],
      BaselineOffset: pMap['基準線偏移']
    });
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
