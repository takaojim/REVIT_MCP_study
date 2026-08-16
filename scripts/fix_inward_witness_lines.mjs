import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  // 1. 北側：由東至西 (右至左: A -> G)，輔助線向「下」朝向建物
  const northContinuousGrids = [586428, 586421, 586414, 432924, 432845, 192192, 786156]; // A to G
  const northTotalGrids = [586428, 786156]; // A, G

  // 2. 南側：由西至東 (左至右: G -> D)，輔助線向「上」朝向建物
  const southContinuousGrids = [786156, 192192, 432845, 432924]; // G to D
  const southTotalGrids = [786156, 432924]; // G, D

  // 3. 西側：由北至南 (上至下: 7 -> 1)，輔助線向「右」朝向建物
  const westContinuousGrids = [1353259, 586516, 586507, 586498, 432630, 432966, 192066]; // 7 to 1
  const westTotalGrids = [1353259, 192066]; // 7, 1

  // 4. 東側：由南至北 (下至上: 5 -> 7)，輔助線向「左」朝向建物
  const eastContinuousGrids = [586507, 586516, 1353259]; // 5 to 7
  const eastTotalGrids = [586507, 1353259]; // 5, 7

  const targetViews = [
    { name: '1FL', viewId: 312 },
    { name: '2FL', viewId: 695 },
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: 'RFL', viewId: 586090 },
    { name: 'TRFL', viewId: 586100 }
  ];

  console.log('=== 全棟各樓層重新以「朝向建物內側」之輔助線方向建立柱心尺寸 ===\n');

  for (const v of targetViews) {
    await client.sendCommand('set_active_view', { viewId: v.viewId });

    // 刪除該視圖上我們先前建立的柱心尺寸
    const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.viewId });
    for (const d of dimsRes.data.Elements) {
      if (d.Name.includes('柱心') || d.ElementId >= 2110000) {
        try {
          await client.sendCommand('delete_element', { elementId: d.ElementId });
        } catch (e) {}
      }
    }

    const upRightIds = [];
    const downRightIds = [];

    // 1. 北側 (由右向左畫，輔助線朝下指向建物)
    const nDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northContinuousGrids,
      startX: 47333.25,
      startY: 34000,
      endX: -1691.74,
      endY: 34000
    });
    if (nDim.success) upRightIds.push(nDim.data.DimensionId);

    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northTotalGrids,
      startX: 47333.25,
      startY: 35500,
      endX: -1691.74,
      endY: 35500
    });
    if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

    // 2. 東側 (由下向上畫，輔助線朝左指向建物)
    const eDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastContinuousGrids,
      startX: 50500,
      startY: 11363.73,
      endX: 50500,
      endY: 32163.73
    });
    if (eDim.success) upRightIds.push(eDim.data.DimensionId);

    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastTotalGrids,
      startX: 52000,
      startY: 11363.73,
      endX: 52000,
      endY: 32163.73
    });
    if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

    // 3. 南側 (由左向右畫，輔助線朝上指向建物)
    const sDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southContinuousGrids,
      startX: -1691.74,
      startY: -22000,
      endX: 19608.25,
      endY: -22000
    });
    if (sDim.success) downRightIds.push(sDim.data.DimensionId);

    const sTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southTotalGrids,
      startX: -1691.74,
      startY: -23500,
      endX: 19608.25,
      endY: -23500
    });
    if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

    // 4. 西側 (由上向下畫，輔助線朝右指向建物)
    const wDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westContinuousGrids,
      startX: -5000,
      startY: 32163.73,
      endX: -5000,
      endY: -19836.27
    });
    if (wDim.success) downRightIds.push(wDim.data.DimensionId);

    const wTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westTotalGrids,
      startX: -6500,
      startY: 32163.73,
      endX: -6500,
      endY: -19836.27
    });
    if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

    // 套用標註形式
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

    console.log(`樓層 ${v.name} 更新完成：所有輔助線均正確「朝向建物內側」！`);
  }

  console.log('\n🎉 全棟各層柱心尺寸線方向全部修正完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
