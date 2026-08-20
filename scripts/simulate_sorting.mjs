import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];

  const rooms = [];
  for (const r of rawRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    rooms.push({
      elementId: r.ElementId,
      name: r.Name,
      oldNumber: r.Number,
      area: r.Area,
      centerX: info.data?.CenterX ?? r.CenterX,
      centerY: info.data?.CenterY ?? r.CenterY,
      bbox: info.data?.BoundingBox
    });
  }

  // 去重
  const uniqueRooms = Array.from(new Map(rooms.map(r => [r.elementId, r])).values());

  // 測試不同 Y 分列方式
  // 方案 A: 嚴格依 BoundingBox MaxY / CenterY，容差 1200mm (避免跨層混排)
  // 方案 B: 上排 (寢室/大空間) -> 下排 (浴廁/附屬空間)
  
  console.log('\n--- 分析 2FL Y 座標分佈 ---');
  const yValues = uniqueRooms.map(r => Math.round(r.centerY)).sort((a,b) => b - a);
  console.log('Top 20 Y coords:', yValues.slice(0, 20));

  function testTolerance(tol) {
    const rows = [];
    const sortedY = [...uniqueRooms].sort((a,b) => b.centerY - a.centerY);
    for (const rm of sortedY) {
      let placed = false;
      for (const row of rows) {
        // 固定以 row[0] (該排最上方房間) 作為基準，避免滾雪球
        if (Math.abs(rm.centerY - row[0].centerY) <= tol) {
          row.push(rm);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([rm]);
    }
    rows.sort((a, b) => b[0].centerY - a[0].centerY);
    rows.forEach(r => r.sort((a, b) => a.centerX - b.centerX));
    return rows.flat();
  }

  const res1200 = testTolerance(1500);
  console.log('\n=== 容差 1500mm (以排首基準) 前 15 間 ===');
  res1200.slice(0, 15).forEach((r, i) => {
    console.log(`${i+1}. [F2${String(i+1).padStart(2,'0')}] ${r.name} (X: ${Math.round(r.centerX)}, Y: ${Math.round(r.centerY)})`);
  });

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
