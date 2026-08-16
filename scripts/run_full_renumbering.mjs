import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 讀取 3FL 所有房間並進行空間座標排序 ===');
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  const rooms = [];

  for (const r of roomsRes.data.Rooms) {
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
  console.log(`3FL 共有 ${uniqueRooms.length} 個有效房間。`);

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

  // 產生新編號 (從 F301 開始)
  const plan = [];
  let idx = 1;
  for (const rm of sortedRooms) {
    const numStr = String(idx).padStart(2, '0');
    const newNumber = `F3${numStr}`;
    plan.push({
      index: idx,
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      tempNumber: `TMP_REN_3FL_${rm.elementId}`,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY),
      area: rm.area
    });
    idx++;
  }

  console.log(`\n=== 2. 階段一：寫入唯一臨時編號 (消除衝突) ===`);
  for (const item of plan) {
    await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: item.tempNumber
    });
  }

  console.log(`\n=== 3. 階段二：依序寫入新編號 (F301 ~ F3${String(plan.length).padStart(2, '0')}) ===`);
  const finalResults = [];
  for (const item of plan) {
    const res = await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: item.newNumber
    });
    if (res.success) {
      finalResults.push({
        序號: item.index,
        房間ID: item.elementId,
        房間名稱: item.name,
        原編號: item.oldNumber,
        新編號: item.newNumber,
        X座標: item.centerX,
        Y座標: item.centerY,
        面積: item.area
      });
    }
  }

  console.log(`\n🎉 3FL 房間重新編號全部完成！共編排 ${finalResults.length} 個房間：`);
  console.table(finalResults);

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
