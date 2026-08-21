import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 查詢 2FL 樓層資訊與層高 ===');
  const activeView = await client.sendCommand('get_active_view', {});
  console.log('Active View:', activeView.data);

  // 查詢樓層列表
  const levelsRes = await client.sendCommand('query_elements', {
    category: 'Levels',
    returnFields: ['名稱', '高程']
  });
  console.log('Levels in project:', levelsRes.data?.Elements);

  // 計算 2FL 到 3FL 的層高
  const levels = levelsRes.data?.Elements || [];
  const l2 = levels.find(l => l.Name === '2FL' || l['名稱'] === '2FL');
  const l3 = levels.find(l => l.Name === '3FL' || l['名稱'] === '3FL');
  let heightMm = 3600; // 預設 3.6m
  if (l2 && l3) {
    const elev2 = parseFloat(l2['高程'] || l2.Elevation || 0);
    const elev3 = parseFloat(l3['高程'] || l3.Elevation || 0);
    if (elev3 > elev2) {
      heightMm = Math.round((elev3 - elev2) * 1000);
      console.log(`2FL 到 3FL 層高: ${heightMm} mm (${heightMm / 1000} m)`);
    }
  }

  console.log('\n=== 2. 執行 2FL 外牆施工架周長與面積計算 ===');
  const scaffoldRes = await client.sendCommand('calculate_exterior_wall_scaffold_perimeter', {
    levelName: '2FL',
    activeViewOnly: false,
    includeCurtainWalls: true,
    selectResult: true,
    scaffoldHeightMm: heightMm
  });

  console.log('Scaffold Takeoff Result:', JSON.stringify(scaffoldRes.data, null, 2));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
