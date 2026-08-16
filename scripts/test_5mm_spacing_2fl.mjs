import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  const typeIdUpRight = 2110318;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  // 1. 刪除 2FL 上現有的柱心尺寸
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of dimsRes.data.Elements) {
    if (d.Name.includes('柱心') || d.ElementId >= 2110000) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      } catch (e) {}
    }
  }

  // 精確 5mm 鎖點與距離圓圈底 5mm (模型空間 500mm @ 1:100)
  // 北側: Y_circle_bottom = 39436
  // 外層總長 Y = 38936, 內層柱心 Y = 38436 (間距 500mm = 5mm)
  const northContinuousGrids = [586428, 586421, 586414, 432924, 432845, 192192, 786156];
  const northTotalGrids = [586428, 786156];

  const upRightIds = [];
  const downRightIds = [];

  console.log('=== 建立 2FL 精確 5mm 鎖點間距之柱心標註 ===');

  // 北側
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northTotalGrids,
    startX: 47333.25,
    startY: 38936,
    endX: -1691.74,
    endY: 38936
  });
  if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

  const nDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northContinuousGrids,
    startX: 47333.25,
    startY: 38436,
    endX: -1691.74,
    endY: 38436
  });
  if (nDim.success) upRightIds.push(nDim.data.DimensionId);

  // 東側: X_circle_bottom = 50710
  // 外層總深 X = 50210, 內層柱心 X = 49710 (間距 500mm = 5mm)
  const eastContinuousGrids = [586507, 586516, 1353259];
  const eastTotalGrids = [586507, 1353259];

  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastTotalGrids,
    startX: 50210,
    startY: 11363.73,
    endX: 50210,
    endY: 32163.73
  });
  if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

  const eDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastContinuousGrids,
    startX: 49710,
    startY: 11363.73,
    endX: 49710,
    endY: 32163.73
  });
  if (eDim.success) upRightIds.push(eDim.data.DimensionId);

  // 南側: Y_circle_bottom = -20112
  // 外層總長 Y = -19612, 內層柱心 Y = -19112 (間距 500mm = 5mm)
  const southContinuousGrids = [786156, 192192, 432845, 432924];
  const southTotalGrids = [786156, 432924];

  const sTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southTotalGrids,
    startX: -1691.74,
    startY: -19612,
    endX: 19608.25,
    endY: -19612
  });
  if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

  const sDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southContinuousGrids,
    startX: -1691.74,
    startY: -19112,
    endX: 19608.25,
    endY: -19112
  });
  if (sDim.success) downRightIds.push(sDim.data.DimensionId);

  // 西側: X_circle_bottom = -12219
  // 外層總深 X = -11719, 內層柱心 X = -11219 (間距 500mm = 5mm)
  const westContinuousGrids = [1353259, 586516, 586507, 586498, 432630, 432966, 192066];
  const westTotalGrids = [1353259, 192066];

  const wTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westTotalGrids,
    startX: -11719,
    startY: 32163.73,
    endX: -11719,
    endY: -19836.27
  });
  if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

  const wDim = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westContinuousGrids,
    startX: -11219,
    startY: 32163.73,
    endX: -11219,
    endY: -19836.27
  });
  if (wDim.success) downRightIds.push(wDim.data.DimensionId);

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

  console.log('2FL 已成功以 5mm 鎖點間距與距離圓圈底 5mm 重新建立完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
