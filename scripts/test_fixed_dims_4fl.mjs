import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'fix-dims-4fl';
  await client.connect();

  const viewId = 624294; // 4FL

  // 1. 取得 4FL 8間距齊頭範圍
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 8.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });
  const bounds = alignRes.data.AlignmentBoundsMm;
  console.log('4FL 齊頭範圍:', bounds);

  // 2. 刪除 4FL 上現有尺寸
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
  for (const d of oldDims.data?.Elements || []) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {}
  }

  // 3. 正確的軸線配置：
  // 北側 (上方，水平尺寸線) -> 測量南北向垂直軸線: 4, 3, 2, 1 (由右至左: 4 -> 1)
  const northContinuous = [596080, 432630, 432966, 192066]; // 4 -> 3 -> 2 -> 1
  const northTotal = [596080, 192066]; // 4, 1

  // 東側 (右側，垂直尺寸線) -> 測量東西向水平軸線: D, C, B, A (由下至上: D -> A)
  const eastContinuous = [611573, 432924, 432845, 192192]; // D -> C -> B -> A
  const eastTotal = [611573, 192192]; // D, A

  const topY_tier1 = bounds.TopY - 650.0;
  const topY_tier2 = bounds.TopY - 1300.0;

  const rightX_tier1 = bounds.RightX - 650.0;
  const rightX_tier2 = bounds.RightX - 1300.0;

  console.log('\n=== 建立 4FL 北側 (上方) 柱心標註 ===');
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northTotal,
    startX: bounds.RightX,
    startY: topY_tier1,
    endX: bounds.LeftX,
    endY: topY_tier1
  });
  console.log('北側總跨:', nTotal.data);

  const nCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: northContinuous,
    startX: bounds.RightX,
    startY: topY_tier2,
    endX: bounds.LeftX,
    endY: topY_tier2
  });
  console.log('北側柱間距:', nCont.data);

  console.log('\n=== 建立 4FL 東側 (右側) 柱心標註 ===');
  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastTotal,
    startX: rightX_tier1,
    startY: bounds.BottomY,
    endX: rightX_tier1,
    endY: bounds.TopY
  });
  console.log('東側總跨:', eTotal.data);

  const eCont = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: eastContinuous,
    startX: rightX_tier2,
    startY: bounds.BottomY,
    endX: rightX_tier2,
    endY: bounds.TopY
  });
  console.log('東側柱間距:', eCont.data);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
