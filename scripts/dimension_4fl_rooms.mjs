import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data.ElementId;
  console.log(`=== 1. 取得 4FL 平面視圖 (View ID: ${viewId}, 比例 1:${viewRes.data.Scale}) ===`);

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '4FL' });
  const rooms = roomsRes.data.Rooms || [];
  console.log(`4FL 共有 ${rooms.length} 間已放置房間。`);

  console.log('\n=== 2. 批次建立 4FL 房間 X/Y 雙向牆心淨尺寸標註 ===');
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    try {
      // 建立 X 向標註
      const dimX = await client.sendCommand('create_dimension_by_bounding_box', {
        viewId: viewId,
        roomId: r.ElementId,
        axis: 'X',
        offset: 400
      });

      // 建立 Y 向標註
      const dimY = await client.sendCommand('create_dimension_by_bounding_box', {
        viewId: viewId,
        roomId: r.ElementId,
        axis: 'Y',
        offset: 400
      });

      if (dimX.success && dimY.success) {
        successCount += 2;
        results.push({
          roomId: r.ElementId,
          number: r.Number,
          name: r.Name,
          dimX: dimX.data?.Value,
          dimY: dimY.data?.Value,
        });
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }

    if ((i + 1) % 15 === 0 || i === rooms.length - 1) {
      console.log(`   標註進度: ${i + 1}/${rooms.length} 間房間完成`);
    }
  }

  console.log(`\n=== 3. 標註完成摘要 ===`);
  console.log(`成功建立尺寸標註筆數: ${successCount} 條 (共 ${results.length} 間房間)`);
  console.log(`前 10 間房間標註尺寸成果：`);
  console.table(results.slice(0, 10).map(r => ({
    房號: r.number,
    名稱: r.name,
    'X向尺寸 (mm)': r.dimX,
    'Y向尺寸 (mm)': r.dimY
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
