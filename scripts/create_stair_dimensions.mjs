import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL
  const created = [];

  console.log('=== 開始在 3FL 建立 A安全梯與 B安全梯之淨寬、平台深與迴轉直徑標註 ===');

  // -------------------------------------------------------------
  // 一、A安全梯 (F349) [X: -1942 ~ 5508, Y: 4564 ~ 7464]
  // 梯間軸向：長向為 X 軸 (長 7450mm)，短向/梯段寬度為 Y 軸 (全寬 2900mm)
  // -------------------------------------------------------------
  console.log('\n--- 1. 標註 A安全梯 (F349) ---');

  // 1. 梯間總淨寬度 (Y向: 2,900 mm)
  const aTotalWidth = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 5650,
    startY: 4563.73,
    endX: 5650,
    endY: 7463.73,
    offset: 0
  });
  if (aTotalWidth.success) created.push({ stair: 'A安全梯', type: '梯間總淨寬', ...aTotalWidth.data });

  // 2. 梯段 1 淨寬度 (上側梯段: Y 6064 ~ 7464, 淨寬 1,400 mm)
  const aRun1 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 1800,
    startY: 6063.73,
    endX: 1800,
    endY: 7463.73,
    offset: 0
  });
  if (aRun1.success) created.push({ stair: 'A安全梯', type: '北側梯段淨寬 (1.4m)', ...aRun1.data });

  // 3. 梯段 2 淨寬度 (下側梯段: Y 4564 ~ 5964, 淨寬 1,400 mm)
  const aRun2 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 1800,
    startY: 4563.73,
    endX: 1800,
    endY: 5963.73,
    offset: 0
  });
  if (aRun2.success) created.push({ stair: 'A安全梯', type: '南側梯段淨寬 (1.4m)', ...aRun2.data });

  // 4. 東側梯平台深度 (X 3758 ~ 5508, 深度 1,750 mm)
  const aLandingEast = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 3758.26,
    startY: 7600,
    endX: 5508.26,
    endY: 7600,
    offset: 0
  });
  if (aLandingEast.success) created.push({ stair: 'A安全梯', type: '東側梯平台淨深 (1.75m)', ...aLandingEast.data });

  // 5. 西側梯平台深度 (X -1942 ~ -192, 深度 1,750 mm)
  const aLandingWest = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1941.74,
    startY: 7600,
    endX: -191.74,
    endY: 7600,
    offset: 0
  });
  if (aLandingWest.success) created.push({ stair: 'A安全梯', type: '西側梯平台淨深 (1.75m)', ...aLandingWest.data });

  // 6. 梯間總長度 (X向: 7,450 mm)
  const aTotalLength = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1941.74,
    startY: 7750,
    endX: 5508.26,
    endY: 7750,
    offset: 0
  });
  if (aTotalLength.success) created.push({ stair: 'A安全梯', type: '梯間總全長 (7.45m)', ...aTotalLength.data });

  // 7. 平台 150cm 輪椅迴轉空間檢核標註 (1,500 mm 基準線)
  const aTurnSpace = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 4008.26,
    startY: 5263.73,
    endX: 4008.26,
    endY: 6763.73,
    offset: 0
  });
  if (aTurnSpace.success) created.push({ stair: 'A安全梯', type: '平台輪椅迴轉直徑檢核 (Φ1.5m)', ...aTurnSpace.data });

  // -------------------------------------------------------------
  // 二、B安全梯 (F346) [X: 44033 ~ 46933, Y: 10014 ~ 17464]
  // 梯間軸向：長向為 Y 軸 (長 7450mm)，短向/梯段寬度為 X 軸 (全寬 2900mm)
  // -------------------------------------------------------------
  console.log('\n--- 2. 標註 B安全梯 (F346) ---');

  // 1. 梯間總淨寬度 (X向: 2,900 mm)
  const bTotalWidth = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 44033.25,
    startY: 9850,
    endX: 46933.25,
    endY: 9850,
    offset: 0
  });
  if (bTotalWidth.success) created.push({ stair: 'B安全梯', type: '梯間總淨寬', ...bTotalWidth.data });

  // 2. 梯段 1 淨寬度 (西側梯段: X 44033 ~ 45433, 淨寬 1,400 mm)
  const bRun1 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 44033.25,
    startY: 13700,
    endX: 45433.25,
    endY: 13700,
    offset: 0
  });
  if (bRun1.success) created.push({ stair: 'B安全梯', type: '西側梯段淨寬 (1.4m)', ...bRun1.data });

  // 3. 梯段 2 淨寬度 (東側梯段: X 45533 ~ 46933, 淨寬 1,400 mm)
  const bRun2 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 45533.25,
    startY: 13700,
    endX: 46933.25,
    endY: 13700,
    offset: 0
  });
  if (bRun2.success) created.push({ stair: 'B安全梯', type: '東側梯段淨寬 (1.4m)', ...bRun2.data });

  // 4. 北側梯平台深度 (Y 15714 ~ 17464, 深度 1,750 mm)
  const bLandingNorth = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 47100,
    startY: 15713.73,
    endX: 47100,
    endY: 17463.73,
    offset: 0
  });
  if (bLandingNorth.success) created.push({ stair: 'B安全梯', type: '北側梯平台淨深 (1.75m)', ...bLandingNorth.data });

  // 5. 南側梯平台深度 (Y 10014 ~ 11764, 深度 1,750 mm)
  const bLandingSouth = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 47100,
    startY: 10013.73,
    endX: 47100,
    endY: 11763.73,
    offset: 0
  });
  if (bLandingSouth.success) created.push({ stair: 'B安全梯', type: '南側梯平台淨深 (1.75m)', ...bLandingSouth.data });

  // 6. 梯間總長度 (Y向: 7,450 mm)
  const bTotalLength = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 47250,
    startY: 10013.73,
    endX: 47250,
    endY: 17463.73,
    offset: 0
  });
  if (bTotalLength.success) created.push({ stair: 'B安全梯', type: '梯間總全長 (7.45m)', ...bTotalLength.data });

  // 7. 平台 150cm 輪椅迴轉空間檢核標註 (1,500 mm 基準線)
  const bTurnSpace = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 44733.25,
    startY: 16200,
    endX: 46233.25,
    endY: 16200,
    offset: 0
  });
  if (bTurnSpace.success) created.push({ stair: 'B安全梯', type: '平台輪椅迴轉直徑檢核 (Φ1.5m)', ...bTurnSpace.data });

  console.log(`\n🎉 樓梯淨寬與迴轉半徑標註完成！共建立 ${created.length} 條標註：`);
  console.table(created);

  process.exit(0);
}

main().catch(err => {
  console.error('標註失敗:', err);
  process.exit(1);
});
