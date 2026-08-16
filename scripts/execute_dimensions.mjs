import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL

  // 1. Auto dimension walls (overall_bbox & chained)
  console.log('--- 1. Testing auto_dimension_walls (overall_bbox) ---');
  try {
    const resOverall = await client.sendCommand('auto_dimension_walls', {
      viewId: viewId,
      mode: 'overall_bbox',
      offsetMm: 2000
    });
    console.log('Overall BBox Result:', JSON.stringify(resOverall, null, 2));
  } catch (e) {
    console.error('Overall BBox Error:', e.message);
  }

  // 2. Auto dimension rooms (X and Y for each room)
  console.log('--- 2. Dimensioning Rooms on 3FL ---');
  const roomIds = [990820, 990824, 990827, 990830, 1567342, 990833, 990839, 990871, 1801569, 1801572];
  const roomResults = [];

  for (const rId of roomIds) {
    try {
      const dimX = await client.sendCommand('create_dimension_by_bounding_box', {
        viewId: viewId,
        roomId: rId,
        axis: 'X',
        offset: 600
      });
      const dimY = await client.sendCommand('create_dimension_by_bounding_box', {
        viewId: viewId,
        roomId: rId,
        axis: 'Y',
        offset: 600
      });
      roomResults.push({ roomId: rId, dimX: dimX?.data, dimY: dimY?.data });
    } catch (e) {
      console.error(`Room ${rId} error:`, e.message);
    }
  }

  console.log('Room Dimension Results Count:', roomResults.length);
  console.log('Room Dimension Results:', JSON.stringify(roomResults, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
