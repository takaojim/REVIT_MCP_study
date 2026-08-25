import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'build-2fl-wall-dims-3sides';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdWallDot = 2251126; // TABC-DIM_dot 牆心

  console.log('================================================================');
  console.log('=== 【2FL 牆心標註】右側 (東)、左側 (西)、下側 (南) 三層標註實作 ===');
  console.log('================================================================\n');

  // 1. 取得 2FL 實體外框極值與基準階梯
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const env = alignRes.data.PhysicalEnvelopeMm;
  const bounds = alignRes.data.AlignmentBoundsMm;
  console.log(`實體外框: X=[${env.MinX.toFixed(1)}, ${env.MaxX.toFixed(1)}], Y=[${env.MinY.toFixed(1)}, ${env.MaxY.toFixed(1)}] mm\n`);

  // 2. 查詢 2FL 上所有牆體
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];
  console.log(`收集到 ${allWalls.length} 道牆體，開始解析中心線幾何與空間分佈...`);

  // 3. 鏡射對稱放樣坐標計算 (Step 5, Step 4, Step 3)
  // Step 5: 距外牆 3,250mm (5個間距) - Layer 1 外牆總長
  // Step 4: 距外牆 2,600mm (4個間距) - Layer 2 主空間隔間牆心
  // Step 3: 距外牆 1,950mm (3個間距) - Layer 3 走廊/機能隔間牆心

  // --- 東側 (右側 / East) ---
  const east_X_layer1 = env.MaxX + 3250.0; // 50983.3 mm
  const east_X_layer2 = env.MaxX + 2600.0; // 50333.3 mm
  const east_X_layer3 = env.MaxX + 1950.0; // 49683.3 mm

  // --- 西側 (左側 / West) ---
  const west_X_layer1 = env.MinX - 3250.0; // -8841.7 mm
  const west_X_layer2 = env.MinX - 2600.0; // -8191.7 mm
  const west_X_layer3 = env.MinX - 1950.0; // -7541.7 mm

  // --- 南側 (下側 / South) ---
  const south_Y_layer1 = env.MinY - 3250.0; // -23486.3 mm
  const south_Y_layer2 = env.MinY - 2600.0; // -22836.3 mm
  const south_Y_layer3 = env.MinY - 1950.0; // -22186.3 mm

  console.log('📐 放樣坐標：');
  console.log(`- 東側 X: Layer 1=${east_X_layer1.toFixed(1)}, Layer 2=${east_X_layer2.toFixed(1)}, Layer 3=${east_X_layer3.toFixed(1)} mm`);
  console.log(`- 西側 X: Layer 1=${west_X_layer1.toFixed(1)}, Layer 2=${west_X_layer2.toFixed(1)}, Layer 3=${west_X_layer3.toFixed(1)} mm`);
  console.log(`- 南側 Y: Layer 1=${south_Y_layer1.toFixed(1)}, Layer 2=${south_Y_layer2.toFixed(1)}, Layer 3=${south_Y_layer3.toFixed(1)} mm\n`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
