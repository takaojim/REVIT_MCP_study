import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-two-red-boxes';
  await client.connect();

  const viewId = 695; // 2FL

  // 收集 15cm 及以上主牆
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  const mainWalls = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      if (info.data.Thickness < 140) continue;
      if (info.data.Length < 300) continue;
      if (info.data.Name?.includes('粉刷')) continue;

      const sx = info.data.StartX;
      const sy = info.data.StartY;
      const ex = info.data.EndX;
      const ey = info.data.EndY;
      const isVert = Math.abs(ex - sx) < 40;
      const isHoriz = Math.abs(ey - sy) < 40;

      mainWalls.push({
        id: w.ElementId,
        name: info.data.Name,
        wallType: info.data.WallType,
        thickness: info.data.Thickness,
        length: info.data.Length,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        minX: Math.min(sx, ex),
        maxX: Math.max(sx, ex),
        minY: Math.min(sy, ey),
        maxY: Math.max(sy, ey),
        isVert,
        isHoriz,
        centerX: (sx + ex) / 2,
        centerY: (sy + ey) / 2
      });
    }
  }

  console.log(`=== 解析兩個紅框區域的 15cm 主牆 ===\n`);

  // 1. 水平紅框：中庭北側向南外牆 (X: 19,000 ~ 48,000, Y: 11,000 ~ 18,000)
  console.log('--- 1. 水平紅框 (東北翼向南外牆區) ---');
  const northCourtyardHoriz = mainWalls.filter(w => w.isHoriz && w.minX >= 19000 && w.centerY >= 10000 && w.centerY <= 18500);
  for (const w of northCourtyardHoriz) {
    console.log(`  水平外牆 ID: ${w.id} | Name: "${w.name}" | Y=${w.centerY.toFixed(1)} | X=[${w.minX.toFixed(1)}, ${w.maxX.toFixed(1)}] | Len=${w.length.toFixed(1)}`);
  }

  // 穿透該區域的垂直 15cm 主牆 (X: 19,000 ~ 48,000)
  const northCourtyardVert = mainWalls.filter(w => w.isVert && w.centerX >= 19000 && w.centerY >= 10000 && w.centerY <= 33000);
  console.log(`\n  垂直 15cm 主牆 (共 ${northCourtyardVert.length} 道):`);
  northCourtyardVert.sort((a, b) => a.centerX - b.centerX);
  for (const w of northCourtyardVert) {
    console.log(`    * 垂直牆 ID: ${w.id} | X=${w.centerX.toFixed(1)} | Y=[${w.minY.toFixed(1)}, ${w.maxY.toFixed(1)}] | Len=${w.length.toFixed(1)}`);
  }

  // 2. 垂直紅框：西南居室翼向東外牆 (X: 19,283.3, Y: -19,836.3 ~ 4,500)
  console.log('\n--- 2. 垂直紅框 (西南居室翼向東外牆區) ---');
  const westWingEastVert = mainWalls.filter(w => w.isVert && Math.abs(w.centerX - 19283.3) < 100 && w.minY <= 4500);
  for (const w of westWingEastVert) {
    console.log(`  垂直外牆 ID: ${w.id} | Name: "${w.name}" | X=${w.centerX.toFixed(1)} | Y=[${w.minY.toFixed(1)}, ${w.maxY.toFixed(1)}] | Len=${w.length.toFixed(1)}`);
  }

  // 穿透該西南居室翼的水平 15cm 主牆 (X: 0 ~ 20,000, Y: -20,000 ~ 4,500)
  const westWingHoriz = mainWalls.filter(w => w.isHoriz && w.minX <= 20000 && w.maxX >= 10000 && w.centerY <= 5000 && w.centerY >= -20500);
  console.log(`\n  水平 15cm 主牆 (共 ${westWingHoriz.length} 道):`);
  westWingHoriz.sort((a, b) => a.centerY - b.centerY);
  for (const w of westWingHoriz) {
    console.log(`    * 水平牆 ID: ${w.id} | Y=${w.centerY.toFixed(1)} | X=[${w.minX.toFixed(1)}, ${w.maxX.toFixed(1)}] | Len=${w.length.toFixed(1)}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
