import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  const rooms = [];
  for (const r of roomsRes.data.Rooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    rooms.push({
      elementId: r.ElementId,
      name: r.Name,
      oldNumber: r.Number,
      centerX: info.data?.CenterX ?? r.CenterX,
      centerY: info.data?.CenterY ?? r.CenterY,
    });
  }

  // De-duplicate rooms by ElementId
  const uniqueMap = new Map();
  for (const rm of rooms) {
    if (!uniqueMap.has(rm.elementId)) {
      uniqueMap.set(rm.elementId, rm);
    }
  }
  const uniqueRooms = Array.from(uniqueMap.values());
  console.log(`總計 3FL 房間數: ${uniqueRooms.length}`);

  // Sort: Top to Bottom (Y descending), grouped into rows
  const rowTolerance = 3000;
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

  rows.sort((a, b) => {
    const avgA = a.reduce((sum, r) => sum + r.centerY, 0) / a.length;
    const avgB = b.reduce((sum, r) => sum + r.centerY, 0) / b.length;
    return avgB - avgA;
  });
  rows.forEach(r => r.sort((a, b) => a.centerX - b.centerX));

  const sortedRooms = rows.flat();

  // Assign numbers starting from F301
  const plan = [];
  let idx = 1;
  for (const rm of sortedRooms) {
    const numStr = String(idx).padStart(2, '0');
    const newNumber = `F3${numStr}`;
    plan.push({
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      tempNumber: `_TMP_F3${numStr}`,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY)
    });
    idx++;
  }

  console.log(`\n=== 階段 1：設定臨時編號，避免編號衝突 ===`);
  for (const item of plan) {
    await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: 'Number',
      value: item.tempNumber
    });
  }

  console.log(`\n=== 階段 2：寫入最終連續編號 (F301 ~ F3${String(plan.length).padStart(2, '0')}) ===`);
  const successList = [];
  for (const item of plan) {
    const res = await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: 'Number',
      value: item.newNumber
    });
    if (res.success) {
      successList.push({
        elementId: item.elementId,
        name: item.name,
        oldNumber: item.oldNumber,
        newNumber: item.newNumber
      });
    }
  }

  console.log(`\n🎉 3FL 房間重新編號完成！共成功更新 ${successList.length} 個房間。`);
  console.table(successList.slice(0, 30));
  console.log(`... 還有 ${successList.length - 30} 個房間已完成編號。`);

  process.exit(0);
}

main().catch(err => {
  console.error('編號失敗:', err);
  process.exit(1);
});
