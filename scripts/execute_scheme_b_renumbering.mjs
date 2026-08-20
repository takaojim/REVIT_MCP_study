import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 讀取 2FL 實際放置房間並建立幾何邊界資訊 ===');
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rawRooms = roomsRes.data.Rooms || [];
  console.log(`2FL 共有 ${rawRooms.length} 個已放置房間。`);

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

  const uniqueRooms = Array.from(new Map(rooms.map(r => [r.elementId, r])).values());

  // === 方案 B 空間區域劃分與單元排序演算法 ===
  const zone1 = []; // 北側病房 Y >= 23000
  const zone2 = []; // 中段公共區 12000 <= Y < 23000
  const zone3 = []; // 梯廳門廳區 5000 <= Y < 12000
  const zone4 = []; // 南側病房區 Y < 5000

  for (const r of uniqueRooms) {
    if (r.centerY >= 23000) zone1.push(r);
    else if (r.centerY >= 12000) zone2.push(r);
    else if (r.centerY >= 5000) zone3.push(r);
    else zone4.push(r);
  }

  // --- Zone 1 排序：北側病房區單元成組 (由西至東 X 增加；每個單元內 Y 由大到小：主空間/寢室先，浴廁後) ---
  function sortZoneIntoBays(zoneRooms, xBayTolerance = 2500) {
    const sortedByX = [...zoneRooms].sort((a,b) => a.centerX - b.centerX);
    const bays = [];

    for (const rm of sortedByX) {
      let placed = false;
      for (const bay of bays) {
        const avgX = bay.reduce((sum, r) => sum + r.centerX, 0) / bay.length;
        if (Math.abs(rm.centerX - avgX) <= xBayTolerance) {
          bay.push(rm);
          placed = true;
          break;
        }
      }
      if (!placed) bays.push([rm]);
    }

    bays.sort((a, b) => {
      const avgA = a.reduce((sum, r) => sum + r.centerX, 0) / a.length;
      const avgB = b.reduce((sum, r) => sum + r.centerX, 0) / b.length;
      return avgA - avgB;
    });

    // 每個 bay 內部：Y 由大到小 (上方主空間先，下方附屬/浴廁後)
    bays.forEach(bay => bay.sort((a, b) => b.centerY - a.centerY));

    return bays.flat();
  }

  // --- Zone 4 排序：南側病房區 (由北到南每排 Y 遞減；同排由西到東，單元內主寢室先、浴廁後) ---
  function sortSouthWing(zoneRooms) {
    const rows = [];
    const sortedY = [...zoneRooms].sort((a,b) => b.centerY - a.centerY);
    for (const rm of sortedY) {
      let placed = false;
      for (const row of rows) {
        if (Math.abs(rm.centerY - row[0].centerY) <= 2200) {
          row.push(rm);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([rm]);
    }
    rows.sort((a,b) => b[0].centerY - a[0].centerY);
    rows.forEach(r => r.sort((a,b) => a.centerX - b.centerX));
    return rows.flat();
  }

  // --- Zone 2 & Zone 3 (公共與梯廳區)：由上到下、由左到右 ---
  function sortGeneralZone(zoneRooms, yTol = 2500) {
    const rows = [];
    const sortedY = [...zoneRooms].sort((a,b) => b.centerY - a.centerY);
    for (const rm of sortedY) {
      let placed = false;
      for (const row of rows) {
        if (Math.abs(rm.centerY - row[0].centerY) <= yTol) {
          row.push(rm);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([rm]);
    }
    rows.sort((a,b) => b[0].centerY - a[0].centerY);
    rows.forEach(r => r.sort((a,b) => a.centerX - b.centerX));
    return rows.flat();
  }

  const sortedZ1 = sortZoneIntoBays(zone1, 2500);
  const sortedZ2 = sortGeneralZone(zone2, 2500);
  const sortedZ3 = sortGeneralZone(zone3, 2500);
  const sortedZ4 = sortSouthWing(zone4);

  const allSorted = [...sortedZ1, ...sortedZ2, ...sortedZ3, ...sortedZ4];

  // 產生新編號 (從 F201 開始)
  const plan = [];
  let idx = 1;
  for (const rm of allSorted) {
    const numStr = String(idx).padStart(2, '0');
    const newNumber = `F2${numStr}`;
    plan.push({
      index: idx,
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      tempNumber: `_TMP_SCH_B_${rm.elementId}`,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY),
      area: rm.area
    });
    idx++;
  }

  console.log('\n=== 2. 階段一：寫入唯一臨時編號 (解除衝突) ===');
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: item.tempNumber
    });
    if ((i + 1) % 20 === 0 || i === plan.length - 1) {
      console.log(`   臨時編號進度: ${i + 1}/${plan.length}`);
    }
  }

  console.log('\n=== 3. 階段二：依方案 B 指派新編號 (F201 ~ F286) ===');
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
      console.log(`   正式編號進度: ${i + 1}/${plan.length}`);
    }
  }

  console.log('\n=== 4. 驗證 2FL 房間編號 ===');
  const verifyRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const checkRooms = verifyRes.data.Rooms || [];
  console.log(`驗證完成：2FL 共 ${checkRooms.length} 間房間已全部完成編號！`);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
