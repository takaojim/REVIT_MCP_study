import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  console.log('=== 1. 清理 2FL 先前的測試標註 ===');
  // 刪除剛才測試產生的單一標註 2110193, 2110197
  const oldTestIds = [2110193, 2110197];
  for (const id of oldTestIds) {
    try {
      await client.sendCommand('delete_element', { elementId: id });
    } catch (e) {}
  }

  const createdList = [];

  // =========================================================================
  // 北側 (North Exterior): Y = 34000 (連續柱列跨距) & Y = 35500 (總長)
  // 柱列：G(-1691.74) -> F(58.24) -> E(8208.26) -> D(19608.25) -> C(31008.25) -> B(40383.24) -> A(47333.25)
  // =========================================================================
  console.log('\n=== 2. 建立北側連續柱列標註 (同一連續線段) ===');

  // (1) 北側柱間距：同一條連續標註線 (7 個點，6 個跨距)
  const northPoints = [
    { x: -1691.74, y: 34000 },
    { x: 58.24, y: 34000 },
    { x: 8208.26, y: 34000 },
    { x: 19608.25, y: 34000 },
    { x: 31008.25, y: 34000 },
    { x: 40383.24, y: 34000 },
    { x: 47333.25, y: 34000 }
  ];
  const nDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: northPoints,
    offset: 0
  });
  if (nDim.success) {
    createdList.push({
      方向: '北側(上)',
      類型: '柱間距連續標註 (同一線段)',
      跨數: nDim.data?.SegmentsCount ?? 6,
      DimensionId: nDim.data?.DimensionId,
      軸線跨距: 'G-F(1.75m) + F-E(8.15m) + E-D(11.4m) + D-C(11.4m) + C-B(9.38m) + B-A(6.95m)'
    });
  }

  // (2) 北側外圍總長 (Grid G ~ A: 49,025 mm)
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: 35500,
    endX: 47333.25,
    endY: 35500,
    offset: 0
  });
  if (nTotal.success) {
    createdList.push({
      方向: '北側(上)',
      類型: '全棟X向總長',
      跨數: 1,
      DimensionId: nTotal.data?.DimensionId,
      軸線跨距: 'Grid G ~ Grid A (49,025 mm)'
    });
  }

  // =========================================================================
  // 西側 (West Exterior): X = -5000 (連續柱列進深) & X = -6500 (總深)
  // 柱列：1(-19836.27) -> 2(-11836.27) -> 3(-3836.27) -> 4(4163.73) -> 5(11363.73) -> 6(20163.73) -> 7(32163.73)
  // =========================================================================
  console.log('\n=== 3. 建立西側連續柱列標註 (同一連續線段) ===');

  // (1) 西側柱進深：同一條連續標註線 (7 個點，6 個跨距)
  const westPoints = [
    { x: -5000, y: -19836.27 },
    { x: -5000, y: -11836.27 },
    { x: -5000, y: -3836.27 },
    { x: -5000, y: 4163.73 },
    { x: -5000, y: 11363.73 },
    { x: -5000, y: 20163.73 },
    { x: -5000, y: 32163.73 }
  ];
  const wDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: westPoints,
    offset: 0
  });
  if (wDim.success) {
    createdList.push({
      方向: '西側(左)',
      類型: '柱進深連續標註 (同一線段)',
      跨數: wDim.data?.SegmentsCount ?? 6,
      DimensionId: wDim.data?.DimensionId,
      軸線跨距: '1-2(8m) + 2-3(8m) + 3-4(8m) + 4-5(7.2m) + 5-6(8.8m) + 6-7(12m)'
    });
  }

  // (2) 西側外圍總深 (Grid 1 ~ 7: 52,000 mm)
  const wTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -6500,
    startY: -19836.27,
    endX: -6500,
    endY: 32163.73,
    offset: 0
  });
  if (wTotal.success) {
    createdList.push({
      方向: '西側(左)',
      類型: '全棟Y向總長',
      跨數: 1,
      DimensionId: wTotal.data?.DimensionId,
      軸線跨距: 'Grid 1 ~ Grid 7 (52,000 mm)'
    });
  }

  // =========================================================================
  // 南側 (South Exterior): Y = -22000 (連續柱列跨距) & Y = -23500 (總長)
  // 柱列：G(-1691.74) -> F(58.24) -> E(8208.26) -> D(19608.25)
  // =========================================================================
  console.log('\n=== 4. 建立南側連續柱列標註 (同一連續線段) ===');

  const southPoints = [
    { x: -1691.74, y: -22000 },
    { x: 58.24, y: -22000 },
    { x: 8208.26, y: -22000 },
    { x: 19608.25, y: -22000 }
  ];
  const sDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: southPoints,
    offset: 0
  });
  if (sDim.success) {
    createdList.push({
      方向: '南側(下)',
      類型: '南翼柱間距連續標註 (同一線段)',
      跨數: sDim.data?.SegmentsCount ?? 3,
      DimensionId: sDim.data?.DimensionId,
      軸線跨距: 'G-F(1.75m) + F-E(8.15m) + E-D(11.4m)'
    });
  }

  const sTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: -23500,
    endX: 19608.25,
    endY: -23500,
    offset: 0
  });
  if (sTotal.success) {
    createdList.push({
      方向: '南側(下)',
      類型: '南翼X向總長',
      跨數: 1,
      DimensionId: sTotal.data?.DimensionId,
      軸線跨距: 'Grid G ~ Grid D (21,300 mm)'
    });
  }

  // =========================================================================
  // 東側 (East Exterior): X = 50500 (連續柱列進深) & X = 52000 (總深)
  // 柱列：5(11363.73) -> 6(20163.73) -> 7(32163.73)
  // =========================================================================
  console.log('\n=== 5. 建立東側連續柱列標註 (同一連續線段) ===');

  const eastPoints = [
    { x: 50500, y: 11363.73 },
    { x: 50500, y: 20163.73 },
    { x: 50500, y: 32163.73 }
  ];
  const eDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: eastPoints,
    offset: 0
  });
  if (eDim.success) {
    createdList.push({
      方向: '東側(右)',
      類型: '東翼柱進深連續標註 (同一線段)',
      跨數: eDim.data?.SegmentsCount ?? 2,
      DimensionId: eDim.data?.DimensionId,
      軸線跨距: '5-6(8.8m) + 6-7(12m)'
    });
  }

  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 52000,
    startY: 11363.73,
    endX: 52000,
    endY: 32163.73,
    offset: 0
  });
  if (eTotal.success) {
    createdList.push({
      方向: '東側(右)',
      類型: '東翼Y向總長',
      跨數: 1,
      DimensionId: eTotal.data?.DimensionId,
      軸線跨距: 'Grid 5 ~ Grid 7 (20,800 mm)'
    });
  }

  console.log('\n🎉 2FL 連續柱列尺寸標註（同一線段 String Dimension）建立完成！');
  console.table(createdList);

  process.exit(0);
}

main().catch(err => {
  console.error('執行錯誤:', err);
  process.exit(1);
});
