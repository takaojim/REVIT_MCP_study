import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];
  console.log(`2FL 讀取到 ${rawRooms.length} 個房間。`);

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
    });
  }

  // 去重 (依 ElementId)
  const uniqueMap = new Map();
  for (const rm of rooms) {
    if (!uniqueMap.has(rm.elementId)) {
      uniqueMap.set(rm.elementId, rm);
    }
  }
  const uniqueRooms = Array.from(uniqueMap.values());

  // 排序邏輯：由上到下 (Y 由大到小)、同排由左到右 (X 由小到大)
  const rowTolerance = 3000; // 3公尺排容差
  const rows = [];
  uniqueRooms.sort((a, b) => b.centerY - a.centerY);

  for (const rm of uniqueRooms) {
    let placed = false;
    for (const row of rows) {
      const avgY = row.reduce((sum, r) => sum + r.centerY, 0) / row.length;
      if (Math.abs(rm.centerY - avgY) <= rowTolerance) {
        row.push(rm);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([rm]);
  }

  // 排列各 row：由上到下
  rows.sort((a, b) => {
    const avgA = a.reduce((sum, r) => sum + r.centerY, 0) / a.length;
    const avgB = b.reduce((sum, r) => sum + r.centerY, 0) / b.length;
    return avgB - avgA;
  });

  // 各 row 內：由左到右
  rows.forEach(r => r.sort((a, b) => a.centerX - b.centerX));

  const sortedRooms = rows.flat();

  // 產生新編號 (從 F201 開始)
  const plan = [];
  let idx = 1;
  for (const rm of sortedRooms) {
    const numStr = String(idx).padStart(2, '0');
    const newNumber = `F2${numStr}`;
    plan.push({
      序號: idx,
      房間ID: rm.elementId,
      房間名稱: rm.name,
      原編號: rm.oldNumber,
      新編號: newNumber,
      X: Math.round(rm.centerX),
      Y: Math.round(rm.centerY),
      面積: rm.area
    });
    idx++;
  }

  console.log(JSON.stringify({
    total: plan.length,
    startNumber: plan[0]?.新編號,
    endNumber: plan[plan.length - 1]?.新編號,
    plan: plan
  }, null, 2));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
