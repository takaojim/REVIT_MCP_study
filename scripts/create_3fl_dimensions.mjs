import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL 平面視圖
  const createdDimensions = [];

  console.log('=== 1. 建立 3FL 柱列與外圍跨距尺寸標註 ===');

  // 1. 3FL 頂部 X 軸總尺寸 (Top Overall X)
  const topOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 1070,
    startY: 10500,
    endX: 7516,
    endY: 10500,
    offset: 800
  });
  if (topOverall.success) {
    createdDimensions.push({ type: '外圍柱列總長(X向)', ...topOverall.data });
  }

  // 2. 3FL 右側 Y 軸總尺寸 (Right Overall Y)
  const rightOverall = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 7800,
    startY: -5221,
    endX: 7800,
    endY: 10500,
    offset: 800
  });
  if (rightOverall.success) {
    createdDimensions.push({ type: '外圍柱列總長(Y向)', ...rightOverall.data });
  }

  // 3. 3FL 左側分段尺寸 (Left Y Sections)
  // 分段：-5221 到 2660 (下段區間), 2660 到 6912 (中段區間), 6912 到 10500 (上段區間)
  const leftSec1 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 800,
    startY: -5221,
    endX: 800,
    endY: 2660,
    offset: 400
  });
  if (leftSec1.success) {
    createdDimensions.push({ type: '柱列分段(南側進深)', ...leftSec1.data });
  }

  const leftSec2 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 800,
    startY: 2660,
    endX: 800,
    endY: 10500,
    offset: 400
  });
  if (leftSec2.success) {
    createdDimensions.push({ type: '柱列分段(北側進深)', ...leftSec2.data });
  }

  console.log('=== 2. 建立 3FL 各房間牆中心尺寸標註 ===');

  // 取 3FL 上的獨立房間清單
  const targetRooms = [
    { name: '客廳/住宅', roomId: 990820, minX: 1316.79, maxX: 7066.74, minY: 7664.56, maxY: 10240, centerX: 2939, centerY: 8952 },
    { name: '安全梯', roomId: 990824, minX: 1316.79, maxX: 4899.73, minY: 5734.56, maxY: 7664.56, centerX: 2410, centerY: 6912 },
    { name: '浴廁', roomId: 990830, minX: 4899.73, maxX: 6916.74, minY: 5734.56, maxY: 7664.56, centerX: 5898, centerY: 6578 },
    { name: '走廊', roomId: 990827, minX: 2877.88, maxX: 6430.41, minY: 3819.62, maxY: 5734.56, centerX: 4667, centerY: 4777 },
    { name: '6人份電梯', roomId: 1567342, minX: 2876.75, maxX: 5081.06, minY: 1633.61, maxY: 3819.62, centerX: 3915, centerY: 2779 },
    { name: '陽台(北)', roomId: 990833, minX: 5776.89, maxX: 7416.74, minY: 2856.28, maxY: 5574.56, centerX: 6841, centerY: 4151 },
    { name: '住宅/廚房', roomId: 990839, minX: 1316.79, maxX: 7066.74, minY: -2853.02, maxY: 2660.83, centerX: 5489, centerY: -659 },
    { name: '陽台(南)', roomId: 990871, minX: 1092.59, maxX: 7066.74, minY: -3721.14, maxY: -3003.02, centerX: 4027, centerY: -3405 },
    { name: '二次-廚房', roomId: 1801569, minX: 1375.07, maxX: 6916.74, minY: -5221.14, maxY: -3721.14, centerX: 3915, centerY: -4471 },
    { name: '二次-陽台', roomId: 1801572, minX: 7066.74, maxX: 7516.74, minY: -5221.14, maxY: -2621.14, centerX: 7322, centerY: -3921 }
  ];

  for (const r of targetRooms) {
    // X 向房間淨寬 (通過房間 CenterY)
    const dimX = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: r.minX,
      startY: r.centerY,
      endX: r.maxX,
      endY: r.centerY,
      offset: 0
    });

    // Y 向房間淨深 (通過房間 CenterX)
    const dimY = await client.sendCommand('create_dimension', {
      viewId: viewId,
      startX: r.centerX,
      startY: r.minY,
      endX: r.centerX,
      endY: r.maxY,
      offset: 0
    });

    if (dimX.success) {
      createdDimensions.push({
        room: r.name,
        direction: 'X向淨寬',
        valueMm: dimX.data?.Value,
        dimensionId: dimX.data?.DimensionId
      });
    }
    if (dimY.success) {
      createdDimensions.push({
        room: r.name,
        direction: 'Y向淨深',
        valueMm: dimY.data?.Value,
        dimensionId: dimY.data?.DimensionId
      });
    }
  }

  console.log(`\n🎉 標註完成！共建立 ${createdDimensions.length} 條尺寸標註：`);
  console.log(JSON.stringify(createdDimensions, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
