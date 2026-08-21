import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 查詢 4FL 門圖元與房間關聯 ===');
  // 查詢 4FL 門
  const doorsRes = await client.sendCommand('query_elements', {
    category: 'Doors',
    maxCount: 5000,
    returnFields: ['名稱', '族群', '類型', '類型名稱', '樓層', '類型備註', '標記', '寬度']
  });

  const allDoors = doorsRes.data?.Elements || [];
  console.log(`專案中共有 ${allDoors.length} 樘門。`);

  // 篩選 4FL 門
  const doors4FL = allDoors.filter(d => d['樓層'] === '4FL' || d.Level === '4FL' || d.LevelName === '4FL');
  console.log(`4FL 共有 ${doors4FL.length} 樘門。`);

  // 查詢門的詳細資訊 (包含 FromRoom 與 ToRoom)
  const doorDetails = [];
  for (const d of doors4FL) {
    const elemInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    const props = elemInfo.data?.Parameters || elemInfo.data?.Properties || {};
    
    // 取得 FromRoom 與 ToRoom
    const fromRoom = props['從房間'] || props['From Room'] || elemInfo.data?.FromRoom || '';
    const toRoom = props['到房間'] || props['To Room'] || elemInfo.data?.ToRoom || '';
    const typeComments = props['類型備註'] || props['Type Comments'] || d['類型備註'] || '未設定';
    const typeName = d['類型名稱'] || d['類型'] || d.Name || '';
    const familyName = d['族群'] || '';
    const mark = props['標記'] || props['Mark'] || d['標記'] || '';
    const width = parseFloat(props['寬度'] || props['Width'] || 0);

    doorDetails.push({
      elementId: d.ElementId,
      mark,
      typeComments,
      typeName,
      familyName,
      widthMm: width > 0 ? (width < 50 ? width * 304.8 : width) : 900,
      fromRoom,
      toRoom
    });
  }

  console.log('\n=== 2. 套用排除規則 (雙向排除: 廁所/浴廁/浴室, 管道間, 鐵捲門) ===');
  const excludeRoomKeywords = ['廁所', '浴廁', '浴室', '管道間', '機房', '電梯間', '水箱'];
  const excludeTypeKeywords = ['鐵捲門', '管道間', '捲門', '防火捲門'];

  const included = [];
  const excluded = [];

  for (const item of doorDetails) {
    // 檢查門類型
    const isExcludedType = excludeTypeKeywords.some(kw => 
      item.typeName.includes(kw) || item.familyName.includes(kw) || item.typeComments.includes(kw)
    );

    // 檢查兩側房間 (FromRoom 與 ToRoom)
    const isExcludedRoom = excludeRoomKeywords.some(kw => 
      item.fromRoom.includes(kw) || item.toRoom.includes(kw)
    );

    if (isExcludedType) {
      excluded.push({ ...item, reason: '門類型包含排除關鍵字 (鐵捲門/管道間)' });
    } else if (isExcludedRoom) {
      excluded.push({ ...item, reason: `兩側房間包含排除空間 (From: "${item.fromRoom}", To: "${item.toRoom}")` });
    } else {
      included.push(item);
    }
  }

  console.log(`4FL 總門數: ${doorDetails.length} 樘`);
  console.log(`排除門數: ${excluded.length} 樘`);
  console.log(`計入不鏽鋼門檻門數: ${included.length} 樘`);

  // 依門編號 / 類型備註 彙總
  const summary = {};
  for (const item of included) {
    const key = item.typeComments && item.typeComments !== '未設定' ? item.typeComments : (item.typeName || '標準單開門');
    if (!summary[key]) {
      summary[key] = {
        門編號類型: key,
        樘數: 0,
        單樘寬度Mm: Math.round(item.widthMm),
        總長度Mm: 0,
        門ID清單: []
      };
    }
    summary[key].樘數++;
    summary[key].總長度Mm += item.widthMm;
    summary[key].門ID清單.push(item.elementId);
  }

  const summaryList = Object.values(summary).map(s => ({
    ...s,
    總長度M: (s.總長度Mm / 1000).toFixed(2)
  }));

  console.log('\n=== 3. 4FL 不鏽鋼門檻統計表 ===');
  console.table(summaryList);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
