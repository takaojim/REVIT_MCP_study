import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL 平面圖

  console.log('=== 1. 切換至 3FL 視圖 (ViewId: 428158) ===');
  await client.sendCommand('set_active_view', { viewId: viewId });

  // 動態取得標註型式 ID
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];
  
  const upRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-上右'));
  const downRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-下右'));

  const typeIdUpRight = upRightType ? upRightType.DimensionTypeId : 2240793;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = downRightType ? downRightType.DimensionTypeId : 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  console.log(`[標註型式對應] 上右型式 ID: ${typeIdUpRight}, 下右型式 ID: ${typeIdDownRight}`);

  // 2. 清除 3FL 視圖上的所有既有尺寸標註與輔助細線
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

  // 3. 定義 Grid 軸線 (標準 A~H 與 1~8)
  const northGridIdsTotal = [586428, 2110013]; // A -> H
  const northGridIdsContinuous = [586428, 586421, 586414, 432924, 432845, 192192, 786156, 2110013]; // A to H

  const eastGridIdsTotal = [586507, 1353259]; // 5 -> 8
  const eastGridIdsContinuous = [586507, 586516, 2109573, 1353259]; // 5, 6, 7, 8

  const southGridIdsTotal = [2110013, 432924]; // H -> D
  const southGridIdsContinuous = [2110013, 786156, 192192, 432845, 432924]; // H to D

  const westGridIdsTotal = [1353259, 192066]; // 8 -> 1
  const westGridIdsContinuous = [1353259, 2109573, 586516, 586507, 586498, 432630, 432966, 192066]; // 8 to 1

  const upRightIds = [];
  const downRightIds = [];

  console.log('=== 3. 實作 3FL 柱心標註 (雙層同一線段、5mm鎖點、朝向內側) ===');

  // 北側 (上方): 由右至左 (A -> H), 輔助線朝下 ⬇️
  // 外層總長 (距圓圈底 5mm: Y = 38936)
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northGridIdsTotal,
    startX: 47333.25, startY: 38936,
    endX: -3691.74, endY: 38936
  });
  if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

  // 內層連續 (距第 1 條線 5mm: Y = 38436)
  const nContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northGridIdsContinuous,
    startX: 47333.25, startY: 38436,
    endX: -3691.74, endY: 38436
  });
  if (nContinuous.success) upRightIds.push(nContinuous.data.DimensionId);

  // 東側 (右側): 由下至上 (5 -> 8), 輔助線朝左 ⬅️
  // 外層總長 (X = 50210)
  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastGridIdsTotal,
    startX: 50210, startY: 11363.73,
    endX: 50210, endY: 32163.73
  });
  if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

  // 內層連續 (X = 49710)
  const eContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastGridIdsContinuous,
    startX: 49710, startY: 11363.73,
    endX: 49710, endY: 32163.73
  });
  if (eContinuous.success) upRightIds.push(eContinuous.data.DimensionId);

  // 南側 (下方): 由左至右 (H -> D), 輔助線朝上 ⬆️
  // 外層總長 (Y = -19612)
  const sTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southGridIdsTotal,
    startX: -3691.74, startY: -19612,
    endX: 19608.25, endY: -19612
  });
  if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

  // 內層連續 (Y = -19112)
  const sContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: southGridIdsContinuous,
    startX: -3691.74, startY: -19112,
    endX: 19608.25, endY: -19112
  });
  if (sContinuous.success) downRightIds.push(sContinuous.data.DimensionId);

  // 西側 (左側): 由上至下 (8 -> 1), 輔助線朝右 ➡️
  // 外層總長 (X = -11719)
  const wTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westGridIdsTotal,
    startX: -11719, startY: 32163.73,
    endX: -11719, endY: -19836.27
  });
  if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

  // 內層連續 (X = -11219)
  const wContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: westGridIdsContinuous,
    startX: -11219, startY: 32163.73,
    endX: -11219, endY: -19836.27
  });
  if (wContinuous.success) downRightIds.push(wContinuous.data.DimensionId);

  // 4. 套用柱心標註型式 (上右 / 下右)
  console.log('=== 4. 套用標註型式 (上右 / 下右) ===');
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
  console.log('🎉 3FL 柱間距標註已成功依 2FL 樣板標準重構完成！');
  console.log('========================================');

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
