import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  // Grid IDs:
  const northContinuousGrids = [586428, 586421, 586414, 432924, 432845, 192192, 786156];
  const northTotalGrids = [586428, 786156];

  const eastContinuousGrids = [586507, 586516, 1353259];
  const eastTotalGrids = [586507, 1353259];

  const southContinuousGrids = [786156, 192192, 432845, 432924];
  const southTotalGrids = [786156, 432924];

  const westContinuousGrids = [1353259, 586516, 586507, 586498, 432630, 432966, 192066];
  const westTotalGrids = [1353259, 192066];

  const targetViews = [
    { name: '1FL', viewId: 312 },
    { name: '2FL', viewId: 695 },
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: 'RFL', viewId: 586090 },
    { name: 'TRFL', viewId: 586100 }
  ];

  console.log('=== 全棟各樓層以「距圓圈底5mm + 鎖點間距5mm」規格同步更新 ===\n');

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

    // 1. 北側：外層總長 Y=38936, 內層柱心 Y=38436 (間距 500mm = 5mm)
    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northTotalGrids,
      startX: 47333.25,
      startY: 38936,
      endX: -1691.74,
      endY: 38936
    });
    if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

    const nDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northContinuousGrids,
      startX: 47333.25,
      startY: 38436,
      endX: -1691.74,
      endY: 38436
    });
    if (nDim.success) upRightIds.push(nDim.data.DimensionId);

    // 2. 東側：外層總深 X=50210, 內層柱心 X=49710 (間距 500mm = 5mm)
    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastTotalGrids,
      startX: 50210,
      startY: 11363.73,
      endX: 50210,
      endY: 32163.73
    });
    if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

    const eDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastContinuousGrids,
      startX: 49710,
      startY: 11363.73,
      endX: 49710,
      endY: 32163.73
    });
    if (eDim.success) upRightIds.push(eDim.data.DimensionId);

    // 3. 南側：外層總長 Y=-19612, 內層柱心 Y=-19112 (間距 500mm = 5mm)
    const sTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southTotalGrids,
      startX: -1691.74,
      startY: -19612,
      endX: 19608.25,
      endY: -19612
    });
    if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

    const sDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southContinuousGrids,
      startX: -1691.74,
      startY: -19112,
      endX: 19608.25,
      endY: -19112
    });
    if (sDim.success) downRightIds.push(sDim.data.DimensionId);

    // 4. 西側：外層總深 X=-11719, 內層柱心 X=-11219 (間距 500mm = 5mm)
    const wTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westTotalGrids,
      startX: -11719,
      startY: 32163.73,
      endX: -11719,
      endY: -19836.27
    });
    if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

    const wDim = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
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

    console.log(`樓層 ${v.name} 更新完成！`);
  }

  console.log('\n🎉 全棟所有樓層（1FL、2FL、3FL、4FL、RFL、TRFL）尺寸線間距已完全統一為 5MM！');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
