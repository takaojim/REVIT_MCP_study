import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL FloorPlan view
  await client.sendCommand('set_active_view', { viewId: viewId });

  const created = [];

  console.log('=== 1. 建立 2FL 北側 X 向柱線間距與總長標註 ===');

  // 北側總長 (Grid G ~ Grid A: 49,025 mm)
  const nOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: 35500,
    endX: 47333.25,
    endY: 35500,
    offset: 0
  });
  if (nOverall.success) created.push({ 方向: '北側(上)', 項目: 'X向柱線總長 (Grid G~A)', 尺寸: nOverall.data?.Value, dimId: nOverall.data?.DimensionId });

  // 北側分段柱線間距
  const nSpans = [
    { start: -1691.74, end: 58.24, name: 'Grid G - F 間距 (1.75m)' },
    { start: 58.24, end: 8208.26, name: 'Grid F - E 間距 (8.15m)' },
    { start: 8208.26, end: 19608.25, name: 'Grid E - D 間距 (11.4m)' },
    { start: 19608.25, end: 31008.25, name: 'Grid D - C 間距 (11.4m)' },
    { start: 31008.25, end: 40383.24, name: 'Grid C - B 間距 (9.375m)' },
    { start: 40383.24, end: 47333.25, name: 'Grid B - A 間距 (6.95m)' }
  ];
  for (const s of nSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: s.start,
      startY: 34000,
      endX: s.end,
      endY: 34000,
      offset: 0
    });
    if (dim.success) created.push({ 方向: '北側(上)', 項目: s.name, 尺寸: dim.data?.Value, dimId: dim.data?.DimensionId });
  }

  console.log('=== 2. 建立 2FL 西側 Y 向柱線間距與總長標註 ===');

  // 西側總長 (Grid 1 ~ Grid 7: 52,000 mm)
  const wOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -6500,
    startY: -19836.27,
    endX: -6500,
    endY: 32163.73,
    offset: 0
  });
  if (wOverall.success) created.push({ 方向: '西側(左)', 項目: 'Y向柱線總長 (Grid 1~7)', 尺寸: wOverall.data?.Value, dimId: wOverall.data?.DimensionId });

  // 西側分段柱線間距
  const wSpans = [
    { start: -19836.27, end: -11836.27, name: 'Grid 1 - 2 間距 (8.0m)' },
    { start: -11836.27, end: -3836.27, name: 'Grid 2 - 3 間距 (8.0m)' },
    { start: -3836.27, end: 4163.73, name: 'Grid 3 - 4 間距 (8.0m)' },
    { start: 4163.73, end: 11363.73, name: 'Grid 4 - 5 間距 (7.2m)' },
    { start: 11363.73, end: 20163.73, name: 'Grid 5 - 6 間距 (8.8m)' },
    { start: 20163.73, end: 32163.73, name: 'Grid 6 - 7 間距 (12.0m)' }
  ];
  for (const s of wSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: -5000,
      startY: s.start,
      endX: -5000,
      endY: s.end,
      offset: 0
    });
    if (dim.success) created.push({ 方向: '西側(左)', 項目: s.name, 尺寸: dim.data?.Value, dimId: dim.data?.DimensionId });
  }

  console.log('=== 3. 建立 2FL 南側 X 向柱線間距與總長標註 ===');

  // 南側總長
  const sOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: -23500,
    endX: 19608.25,
    endY: -23500,
    offset: 0
  });
  if (sOverall.success) created.push({ 方向: '南側(下)', 項目: '南翼X向柱線總長 (Grid G~D)', 尺寸: sOverall.data?.Value, dimId: sOverall.data?.DimensionId });

  // 南側分段柱線間距
  const sSpans = [
    { start: -1691.74, end: 58.24, name: 'Grid G - F 間距 (1.75m)' },
    { start: 58.24, end: 8208.26, name: 'Grid F - E 間距 (8.15m)' },
    { start: 8208.26, end: 19608.25, name: 'Grid E - D 間距 (11.4m)' }
  ];
  for (const s of sSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: s.start,
      startY: -22000,
      endX: s.end,
      endY: -22000,
      offset: 0
    });
    if (dim.success) created.push({ 方向: '南側(下)', 項目: s.name, 尺寸: dim.data?.Value, dimId: dim.data?.DimensionId });
  }

  console.log('=== 4. 建立 2FL 東側 Y 向柱線間距與總長標註 ===');

  // 東側總長
  const eOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 52000,
    startY: 11363.73,
    endX: 52000,
    endY: 32163.73,
    offset: 0
  });
  if (eOverall.success) created.push({ 方向: '東側(右)', 項目: '東翼Y向柱線總長 (Grid 5~7)', 尺寸: eOverall.data?.Value, dimId: eOverall.data?.DimensionId });

  // 東側分段柱線間距
  const eSpans = [
    { start: 11363.73, end: 20163.73, name: 'Grid 5 - 6 間距 (8.8m)' },
    { start: 20163.73, end: 32163.73, name: 'Grid 6 - 7 間距 (12.0m)' }
  ];
  for (const s of eSpans) {
    const dim = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: 50500,
      startY: s.start,
      endX: 50500,
      endY: s.end,
      offset: 0
    });
    if (dim.success) created.push({ 方向: '東側(右)', 項目: s.name, 尺寸: dim.data?.Value, dimId: dim.data?.DimensionId });
  }

  console.log(`\n🎉 2FL 柱線間距與總長標註完成！共建立 ${created.length} 條標註：`);
  console.table(created);

  process.exit(0);
}

main().catch(err => {
  console.error('標註失敗:', err);
  process.exit(1);
});
