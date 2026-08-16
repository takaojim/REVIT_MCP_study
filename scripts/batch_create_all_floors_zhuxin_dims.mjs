import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  const targetViews = [
    { name: '1FL', viewId: 312 },
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: 'RFL', viewId: 586090 },
    { name: 'TRFL', viewId: 586100 }
  ];

  // 坐標點定義
  const northPoints = [
    { x: -1691.74, y: 34000 }, // G
    { x: 58.24, y: 34000 },    // F
    { x: 8208.26, y: 34000 },  // E
    { x: 19608.25, y: 34000 }, // D
    { x: 31008.25, y: 34000 }, // C
    { x: 40383.24, y: 34000 }, // B
    { x: 47333.25, y: 34000 }  // A
  ];

  const westPoints = [
    { x: -5000, y: -19836.27 }, // 1
    { x: -5000, y: -11836.27 }, // 2
    { x: -5000, y: -3836.27 },  // 3
    { x: -5000, y: 4163.73 },   // 4
    { x: -5000, y: 11363.73 },  // 5
    { x: -5000, y: 20163.73 },  // 6
    { x: -5000, y: 32163.73 }   // 7
  ];

  const southPoints = [
    { x: -1691.74, y: -22000 }, // G
    { x: 58.24, y: -22000 },    // F
    { x: 8208.26, y: -22000 },  // E
    { x: 19608.25, y: -22000 }  // D
  ];

  const eastPoints = [
    { x: 50500, y: 11363.73 }, // 5
    { x: 50500, y: 20163.73 }, // 6
    { x: 50500, y: 32163.73 }  // 7
  ];

  const summary = [];

  for (const v of targetViews) {
    console.log(`\n========================================`);
    console.log(`正在處理樓層視圖: ${v.name} (ID: ${v.viewId})`);
    console.log(`========================================`);

    await client.sendCommand('set_active_view', { viewId: v.viewId });

    const upRightIds = [];
    const downRightIds = [];

    // 1. 北側：柱心連續標註 (同一線段) + X向總長
    const nContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      points: northPoints,
      offset: 0
    });
    if (nContinuous.success && nContinuous.data?.DimensionId) {
      upRightIds.push(nContinuous.data.DimensionId);
    }

    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      startX: -1691.74,
      startY: 35500,
      endX: 47333.25,
      endY: 35500,
      offset: 0
    });
    if (nTotal.success && nTotal.data?.DimensionId) {
      upRightIds.push(nTotal.data.DimensionId);
    }

    // 2. 東側：柱心連續標註 (同一線段) + Y向東翼總深
    const eContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      points: eastPoints,
      offset: 0
    });
    if (eContinuous.success && eContinuous.data?.DimensionId) {
      upRightIds.push(eContinuous.data.DimensionId);
    }

    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      startX: 52000,
      startY: 11363.73,
      endX: 52000,
      endY: 32163.73,
      offset: 0
    });
    if (eTotal.success && eTotal.data?.DimensionId) {
      upRightIds.push(eTotal.data.DimensionId);
    }

    // 3. 南側：柱心連續標註 (同一線段) + X向南翼總長
    const sContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      points: southPoints,
      offset: 0
    });
    if (sContinuous.success && sContinuous.data?.DimensionId) {
      downRightIds.push(sContinuous.data.DimensionId);
    }

    const sTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      startX: -1691.74,
      startY: -23500,
      endX: 19608.25,
      endY: -23500,
      offset: 0
    });
    if (sTotal.success && sTotal.data?.DimensionId) {
      downRightIds.push(sTotal.data.DimensionId);
    }

    // 4. 西側：柱心連續標註 (同一線段) + Y向全棟總深
    const wContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      points: westPoints,
      offset: 0
    });
    if (wContinuous.success && wContinuous.data?.DimensionId) {
      downRightIds.push(wContinuous.data.DimensionId);
    }

    const wTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      startX: -6500,
      startY: -19836.27,
      endX: -6500,
      endY: 32163.73,
      offset: 0
    });
    if (wTotal.success && wTotal.data?.DimensionId) {
      downRightIds.push(wTotal.data.DimensionId);
    }

    // 5. 批次套用專屬柱心標註形式
    if (upRightIds.length > 0) {
      await client.sendCommand('change_element_type', {
        elementIds: upRightIds,
        typeId: typeIdUpRight
      });
    }

    if (downRightIds.length > 0) {
      await client.sendCommand('change_element_type', {
        elementIds: downRightIds,
        typeId: typeIdDownRight
      });
    }

    summary.push({
      樓層: v.name,
      視圖ID: v.viewId,
      '柱心-上右標註數': upRightIds.length,
      '柱心-下右標註數': downRightIds.length,
      總標註線數: upRightIds.length + downRightIds.length
    });
    console.log(`樓層 ${v.name} 完成！建立 ${upRightIds.length + downRightIds.length} 道柱心連續標註線。`);
  }

  console.log('\n========================================');
  console.log('🎉 所有指定樓層柱心連續標註全部完成！');
  console.log('========================================');
  console.table(summary);

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
