import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 取得 2FL 目前視圖與房間幾何資訊 ===');
  const activeView = await client.sendCommand('get_active_view', {});
  console.log(`目前視圖: ${activeView.data?.Name}, 樓層: ${activeView.data?.LevelName}`);

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
      minX: info.data?.BoundingBox?.MinX ?? r.CenterX,
      maxX: info.data?.BoundingBox?.MaxX ?? r.CenterX,
      minY: info.data?.BoundingBox?.MinY ?? r.CenterY,
      maxY: info.data?.BoundingBox?.MaxY ?? r.CenterY,
    });
  }

  // 去重 (依 ElementId)
  const uniqueRooms = Array.from(new Map(rooms.map(r => [r.elementId, r])).values());

  // === 2. 動線拓撲主從分區與單元成組演算法 ===
  // 劃分 4 大區域：
  // Zone 1: 北側病房區 (Y >= 23000)
  // Zone 2: 中段公共/休閒/衛浴套房區 (12000 <= Y < 23000)
  // Zone 3: 梯廳門廳公共區 (5000 <= Y < 12000)
  // Zone 4: 南側病房區 (Y < 5000)

  const z1 = uniqueRooms.filter(r => r.centerY >= 23000);
  const z2 = uniqueRooms.filter(r => r.centerY >= 12000 && r.centerY < 23000);
  const z3 = uniqueRooms.filter(r => r.centerY >= 5000 && r.centerY < 12000);
  const z4 = uniqueRooms.filter(r => r.centerY < 5000);

  // --- Zone 1 排序：北側病房區 (由西到東 X 增加；每個單元內 Y 由大到小：主居室先，浴廁後) ---
  function sortZone1Bays(zoneRooms) {
    const bays = [];
    const sortedX = [...zoneRooms].sort((a,b) => a.centerX - b.centerX);
    for (const rm of sortedX) {
      let placed = false;
      for (const bay of bays) {
        const avgX = bay.reduce((sum, r) => sum + r.centerX, 0) / bay.length;
        if (Math.abs(rm.centerX - avgX) <= 2500) {
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
    // 每個 bay 內 Y 由大到小 (北側進門由北向南)
    bays.forEach(bay => bay.sort((a, b) => b.centerY - a.centerY));
    return bays.flat();
  }

  // --- Zone 2 排序：中段公共與衛浴套房區 (動線主從：走廊進門外側先、內側浴室後) ---
  function sortZone2Topology(zoneRooms) {
    // 提取特定的前後室與套房單元
    // 1. 女浴單元: 女浴前室 + 女浴室 (X ~ 34798)
    // 2. 男浴單元: 男浴前室 + 男浴室 (X ~ 38300)
    // 3. B211 套房: 浴廁(門口) + 寢室【2床】 (X ~ 27500)
    // 4. B212 套房: 浴廁(門口) + 寢室【2床】 (X ~ 31000)
    // 5. 西側辦公/服務: 員工休息室, 病歷室, 準備室, 工作站, 配膳室, A區走廊
    // 6. 中央公共: 動態休閒區, 餐廳/交誼空間, 洗漱區, 無障礙廁所
    // 7. 東側交通: 儲藏室, B梯廳, B無障礙電梯, B安全梯

    // 依 X 開間成組
    const bays = [];
    const sortedX = [...zoneRooms].sort((a,b) => a.centerX - b.centerX);
    for (const rm of sortedX) {
      let placed = false;
      for (const bay of bays) {
        const avgX = bay.reduce((sum, r) => sum + r.centerX, 0) / bay.length;
        if (Math.abs(rm.centerX - avgX) <= 2600) {
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

    // 每個單元內：依動線由北向南（外側/前室/走廊門口側 Y 較大先 ➔ 內側浴室/後室 Y 較小後）
    bays.forEach(bay => bay.sort((a, b) => b.centerY - a.centerY));
    return bays.flat();
  }

  // --- Zone 3 排序：梯廳門廳公共區 (由上到下、由左到右) ---
  function sortZone3(zoneRooms) {
    const rows = [];
    const sortedY = [...zoneRooms].sort((a,b) => b.centerY - a.centerY);
    for (const rm of sortedY) {
      let placed = false;
      for (const row of rows) {
        if (Math.abs(rm.centerY - row[0].centerY) <= 2500) {
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

  // --- Zone 4 排序：南側病房區 (每排由北向南，同排由西向東，單元內主寢室先、附屬衛浴後) ---
  function sortZone4(zoneRooms) {
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

  const sortedZ1 = sortZone1Bays(z1);
  const sortedZ2 = sortZone2Topology(z2);
  const sortedZ3 = sortZone3(z3);
  const sortedZ4 = sortZone4(z4);

  const allSorted = [...sortedZ1, ...sortedZ2, ...sortedZ3, ...sortedZ4];
  console.log(`總計已排序房間數: ${allSorted.length}`);

  // 產生新編號 (從 F201 開始)
  const plan = [];
  let seq = 1;
  for (const rm of allSorted) {
    const numStr = String(seq).padStart(2, '0');
    const newNumber = `F2${numStr}`;
    plan.push({
      index: seq,
      elementId: rm.elementId,
      name: rm.name,
      oldNumber: rm.oldNumber,
      tempNumber: `_TMP_TOP_${rm.elementId}`,
      newNumber,
      centerX: Math.round(rm.centerX),
      centerY: Math.round(rm.centerY),
      area: rm.area
    });
    seq++;
  }

  console.log('\n=== 3. 階段一：寫入唯一臨時編號 (消除衝突) ===');
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

  console.log('\n=== 4. 階段二：依動線拓撲主從順序寫入正式新編號 (F201 ~ F286) ===');
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    await client.sendCommand('modify_element_parameter', {
      elementId: item.elementId,
      parameterName: '編號',
      value: item.newNumber
    });
    if ((i + 1) % 20 === 0 || i === plan.length - 1) {
      console.log(`   正式編號進度: ${i + 1}/${plan.length}`);
    }
  }

  console.log('\n=== 5. 驗證 2FL 房間編號 ===');
  const verifyRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const checkRooms = verifyRes.data.Rooms || [];
  console.log(`驗證完成：2FL 共 ${checkRooms.length} 間房間已全部完成重新編號！`);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
