import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-dims-2fl';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 取得 2FL 軸線與 8 間距齊頭資訊
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 8.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  const bounds = alignRes.data.AlignmentBoundsMm;
  console.log('2FL Bounds:', bounds);

  // 2. 查詢 2FL 上所有垂直與水平軸線
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const allGrids = gridsRes.data?.Elements || [];
  console.log(`2FL 軸線清單 (${allGrids.length} 條):`);
  for (const g of allGrids) {
    console.log(`  - ${g.Name} (ID: ${g.ElementId})`);
  }

  // 垂直軸線: D (611573), C (432924), B (432845), A (192192) -> 由東至西 (由右至左)
  const northContinuous = [611573, 432924, 432845, 192192];
  const northTotal = [611573, 192192];

  // 水平軸線: 1 (192066), 2 (432966), 3 (432630), 4 (596080) -> 由南至北 (由下至上)
  const eastContinuous = [192066, 432966, 432630, 596080];
  const eastTotal = [192066, 596080];

  // 刪除 2FL 上現有的尺寸標註
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of dimsRes.data?.Elements || []) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {}
  }

  // 距離圓標基準線 (bounds.TopY, bounds.RightX) 向建物方向等距退縮
  // Tier 1 (外層總跨): 距圓標 650mm (圖紙 6.5mm)
  // Tier 2 (內層柱間距): 距圓標 1300mm (圖紙 13.0mm，距 Tier 1 650mm)
  const topY_tier1 = bounds.TopY - 650.0;
  const topY_tier2 = bounds.TopY - 1300.0;

  const rightX_tier1 = bounds.RightX - 650.0;
  const rightX_tier2 = bounds.RightX - 1300.0;

  console.log(`\n=== 建立 2FL 上方 (北側) 柱心標註 ===`);
  console.log(`- Tier 1 (總跨) Y = ${topY_tier1.toFixed(1)} mm`);
  console.log(`- Tier 2 (柱間距) Y = ${topY_tier2.toFixed(1)} mm`);

  // 北側 Tier 1: 總跨 (由右至左 D -> A)
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northTotal,
    startX: bounds.RightX,
    startY: topY_tier1,
    endX: bounds.LeftX,
    endY: topY_tier1
  });
  console.log('北側總跨標註結果:', nTotal.data);

  // 北側 Tier 2: 連續柱間距 (由右至左 D -> C -> B -> A)
  const nContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northContinuous,
    startX: bounds.RightX,
    startY: topY_tier2,
    endX: bounds.LeftX,
    endY: topY_tier2
  });
  console.log('北側柱間距標註結果:', nContinuous.data);

  console.log(`\n=== 建立 2FL 右側 (東側) 柱心標註 ===`);
  console.log(`- Tier 1 (總跨) X = ${rightX_tier1.toFixed(1)} mm`);
  console.log(`- Tier 2 (柱間距) X = ${rightX_tier2.toFixed(1)} mm`);

  // 東側 Tier 1: 總跨 (由下至上 1 -> 4)
  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastTotal,
    startX: rightX_tier1,
    startY: bounds.BottomY,
    endX: rightX_tier1,
    endY: bounds.TopY
  });
  console.log('東側總跨標註結果:', eTotal.data);

  // 東側 Tier 2: 連續柱間距 (由下至上 1 -> 2 -> 3 -> 4)
  const eContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastContinuous,
    startX: rightX_tier2,
    startY: bounds.BottomY,
    endX: rightX_tier2,
    endY: bounds.TopY
  });
  console.log('東側柱間距標註結果:', eContinuous.data);

  // 套用專屬標註型式 TABC 柱心-上右 (若有的話)
  const dimTypesRes = await client.sendCommand('query_elements', { category: 'DimensionTypes' });
  const typeUpRight = dimTypesRes.data?.Elements?.find(t => t.Name.includes('柱心-上右') || t.Name.includes('上右'));
  if (typeUpRight) {
    console.log(`\n找到上右標註型式: ${typeUpRight.Name} (ID: ${typeUpRight.ElementId})`);
    const createdDimIds = [nTotal.data?.DimensionId, nContinuous.data?.DimensionId, eTotal.data?.DimensionId, eContinuous.data?.DimensionId].filter(Boolean);
    for (const dId of createdDimIds) {
      try {
        await client.sendCommand('change_element_type', {
          elementId: dId,
          typeId: typeUpRight.ElementId
        });
      } catch (e) {}
    }
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
