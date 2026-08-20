import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  // 1. 動態取得標註型式 ID
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypes = dimTypesRes.data?.DimensionTypes || [];
  
  const upRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-上右'));
  const downRightType = dimTypes.find(t => t.DimensionTypeName.includes('柱心-下右'));

  const typeIdUpRight = upRightType ? upRightType.DimensionTypeId : 2240793;   // TABC-DIM_*/ S 2.5-柱心-上右
  const typeIdDownRight = downRightType ? downRightType.DimensionTypeId : 2240801; // TABC-DIM_*/ S 2.5-柱心-下右

  console.log(`[型式對應] 上右型式 ID: ${typeIdUpRight} (${upRightType?.DimensionTypeName || '未找到'}), 下右型式 ID: ${typeIdDownRight} (${downRightType?.DimensionTypeName || '未找到'})`);

  // Grid IDs & 方位向量定義 (包含 H 軸 2110013 與 8 軸 1353259):
  // 北側 (由右至左: A -> H, 指向建物朝下 ⬇️)
  const northGridIdsContinuous = [586428, 586421, 586414, 432924, 432845, 192192, 786156, 2110013]; // A to H
  const northGridIdsTotal = [586428, 2110013]; // A to H

  // 東側 (由下至上: 5 -> 8, 指向建物朝左 ⬅️)
  const eastGridIdsContinuous = [586507, 586516, 2109573, 1353259]; // 5, 6, 7, 8
  const eastGridIdsTotal = [586507, 1353259]; // 5, 8

  // 南側 (由左至右: H -> D, 指向建物朝上 ⬆️)
  const southGridIdsContinuous = [2110013, 786156, 192192, 432845, 432924]; // H, G, F, E, D
  const southGridIdsTotal = [2110013, 432924]; // H, D

  // 西側 (由上至下: 8 -> 1, 指向建物朝右 ➡️)
  const westGridIdsContinuous = [1353259, 2109573, 586516, 586507, 586498, 432630, 432966, 192066]; // 8 to 1
  const westGridIdsTotal = [1353259, 192066]; // 8 to 1

  // 僅針對 3FL 單一視圖，其餘樓層不處理
  const targetViews = [
    { name: '3FL', viewId: 428158 }
  ];

  console.log('=== 僅針對 3FL 執行精準標註：第1條(圓圈底5mm)=柱心連續，第2條(再下5mm)=總長度 ===');

  for (const v of targetViews) {
    console.log(`\n----------------------------------------`);
    console.log(`正在處理視圖: ${v.name} (ViewId: ${v.viewId})`);

    // 1. 刪除 3FL 上所有既有尺寸標註
    const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: v.viewId });
    if (dimsRes.data?.Elements) {
      let deletedCount = 0;
      for (const d of dimsRes.data.Elements) {
        try {
          await client.sendCommand('delete_element', { elementId: d.ElementId });
          deletedCount++;
        } catch (e) {}
      }
      console.log(`[清理既有標註] 已刪除 ${deletedCount} 道舊尺寸標註。`);
    }

    // 2. 刪除 3FL 上的所有 DetailLines 輔助細線
    const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: v.viewId });
    if (linesRes.data?.Elements) {
      for (const line of linesRes.data.Elements) {
        try {
          await client.sendCommand('delete_element', { elementId: line.ElementId });
        } catch (e) {}
      }
    }

    const upRightIds = [];
    const downRightIds = [];

    // 3. 北側 (由右至左: A -> H, 指向建物朝下 ⬇️)
    // 第 1 條線 (貼近圓圈底 Y=38936) ➔ 柱心連續間距標註
    const nContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northGridIdsContinuous,
      startX: 47333.25, startY: 38936,
      endX: -3691.74, endY: 38936
    });
    if (nContinuous.success) upRightIds.push(nContinuous.data.DimensionId);

    // 第 2 條線 (第一條線下方 5mm Y=38436) ➔ 總長度標註
    const nTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: northGridIdsTotal,
      startX: 47333.25, startY: 38436,
      endX: -3691.74, endY: 38436
    });
    if (nTotal.success) upRightIds.push(nTotal.data.DimensionId);

    // 4. 東側 (由下至上: 5 -> 8, 指向建物朝左 ⬅️)
    // 第 1 條線 (貼近圓圈底 X=48500) ➔ 柱心連續間距標註
    const eContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastGridIdsContinuous,
      startX: 48500, startY: 11363.73,
      endX: 48500, endY: 34163.73
    });
    if (eContinuous.success) upRightIds.push(eContinuous.data.DimensionId);

    // 第 2 條線 (第一條線左方 5mm X=48000) ➔ 總長度標註
    const eTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: eastGridIdsTotal,
      startX: 48000, startY: 11363.73,
      endX: 48000, endY: 34163.73
    });
    if (eTotal.success) upRightIds.push(eTotal.data.DimensionId);

    // 5. 南側 (由左至右: H -> D, 指向建物朝上 ⬆️)
    // 第 1 條線 (貼近圓圈底 Y=-20500) ➔ 柱心連續間距標註
    const sContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southGridIdsContinuous,
      startX: -3691.74, startY: -20500,
      endX: 19608.25, endY: -20500
    });
    if (sContinuous.success) downRightIds.push(sContinuous.data.DimensionId);

    // 第 2 條線 (第一條線上條 5mm Y=-20000) ➔ 總長度標註
    const sTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: southGridIdsTotal,
      startX: -3691.74, startY: -20000,
      endX: 19608.25, endY: -20000
    });
    if (sTotal.success) downRightIds.push(sTotal.data.DimensionId);

    // 6. 西側 (由上至下: 8 -> 1, 指向建物朝右 ➡️)
    // 第 1 條線 (貼近圓圈底 X=-4500) ➔ 柱心連續間距標註
    const wContinuous = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westGridIdsContinuous,
      startX: -4500, startY: 34163.73,
      endX: -4500, endY: -19836.27
    });
    if (wContinuous.success) downRightIds.push(wContinuous.data.DimensionId);

    // 第 2 條線 (第一條線右方 5mm X=-4000) ➔ 總長度標註
    const wTotal = await client.sendCommand('create_dimension', {
      viewId: v.viewId,
      gridIds: westGridIdsTotal,
      startX: -4000, startY: 34163.73,
      endX: -4000, endY: -19836.27
    });
    if (wTotal.success) downRightIds.push(wTotal.data.DimensionId);

    // 7. 套用專屬柱心標註型式 (上右 / 下右)
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

    console.log(`[成功建立標註] 3FL 視圖標註重構完成！`);
  }

  console.log('\n========================================');
  console.log('🎉 3FL 單一視圖標註精準執行完成！');
  console.log('========================================');

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
