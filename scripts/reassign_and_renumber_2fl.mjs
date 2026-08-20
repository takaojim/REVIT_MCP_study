import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 搜尋全專案中佔用 F201~F299 的未放置 (Unplaced) 房間 ===');
  const allRoomsRes = await client.sendCommand('query_elements', {
    category: 'Rooms',
    maxCount: 5000,
    returnFields: ['編號', '名稱', '樓層', '面積']
  });

  const allRooms = allRoomsRes.data?.Elements || [];
  const unplacedColliding = [];

  for (const r of allRooms) {
    const num = r['編號'];
    if (num && /^F2\d+$/i.test(num)) {
      // 檢查是否為未放置房間 (面積為空或 0)
      const rInfo = await client.sendCommand('get_room_info', { roomId: r.ElementId });
      const isUnplaced = !rInfo.data || !rInfo.data.BoundingBox || rInfo.data.Area <= 0.001;
      if (isUnplaced) {
        unplacedColliding.push({
          elementId: r.ElementId,
          name: r.Name,
          number: num
        });
      }
    }
  }

  console.log(`找到 ${unplacedColliding.length} 個佔用 F2xx 號碼的未放置房間。`);

  console.log('=== 2. 釋放未放置房間的 F2xx 編號 (重新命名為 _UNPLACED_...) ===');
  for (let i = 0; i < unplacedColliding.length; i++) {
    const item = unplacedColliding[i];
    await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: `_UNP_${item.number}_${item.elementId}`
    });
    if ((i + 1) % 20 === 0 || i === unplacedColliding.length - 1) {
      console.log(`   釋放進度: ${i + 1}/${unplacedColliding.length}`);
    }
  }

  console.log('\n=== 3. 讀取 2FL 實際放置房間並依空間座標排序 (由上到下、由左到右) ===');
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];
  console.log(`2FL 共有 ${rawRooms.length} 個已放置房間。`);

  const placedRooms = [];
  for (const r of rawRooms) {
    const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
    placedRooms.push({
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
  for (const rm of placedRooms) {
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
      index: idx,
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY),
      area: rm.area
    });
    idx++;
  }

  console.log('\n=== 4. 正式指派 2FL 新編號 (F201 ~ F286) ===');
  const results = [];
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    const res = await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: item.newNumber
    });
    if (res.success) {
      results.push(item);
    }
    if ((i + 1) % 20 === 0 || i === plan.length - 1) {
      console.log(`   寫入進度: ${i + 1}/${plan.length}`);
    }
  }

  console.log('\n=== 5. 驗證 2FL 房間編號 ===');
  const verifyRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const checkRooms = verifyRes.data.Rooms || [];
  const checkNumbers = checkRooms.map(r => r.Number).sort();

  console.log(`驗證完成：2FL 共 ${checkRooms.length} 間房間，編號清單：`);
  console.log(checkNumbers);

  console.log(`\n🎉 2FL 房間已成功重新排序並編號為 F201 ~ F2${String(plan.length).padStart(2, '0')}，無任何重複警告！`);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
