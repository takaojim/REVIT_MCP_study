import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL
  const created = [];

  console.log('=== 開始在 3FL 建物外側建立柱列尺寸與房間牆中心尺寸 ===');

  // -------------------------------------------------------------
  // 一、北側外側標註 (North Exterior: Y > 31764)
  // -------------------------------------------------------------
  // 1. 北側最外層：全棟 X 軸總尺寸 (Building Overall X Width)
  const northOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -3116.74,
    startY: 36000,
    endX: 47583.25,
    endY: 36000,
    offset: 0
  });
  if (northOverall.success) created.push({ loc: '北側外層', name: '全棟X向總寬度 (36m線)', ...northOverall.data });

  // 2. 北側中層：柱列跨距尺寸 (Column Grid Spans - 5大開間)
  const northColSpans = [
    { startX: -3116.74, endX: 8533.26, name: '柱列跨距 1-2 跨 (西側開間)' },
    { startX: 8533.26, endX: 19933.25, name: '柱列跨距 2-3 跨 (中西開間)' },
    { startX: 19933.25, endX: 31348.25, name: '柱列跨距 3-4 跨 (中東開間)' },
    { startX: 31348.25, endX: 40708.24, name: '柱列跨距 4-5 跨 (東側開間)' },
    { startX: 40708.24, endX: 47583.25, name: '柱列跨距 5-邊界 (東翼末端)' }
  ];
  for (const span of northColSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: span.startX,
      startY: 34500,
      endX: span.endX,
      endY: 34500,
      offset: 0
    });
    if (dim.success) created.push({ loc: '北側中層', name: span.name, ...dim.data });
  }

  // 3. 北側內層(但仍在外側)：北側各房間牆中心尺寸 (Room Wall Center Spans)
  const northRoomSpans = [
    { startX: -3116.74, endX: 1108.24, name: '無障礙廁所/走廊 房間牆中心寬' },
    { startX: 1108.24, endX: 6383.26, name: 'A區走廊/休閒區 牆中心寬' },
    { startX: 6383.26, endX: 10033.28, name: '一人房(F847) 牆中心淨寬' },
    { startX: 10033.28, endX: 17783.25, name: '公共休閒/通道 牆中心寬' },
    { startX: 17783.25, endX: 21433.27, name: '一人房(F848) 牆中心淨寬' },
    { startX: 21433.27, endX: 29183.25, name: '休閒/過道 牆中心寬' },
    { startX: 29183.25, endX: 32833.27, name: '一人房(F849) 牆中心淨寬' },
    { startX: 32833.27, endX: 40783.24, name: '無障礙浴室/通道 牆中心寬' },
    { startX: 40783.24, endX: 43883.25, name: 'B梯廳 牆中心淨寬' },
    { startX: 43883.25, endX: 47583.25, name: 'B安全梯/無障礙電梯 牆中心寬' }
  ];
  for (const span of northRoomSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: span.startX,
      startY: 33000,
      endX: span.endX,
      endY: 33000,
      offset: 0
    });
    if (dim.success) created.push({ loc: '北側內層', name: span.name, ...dim.data });
  }

  // -------------------------------------------------------------
  // 二、西側外側標註 (West Exterior: X < -3117)
  // -------------------------------------------------------------
  // 1. 西側最外層：全棟 Y 軸總深度 (Building Overall Y Depth)
  const westOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -7500,
    startY: -19761.34,
    endX: -7500,
    endY: 31763.73,
    offset: 0
  });
  if (westOverall.success) created.push({ loc: '西側外層', name: '全棟Y向總深度 (-7.5m線)', ...westOverall.data });

  // 2. 西側中層：主要柱列進深跨距 (Column Grid Y Spans)
  const westColSpans = [
    { startY: -19761.34, endY: 4563.73, name: '柱列進深跨距 南側翼段' },
    { startY: 4563.73, endY: 12473.73, name: '柱列進深跨距 A梯廳/核心區' },
    { startY: 12473.73, endY: 20488.73, name: '柱列進深跨距 走廊/廁所區' },
    { startY: 20488.73, endY: 31763.73, name: '柱列進深跨距 北側客房區' }
  ];
  for (const span of westColSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: -6000,
      startY: span.startY,
      endX: -6000,
      endY: span.endY,
      offset: 0
    });
    if (dim.success) created.push({ loc: '西側中層', name: span.name, ...dim.data });
  }

  // 3. 西側內層(但仍在外側)：西側各房間牆中心進深尺寸 (Room Wall Center Y Spans)
  const westRoomSpans = [
    { startY: 4563.73, endY: 7463.73, name: 'A安全梯 牆中心進深' },
    { startY: 7623.73, endY: 9723.73, name: '男廁 牆中心進深' },
    { startY: 9893.73, endY: 12303.73, name: '女廁 牆中心進深' },
    { startY: 12483.73, endY: 14803.73, name: '無障礙廁所 牆中心進深' },
    { startY: 20488.73, endY: 22963.73, name: 'A區走廊 牆中心進深' },
    { startY: 23113.73, endY: 31763.73, name: '北側客房區 牆中心總深' }
  ];
  for (const span of westRoomSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: -4500,
      startY: span.startY,
      endX: -4500,
      endY: span.endY,
      offset: 0
    });
    if (dim.success) created.push({ loc: '西側內層', name: span.name, ...dim.data });
  }

  // -------------------------------------------------------------
  // 三、東側外側標註 (East Exterior: X > 47583)
  // -------------------------------------------------------------
  // 1. 東側最外層：全棟 Y 軸總深度
  const eastOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 52500,
    startY: -19761.34,
    endX: 52500,
    endY: 31763.73,
    offset: 0
  });
  if (eastOverall.success) created.push({ loc: '東側外層', name: '全棟Y向總深度 (52.5m線)', ...eastOverall.data });

  // 2. 東側中層：東側柱列跨距
  const eastColSpans = [
    { startY: -19761.34, endY: 10013.73, name: '東側柱列跨距 南翼區間' },
    { startY: 10013.73, endY: 20413.73, name: '東側柱列跨距 B核心梯廳區間' },
    { startY: 20413.73, endY: 31763.73, name: '東側柱列跨距 北翼客房區間' }
  ];
  for (const span of eastColSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: 51000,
      startY: span.startY,
      endX: 51000,
      endY: span.endY,
      offset: 0
    });
    if (dim.success) created.push({ loc: '東側中層', name: span.name, ...dim.data });
  }

  // 3. 東側內層(但仍在外側)：東側各房間牆中心進深尺寸
  const eastRoomSpans = [
    { startY: 10013.73, endY: 17463.73, name: 'B安全梯 牆中心進深' },
    { startY: 17613.73, endY: 20413.73, name: 'B無障礙電梯 牆中心進深' },
    { startY: 15663.73, endY: 20413.73, name: 'B梯廳 牆中心進深' },
    { startY: 11773.73, endY: 17403.73, name: '無障礙浴室 牆中心進深' },
    { startY: 20563.73, endY: 23038.73, name: 'B區走廊 牆中心進深' }
  ];
  for (const span of eastRoomSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: 49500,
      startY: span.startY,
      endX: 49500,
      endY: span.endY,
      offset: 0
    });
    if (dim.success) created.push({ loc: '東側內層', name: span.name, ...dim.data });
  }

  // -------------------------------------------------------------
  // 四、南側外側標註 (South Exterior: Y < -19761)
  // -------------------------------------------------------------
  // 1. 南側最外層：全棟 X 軸總寬度
  const southOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -3116.74,
    startY: -24000,
    endX: 47583.25,
    endY: -24000,
    offset: 0
  });
  if (southOverall.success) created.push({ loc: '南側外層', name: '全棟X向總寬度 (-24m線)', ...southOverall.data });

  // 2. 南側中層：南側柱列主要跨距
  const southColSpans = [
    { startX: -3116.74, endX: 11158.26, name: '南側柱列 1-2 跨' },
    { startX: 11158.26, endX: 25233.25, name: '南側柱列 2-3 跨' },
    { startX: 25233.25, endX: 47583.25, name: '南側柱列 3-5 跨' }
  ];
  for (const span of southColSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: span.startX,
      startY: -22500,
      endX: span.endX,
      endY: -22500,
      offset: 0
    });
    if (dim.success) created.push({ loc: '南側中層', name: span.name, ...dim.data });
  }

  // 3. 南側內層(但仍在外側)：南側房間牆中心尺寸
  const southRoomSpans = [
    { startX: 11158.26, endX: 19208.25, name: '二人房(F765) 牆中心淨寬' },
    { startX: 11168.26, endX: 13698.26, name: '二人房浴廁 牆中心淨寬' },
    { startX: 16718.25, endX: 18198.25, name: '宗教閱覽室(1) 牆中心淨寬' },
    { startX: 18318.25, endX: 19858.25, name: '宗教閱覽室(2) 牆中心淨寬' },
    { startX: 20008.25, endX: 26098.85, name: '陽台(F853) 牆中心淨寬' }
  ];
  for (const span of southRoomSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: span.startX,
      startY: -21000,
      endX: span.endX,
      endY: -21000,
      offset: 0
    });
    if (dim.success) created.push({ loc: '南側內層', name: span.name, ...dim.data });
  }

  console.log(`\n🎉 建物外側標註完成！共建立 ${created.length} 條外側尺寸標註：`);
  console.log(JSON.stringify(created, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('標註失敗:', err);
  process.exit(1);
});
