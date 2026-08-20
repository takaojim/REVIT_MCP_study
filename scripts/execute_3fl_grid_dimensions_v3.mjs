import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL 平面圖

  console.log('=== 1. 切換至 3FL 視圖 (ViewId: 428158) ===');
  await client.sendCommand('set_active_view', { viewId: viewId });

  // 取得標註型式 ID
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];
  
  const upRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-上右'));
  const downRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-下右'));

  const typeIdUpRight = upRightType ? upRightType.DimensionTypeId : 2240793;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = downRightType ? downRightType.DimensionTypeId : 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  // 2. 清除 3FL 視圖上的所有既有尺寸標註與細線
  console.log('=== 2. 清除 3FL 舊有尺寸標註與細線 ===');
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  if (dimsRes.data?.Elements) {
    let deletedCount = 0;
    for (const d of dimsRes.data.Elements) {
      try {
        await client.sendCommand('delete_element', { elementId: d.ElementId });
        deletedCount++;
      } catch (e) {}
    }
    console.log(`[清理完成] 已刪除 3FL 上 ${deletedCount} 道舊標註。`);
  }

  const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId });
  if (linesRes.data?.Elements) {
    for (const line of linesRes.data.Elements) {
      try { await client.sendCommand('delete_element', { elementId: line.ElementId }); } catch (e) {}
    }
  }

  // 3. 完全比照 2FL 樣板的 4 側標註設定 (Grid IDs & 外推邊界座標)
  // 北側 (Top/North): Grid G ~ Grid A (G, F, E, D, C, B, A)
  const northGridIdsContinuous = [786156, 192192, 432845, 432924, 586414, 586421, 586428];
  const northGridIdsTotal = [786156, 586428];

  // 西側 (Left/West): Grid 1 ~ Grid 7 (1, 2, 3, 4, 5, 6, 2109573)
  const westGridIdsContinuous = [192066, 432966, 432630, 586498, 586507, 586516, 2109573];
  const westGridIdsTotal = [192066, 2109573];

  // 南側 (Bottom/South): Grid G ~ Grid D (G, F, E, D)
  const southGridIdsContinuous = [786156, 192192, 432845, 432924];
  const southGridIdsTotal = [786156, 432924];

  // 東側 (Right/East): Grid 5 ~ Grid 7 (5, 6, 2109573)
  const eastGridIdsContinuous = [586507, 586516, 2109573];
  const eastGridIdsTotal = [586507, 2109573];

  const upRightIds = [];
  const downRightIds = [];

  console.log('=== 3. 比照 2FL 實作 3FL 四側柱心標註 (正確邊界與外推距離) ===');

  // 北側 (上方): 往上推至建築外部 (內層 Y=34000, 外層 Y=35500)
  // 由右至左 (A -> G), 指向建物朝下 ⬇️
  const nContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northGridIdsContinuous,
    startX: 47333.25, startY: 34000,
    endX: -1691.74, endY: 34000
  });
  if (nContinuous.success) upRightIds.push(nContinuous.data.DimensionId);

  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northGridIdsTotal,
    startX: 47333.25, startY: 35500,
    endX: -1691.74, endY: 35500
  });
  if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

  // 西側 (左側): 往左推至建築外部 (內層 X=-5000, 外層 X=-6500)
  // 由上至下 (7 -> 1), 指向建物朝右 ➡️
  const wContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westGridIdsContinuous,
    startX: -5000, startY: 29913.73,
    endX: -5000, endY: -19836.27
  });
  if (wContinuous.success) downRightIds.push(wContinuous.data.DimensionId);

  const wTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westGridIdsTotal,
    startX: -6500, startY: 29913.73,
    endX: -6500, endY: -19836.27
  });
  if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

  // 南側 (下方): 往下推至建築外部 (內層 Y=-22000, 外層 Y=-23500)
  // 由左至右 (G -> D), 指向建物朝上 ⬆️
  const sContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southGridIdsContinuous,
    startX: -1691.74, startY: -22000,
    endX: 19608.25, endY: -22000
  });
  if (sContinuous.success) downRightIds.push(sContinuous.data.DimensionId);

  const sTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southGridIdsTotal,
    startX: -1691.74, startY: -23500,
    endX: 19608.25, endY: -23500
  });
  if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

  // 東側 (右側): 往右推至東翼外部 (內層 X=50500, 外層 X=52000)
  // 由下至上 (5 -> 7), 指向建物朝左 ⬅️
  const eContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastGridIdsContinuous,
    startX: 50500, startY: 11363.73,
    endX: 50500, endY: 29913.73
  });
  if (eContinuous.success) upRightIds.push(eContinuous.data.DimensionId);

  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastGridIdsTotal,
    startX: 52000, startY: 11363.73,
    endX: 52000, endY: 29913.73
  });
  if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

  // 4. 套用標註型式 (上右 / 下右)
  console.log('=== 4. 套用正確柱心標註型式 ===');
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

  console.log('\n========================================');
  console.log('🎉 3FL 柱間距標註已完全 100% 照抄 2FL 標準重新建立！');
  console.log('========================================');

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
