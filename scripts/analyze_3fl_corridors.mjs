import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL 平面視圖

  // 1. 取得 3FL 上所有走廊/通道房間
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
  const corridorKeywords = ['走廊', '通道', 'Corridor', '廊道', '梯廳', '洗漱區', '休閒區'];
  const corridors = [];

  for (const r of roomsRes.data.Rooms) {
    const isCorridor = corridorKeywords.some(k => r.Name && r.Name.includes(k));
    if (isCorridor) {
      const info = await client.sendCommand('get_room_info', { roomId: r.ElementId });
      corridors.push({
        elementId: r.ElementId,
        name: r.Name,
        number: r.Number,
        area: r.Area,
        centerX: info.data?.CenterX ?? r.CenterX,
        centerY: info.data?.CenterY ?? r.CenterY,
      });
    }
  }

  // 去重
  const uniqueCorridors = [];
  const seen = new Set();
  for (const c of corridors) {
    if (!seen.has(c.elementId)) {
      seen.add(c.elementId);
      uniqueCorridors.push(c);
    }
  }

  console.log(`\n=== 3FL 走廊與公共通道房間清單 (${uniqueCorridors.length} 個) ===`);
  console.table(uniqueCorridors);

  // 2. 進行走廊寬度法規分析 (analyze_corridor_width)
  console.log('\n=== 走廊寬度法規分析結果 ===');
  const analysisResults = [];

  for (const c of uniqueCorridors) {
    try {
      const analysis = await client.sendCommand('analyze_corridor_width', {
        roomId: c.elementId,
        minWidth: 1200 // 建築技術規則雙側居室 1.6m / 單側居室 1.2m
      });
      analysisResults.push({ corridor: c, data: analysis.data });
      console.log(`\n房間 [${c.number}] ${c.name} (ID: ${c.elementId}):`);
      console.log(JSON.stringify(analysis.data, null, 2));
    } catch (e) {
      console.log(`分析 [${c.number}] ${c.name} 失敗: ${e.message}`);
    }
  }

  // 3. 建立走廊寬度標註 (create_corridor_dimension)
  console.log('\n=== 建立走廊淨寬尺寸標註 ===');
  const dimResults = [];

  for (const c of uniqueCorridors) {
    try {
      const dim = await client.sendCommand('create_corridor_dimension', {
        roomId: c.elementId,
        viewId: viewId
      });
      dimResults.push({ corridor: c, dimData: dim.data });
      console.log(`標註 [${c.number}] ${c.name} 成功:`, JSON.stringify(dim.data, null, 2));
    } catch (e) {
      console.log(`標註 [${c.number}] ${c.name} 失敗: ${e.message}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('執行錯誤:', err);
  process.exit(1);
});
