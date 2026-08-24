import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-2fl-all-walls-geometry';
  await client.connect();

  const viewId = 695; // 2FL

  console.log('=== 萃取 2FL 上所有直線牆體之中心線幾何與空間分佈 ===\n');

  // 查詢 2FL 上所有牆體
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  console.log(`2FL 上共有 ${allWalls.length} 道牆體。`);

  // 透過 get_element_info 分析外牆 (Exterior) 與內牆 (Interior)
  // 找出四邊極值外牆
  const exteriorWalls = [];
  const interiorWalls = [];

  for (const w of allWalls) {
    const info = await client.sendCommand('get_element_info', { elementId: w.ElementId });
    const fn = info.data?.Parameters?.find(p => p.Name === '功能' || p.Name === 'Function')?.Value;
    const len = info.data?.Parameters?.find(p => p.Name === '長度' || p.Name === 'Length')?.Value;
    const wallType = info.data?.Type || '';

    // 排除面積計算用牆或矮牆
    if (wallType.includes('虛擬') || wallType.includes('面積')) continue;

    if (fn === '外部' || fn === 'Exterior' || wallType.includes('外牆') || wallType.includes('RC20') || wallType.includes('RC25') || wallType.includes('帷幕')) {
      exteriorWalls.push({ id: w.ElementId, name: w.Name, type: wallType, length: len });
    } else {
      interiorWalls.push({ id: w.ElementId, name: w.Name, type: wallType, length: len });
    }
  }

  console.log(`- 外牆數量: ${exteriorWalls.length}`);
  console.log(`- 內牆數量: ${interiorWalls.length}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
