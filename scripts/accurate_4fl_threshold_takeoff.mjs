import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const doorsRes = await client.sendCommand('query_elements', {
    category: 'Doors',
    maxCount: 5000,
    returnFields: ['名稱', '族群', '類型', '類型名稱', '樓層', '類型備註', '標記', '寬度']
  });

  const allDoors = doorsRes.data?.Elements || [];
  const doors4FL = allDoors.filter(d => d['樓層'] === '4FL' || d.Level === '4FL');

  console.log(`4FL 共有 ${doors4FL.length} 樘門。`);

  // 取得每樘門的詳細參數
  const doorList = [];
  for (const d of doors4FL) {
    const info = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    const rawParams = info.data?.Parameters || [];
    const paramMap = {};
    for (const p of rawParams) {
      if (p.Name && p.Value !== undefined) {
        paramMap[p.Name] = p.Value;
      }
    }

    const typeName = d['類型名稱'] || d['類型'] || d.Name || '';
    const familyName = d['族群'] || '';
    const typeComments = paramMap['類型備註'] || paramMap['Type Comments'] || d['類型備註'] || '';
    const mark = paramMap['標記'] || paramMap['Mark'] || d['標記'] || '';
    const fromRoom = paramMap['從房間'] || paramMap['From Room'] || '';
    const toRoom = paramMap['到房間'] || paramMap['To Room'] || '';

    // 解析門寬度
    let widthMm = 900;
    // 從類型名稱解析 (例如 120*230 -> 1200mm, 130*220 -> 1300mm, 240*230 -> 2400mm, 90*230 -> 900mm)
    const matchW = typeName.match(/^(\d+)\*/);
    if (matchW) {
      const parsedCm = parseInt(matchW[1]);
      if (parsedCm > 30 && parsedCm < 500) {
        widthMm = parsedCm * 10;
      }
    } else if (typeName.includes('60*')) {
      widthMm = 600;
    } else if (typeName.includes('100*')) {
      widthMm = 1000;
    } else if (typeName.includes('180*')) {
      widthMm = 1800;
    }

    doorList.push({
      elementId: d.ElementId,
      typeName,
      familyName,
      typeComments,
      mark,
      widthMm,
      fromRoom,
      toRoom,
      rawParams: paramMap
    });
  }

  // 套用排除規則
  const excludeKeywords = ['廁所', '浴廁', '浴室', '衛生間', '管道間', '機房', '鐵捲門', '捲門'];

  const included = [];
  const excluded = [];

  for (const d of doorList) {
    const typeHit = excludeKeywords.find(kw => d.typeName.includes(kw) || d.familyName.includes(kw) || d.typeComments.includes(kw));
    const roomHit = excludeKeywords.find(kw => d.fromRoom.includes(kw) || d.toRoom.includes(kw));

    if (typeHit) {
      excluded.push({ ...d, reason: `門類型/名稱包含「${typeHit}」` });
    } else if (roomHit) {
      excluded.push({ ...d, reason: `關聯房間包含「${roomHit}」 (From: "${d.fromRoom}", To: "${d.toRoom}")` });
    } else {
      included.push(d);
    }
  }

  console.log(`\n=== 4FL 門檻統計結果 ===`);
  console.log(`4FL 總門數: ${doorList.length} 樘`);
  console.log(`排除門數 (廁所/衛生間/浴廁/管道間/鐵捲門): ${excluded.length} 樘`);
  console.log(`計入不鏽鋼門檻門數: ${included.length} 樘`);

  // 依門類型/規格彙總
  const summary = {};
  for (const item of included) {
    const key = item.typeName;
    if (!summary[key]) {
      summary[key] = {
        門類型規格: key,
        樘數: 0,
        單樘門寬Mm: item.widthMm,
        總長度Mm: 0,
        門ID清單: []
      };
    }
    summary[key].樘數++;
    summary[key].總長度Mm += item.widthMm;
    summary[key].門ID清單.push(item.elementId);
  }

  const summaryRows = Object.values(summary).map(s => ({
    門類型規格: s.門類型規格,
    樘數: s.樘數,
    單樘門寬_mm: s.單樘門寬Mm,
    總長度_m: (s.總長度Mm / 1000).toFixed(2),
    門ID: s.門ID清單.slice(0, 5).join(', ') + (s.門ID清單.length > 5 ? ' ...' : '')
  }));

  console.table(summaryRows);

  const totalQty = included.length;
  const totalLengthM = (included.reduce((sum, d) => sum + d.widthMm, 0) / 1000).toFixed(2);

  console.log(`\n🎉 4FL 不鏽鋼門檻總計: ${totalQty} 樘，總長度: ${totalLengthM} 公尺`);

  console.log('\n=== 排除門清單明細 (共 ' + excluded.length + ' 樘) ===');
  console.table(excluded.map(e => ({
    門ID: e.elementId,
    類型名稱: e.typeName,
    排除原因: e.reason
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
