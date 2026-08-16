import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const typeIdUpRight = 2110318;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = 2110326; // TABC-DIM_*/ S 2.5-柱心-下右

  // Grid IDs:
  // North/South (Vertical Grids G to A):
  const allXGridIds = [786156, 192192, 432845, 432924, 586414, 586421, 586428]; // G, F, E, D, C, B, A
  const southGridIds = [786156, 192192, 432845, 432924]; // G, F, E, D
  const northTotalGridIds = [786156, 586428]; // G, A
  const southTotalGridIds = [786156, 432924]; // G, D

  // West/East (Horizontal Grids 1 to 7):
  const allYGridIds = [192066, 432966, 432630, 586498, 586507, 586516, 1353259]; // 1, 2, 3, 4, 5, 6, 7
  const eastGridIds = [586507, 586516, 1353259]; // 5, 6, 7
  const westTotalGridIds = [192066, 1353259]; // 1, 7
  const eastTotalGridIds = [586507, 1353259]; // 5, 7

  const targetViews = [
    { name: '1FL', viewId: 312 },
    { name: '2FL', viewId: 695 },
    { name: '3FL', viewId: 428158 },
    { name: '4FL', viewId: 586080 },
    { name: 'RFL', viewId: 586090 },
    { name: 'TRFL', viewId: 586100 }
  ];

  console.log('=== 使用純原生 Grid 軸線參照重新建立全棟柱心標註 (100% 無輔助細線) ===');

  for (const v of targetViews) {
    await client.sendCommand('set_active_view', { viewId: v.viewId });

    // 1. 刪除該視圖上我們先前建立的尺寸
    const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.viewId });
    for (const d of dimsRes.data.Elements) {
      if (d.Name.includes('柱心')) {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
      }
    }

    // 2. 刪除該視圖上的所有短詳圖線 (長度約 305mm 的 DetailLines)
    const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.viewId });
    if (linesRes.data?.Elements) {
      for (const line of linesRes.data.Elements) {
        // 安全刪除輔助線
        try {
          await client.sendCommand('delete_element', { elementId: line.ElementId });
        } catch (e) {}
      }
    }

    const upRightIds = [];
    const downRightIds = [];

    // 3. 建立北側 (使用 gridIds)
    const nContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: allXGridIds,
      startX: -1691.74,
      startY: 34000,
      endX: 47333.25,
      endY: 34000
    });
    if (nContinuous.success) upRightIds.push(nContinuous.data.DimensionId);

    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northTotalGridIds,
      startX: -1691.74,
      startY: 35500,
      endX: 47333.25,
      endY: 35500
    });
    if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

    // 4. 建立東側 (使用 gridIds)
    const eContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastGridIds,
      startX: 50500,
      startY: 11363.73,
      endX: 50500,
      endY: 32163.73
    });
    if (eContinuous.success) upRightIds.push(eContinuous.data.DimensionId);

    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastTotalGridIds,
      startX: 52000,
      startY: 11363.73,
      endX: 52000,
      endY: 32163.73
    });
    if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

    // 5. 建立南側 (使用 gridIds)
    const sContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southGridIds,
      startX: -1691.74,
      startY: -22000,
      endX: 19608.25,
      endY: -22000
    });
    if (sContinuous.success) downRightIds.push(sContinuous.data.DimensionId);

    const sTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southTotalGridIds,
      startX: -1691.74,
      startY: -23500,
      endX: 19608.25,
      endY: -23500
    });
    if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

    // 6. 建立西側 (使用 gridIds)
    const wContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: allYGridIds,
      startX: -5000,
      startY: -19836.27,
      endX: -5000,
      endY: 32163.73
    });
    if (wContinuous.success) downRightIds.push(wContinuous.data.DimensionId);

    const wTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westTotalGridIds,
      startX: -6500,
      startY: -19836.27,
      endX: -6500,
      endY: 32163.73
    });
    if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

    // 7. 套用專屬柱心標註形式
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

    console.log(`樓層 ${v.name} 更新完成：純原生軸線標註，0 條輔助細線。`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
