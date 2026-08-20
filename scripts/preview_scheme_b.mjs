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
      minX: info.data?.BoundingBox?.MinX ?? r.CenterX,
      maxX: info.data?.BoundingBox?.MaxX ?? r.CenterX,
      minY: info.data?.BoundingBox?.MinY ?? r.CenterY,
      maxY: info.data?.BoundingBox?.MaxY ?? r.CenterY,
    });
  }

  const uniqueRooms = Array.from(new Map(rooms.map(r => [r.elementId, r])).values());

  // === 方案 B 空間區域劃分與單元排序演算法 ===
  // 1. 劃分 4 大區域 (Zone 1: 北側病房, Zone 2: 中段公共區, Zone 3: 梯廳門廳區, Zone 4: 南側病房)
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
  // 定義 Zone 1 的單元 (Bays)
  // 將 X 接近的 (例如差值 < 2500mm 的上下居室與浴廁) 歸為同一個單元
  function sortZoneIntoBays(zoneRooms, xBayTolerance = 2500) {
    // 依中心 X 排序
    const sortedByX = [...zoneRooms].sort((a,b) => a.centerX - b.centerX);
    const bays = [];

    for (const rm of sortedByX) {
      let placed = false;
      for (const bay of bays) {
        // 若與該 bay 的中心 X 接近
        const avgX = bay.reduce((sum, r) => sum + r.centerX, 0) / bay.length;
        if (Math.abs(rm.centerX - avgX) <= xBayTolerance) {
          bay.push(rm);
          placed = true;
          break;
        }
      }
      if (!placed) bays.push([rm]);
    }

    // 各 bay 由西到東排序
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
    // 南側病房為多個 Y 橫排 (如 Y ≈ 2000, Y ≈ -1500, Y ≈ -6500, Y ≈ -9000, Y ≈ -14500, Y ≈ -17500)
    // 依 Y 分排 (容差 2000mm)
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
    // 每一橫排內依 X 由西到東
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

  console.log(`總計已排序房間數: ${allSorted.length}`);

  const plan = [];
  let seq = 1;
  for (const rm of allSorted) {
    const numStr = String(seq).padStart(2, '0');
    const newNumber = `F2${numStr}`;
    plan.push({
      序號: seq,
      房間ID: rm.elementId,
      房間名稱: rm.name,
      新編號: newNumber,
      舊編號: rm.oldNumber,
      X: Math.round(rm.centerX),
      Y: Math.round(rm.centerY),
      面積: rm.area
    });
    seq++;
  }

  console.log('\n=== 方案 B 前 20 間預覽 ===');
  console.table(plan.slice(0, 20));

  console.log('\n=== 方案 B 21~40 間預覽 ===');
  console.table(plan.slice(20, 40));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
