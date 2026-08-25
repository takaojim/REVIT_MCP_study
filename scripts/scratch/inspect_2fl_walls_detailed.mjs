import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-2fl-walls-detailed';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 取得 2FL 上的所有牆體
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];
  console.log(`收集到 ${allWalls.length} 道牆體，分析幾何...`);

  // 取得 2FL 實體外框極值
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const env = alignRes.data.PhysicalEnvelopeMm;
  console.log(`實體外框: X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm\n`);

  // 查詢每道牆的詳細資訊 (位置與方向)
  const wallDetails = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      wallDetails.push({
        id: w.ElementId,
        name: w.Name,
        startX: info.data.StartX,
        startY: info.data.StartY,
        endX: info.data.EndX,
        endY: info.data.EndY,
        minX: Math.min(info.data.StartX, info.data.EndX),
        maxX: Math.max(info.data.StartX, info.data.EndX),
        minY: Math.min(info.data.StartY, info.data.EndY),
        maxY: Math.max(info.data.StartY, info.data.EndY),
        isVert: Math.abs(info.data.EndX - info.data.StartX) < 30, // 垂直牆 (沿 Y 軸)
        isHoriz: Math.abs(info.data.EndY - info.data.StartY) < 30, // 水平牆 (沿 X 軸)
        centerX: (info.data.StartX + info.data.EndX) / 2,
        centerY: (info.data.StartY + info.data.EndY) / 2
      });
    }
  }

  console.log(`成功解析 ${wallDetails.length} 道直線牆體！`);
  const vertWalls = wallDetails.filter(w => w.isVert);
  const horizWalls = wallDetails.filter(w => w.isHoriz);
  console.log(`- 垂直牆 (南北向): ${vertWalls.length} 道`);
  console.log(`- 水平牆 (東西向): ${horizWalls.length} 道\n`);

  // -------------------------------------------------------------
  // 東側 (Right / East) 分析：測量水平牆的 Y 坐標 (由南至北)
  // -------------------------------------------------------------
  console.log('=== 【東側 (East)】水平牆分析 ===');
  // Layer 1: 最底與最頂水平外牆
  const eastLayer1 = horizWalls.filter(w => w.maxX > env.MaxX - 5000);
  console.log(`東側候選水平牆數: ${eastLayer1.length}`);

  // -------------------------------------------------------------
  // 西側 (Left / West) 分析：測量水平牆的 Y 坐標 (由南至北)
  // -------------------------------------------------------------
  console.log('\n=== 【西側 (West)】水平牆分析 ===');
  const westLayer1 = horizWalls.filter(w => w.minX < env.MinX + 5000);
  console.log(`西側候選水平牆數: ${westLayer1.length}`);

  // -------------------------------------------------------------
  // 南側 (Bottom / South) 分析：測量垂直牆的 X 坐標 (由東至西)
  // -------------------------------------------------------------
  console.log('\n=== 【南側 (South)】垂直牆分析 ===');
  const southLayer1 = vertWalls.filter(w => w.minY < env.MinY + 5000);
  console.log(`南側候選垂直牆數: ${southLayer1.length}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
