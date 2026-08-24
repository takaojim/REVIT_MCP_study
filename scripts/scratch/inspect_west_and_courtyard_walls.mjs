import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-west-and-courtyard';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 取得 2FL 實體外框
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const env = alignRes.data.PhysicalEnvelopeMm;
  console.log(`全區實體外框: X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm\n`);

  // 2. 收集所有 15cm 及以上主牆
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

  console.log(`收集到 ${mainWalls.length} 道 15cm 主牆。\n`);

  // -------------------------------------------------------------
  // 分析西側 (West) 全長水平牆 (Y 範圍需涵蓋從 -20,236 到 +32,514)
  // -------------------------------------------------------------
  console.log('=== 分析西側 (West) 所有水平主牆 (檢視為何左上/左下紅圈漏掉) ===');
  const horizWalls = mainWalls.filter(w => w.isHoriz);
  horizWalls.sort((a, b) => a.centerY - b.centerY);

  for (const w of horizWalls) {
    // 檢查與西側相關的牆 (minX < 20,000)
    if (w.minX < 20000) {
      console.log(`  - ID: ${w.id.toString().padEnd(8)} | Name: "${w.name.padEnd(16)}" | Y=${w.centerY.toFixed(1).padStart(8)} mm | X=[${w.minX.toFixed(1).padStart(7)}, ${w.maxX.toFixed(1).padStart(7)}] mm | Len=${w.length.toFixed(1)}`);
    }
  }

  // -------------------------------------------------------------
  // 分析中庭內凹區 (Courtyard) 實體外牆
  // -------------------------------------------------------------
  console.log('\n=== 分析中庭內凹區 (Courtyard) 實體外牆與邊界 ===');
  // 交誼廳南側外牆 (水平牆，Y 在 0 ~ 15,000 間，X 在 10,000 ~ 30,000 間)
  const courtyardSouthWalls = horizWalls.filter(w => w.centerY >= -5000 && w.centerY <= 18000 && w.minX >= 5000 && w.maxX <= 38000);
  console.log(`中庭交誼廳南向候選水平外牆 (共 ${courtyardSouthWalls.length} 道):`);
  for (const w of courtyardSouthWalls) {
    console.log(`  * ID: ${w.id.toString().padEnd(8)} | Name: "${w.name.padEnd(16)}" | Y=${w.centerY.toFixed(1).padStart(8)} mm | X=[${w.minX.toFixed(1).padStart(7)}, ${w.maxX.toFixed(1).padStart(7)}] mm`);
  }

  // 東南居室翼向西實體外牆 (垂直牆，X 在 10,000 ~ 25,000 間，Y 在 -20,000 ~ 5,000 間)
  const vertWalls = mainWalls.filter(w => w.isVert);
  const courtyardWestWalls = vertWalls.filter(w => w.centerX >= 10000 && w.centerX <= 25000 && w.minY <= 5000);
  console.log(`\n中庭東南翼向西候選垂直外牆 (共 ${courtyardWestWalls.length} 道):`);
  for (const w of courtyardWestWalls) {
    console.log(`  * ID: ${w.id.toString().padEnd(8)} | Name: "${w.name.padEnd(16)}" | X=${w.centerX.toFixed(1).padStart(8)} mm | Y=[${w.minY.toFixed(1).padStart(7)}, ${w.maxY.toFixed(1).padStart(7)}] mm`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
