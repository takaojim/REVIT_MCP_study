import { RevitSocketClient } from '../../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-grid-coords-5story';
  await client.connect();

  const viewId = 695; // 2FL
  const typeIdUpRight = 2240793; // TABC-DIM_*/ S 2.5-柱心-上右

  // 清除 2FL 舊標註
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of oldDims.data?.Elements || []) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {}
  }

  // 1. 北側連續軸線 (A -> H)
  // A (586428), B (586421), C (586414), D (432924), E (432845), F (192192), G (786156), H (2110013)
  const northCont = [586428, 586421, 586414, 432924, 432845, 192192, 786156, 2110013];
  const northTotal = [586428, 2110013];

  const topY_tier1 = 38363.7 - 650.0;
  const topY_tier2 = 38363.7 - 1300.0;

  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northTotal,
    startX: 53583.25,
    startY: topY_tier1,
    endX: -11441.74,
    endY: topY_tier1,
    typeId: typeIdUpRight
  });
  console.log('北側總跨:', nTotal.data);

  const nCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northCont,
    startX: 53583.25,
    startY: topY_tier2,
    endX: -11441.74,
    endY: topY_tier2,
    typeId: typeIdUpRight
  });
  console.log('北側柱間距:', nCont.data);

  // 2. 東側連續軸線 (5 -> 8 或 1 -> 8)
  // 1 (192066), 2 (432966), 3 (432630), 4 (586498), 5 (586507), 6 (586516), 7 (2109573), 8 (1353259)
  const eastCont = [192066, 432966, 432630, 586498, 586507, 586516, 2109573, 1353259];
  const eastTotal = [192066, 1353259];

  const rightX_tier1 = 53583.25 - 650.0;
  const rightX_tier2 = 53583.25 - 1300.0;

  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastTotal,
    startX: rightX_tier1,
    startY: -26086.27,
    endX: rightX_tier1,
    endY: 38363.7,
    typeId: typeIdUpRight
  });
  console.log('東側總跨:', eTotal.data);

  const eCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastCont,
    startX: rightX_tier2,
    startY: -26086.27,
    endX: rightX_tier2,
    endY: 38363.7,
    typeId: typeIdUpRight
  });
  console.log('東側柱間距:', eCont.data);

  // 確保標註型式為 TABC-DIM_*/ S 2.5-柱心-上右
  const dimIds = [nTotal.data?.DimensionId, nCont.data?.DimensionId, eTotal.data?.DimensionId, eCont.data?.DimensionId].filter(Boolean);
  for (const id of dimIds) {
    await client.sendCommand('change_element_type', {
      elementId: id,
      typeId: typeIdUpRight
    });
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
