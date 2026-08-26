import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import { ZONING_ARTICLES } from './render_perfect_zoning_legend.mjs';

const FONT_3MM_TYPE_ID = 501966;
const FONT_45MM_TYPE_ID = 456564;

// Left Table Coordinate Base (Articles 1 to 4)
const T1_START_X = 2113.99;
const T1_COL1_X  = 2113.99; // 15mm: 2113.99 -> 2128.99
const T1_COL2_X  = 2128.99; // 220mm: 2128.99 -> 2348.99
const T1_COL3_X  = 2348.99; // 160mm: 2348.99 -> 2507.07
const T1_END_X   = 2507.07;

// Right Table Coordinate Base (Articles 5 to 11)
const T2_START_X = 2509.38;
const T2_COL1_X  = 2509.38; // 15mm: 2509.38 -> 2524.38
const T2_COL2_X  = 2524.38; // 220mm: 2524.38 -> 2744.38
const T2_COL3_X  = 2744.38; // 160mm: 2744.38 -> 2901.89
const T2_END_X   = 2901.89;

const START_Y = 3494.25;

function wrapChineseText(text, maxWeight = 50.0) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      wrappedLines.push('');
      continue;
    }

    let curLine = '';
    let curWeight = 0;

    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const weight = char.charCodeAt(0) > 255 ? 1.0 : 0.52;

      if (curWeight + weight > maxWeight) {
        wrappedLines.push(curLine);
        curLine = char;
        curWeight = weight;
      } else {
        curLine += char;
        curWeight += weight;
      }
    }
    if (curLine) {
      wrappedLines.push(curLine);
    }
  }

  return wrappedLines.join('\n');
}

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'populate-original-two-cols-' + Date.now();
  await client.connect();

  const viewId = 702748; // "2_都市計畫1"
  console.log(`\n=== 載入文字至原雙欄版面（左欄 X: 2114, 右欄 X: 2509） ===\n`);

  const textNotesToCreate = [];

  // ==========================================
  // 1. 左欄（第一條至第四條）
  // ==========================================
  // 大標題
  textNotesToCreate.push({
    x: T1_START_X + 5.0,
    y: START_Y - 2.5,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  // 欄名列 (Y = 3484.25)
  const headerY = 3484.25;
  textNotesToCreate.push({ x: T1_COL1_X + 2.5, y: headerY - 2.0, text: '法條', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL2_X + 4.0, y: headerY - 2.0, text: '土地使用管制規定', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL3_X + 4.0, y: headerY - 2.0, text: '本案設計檢討', typeId: FONT_3MM_TYPE_ID });

  // 條文 1 (Y = 3474.25)
  const art1 = ZONING_ARTICLES[0];
  textNotesToCreate.push({ x: T1_COL1_X + 3.0, y: 3474.25 - 3.0, text: art1.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL2_X + 2.0, y: 3474.25 - 3.0, text: wrapChineseText(art1.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL3_X + 3.0, y: 3474.25 - 3.0, text: art1.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 2 (Y = 3464.25)
  const art2 = ZONING_ARTICLES[1];
  textNotesToCreate.push({ x: T1_COL1_X + 3.0, y: 3464.25 - 3.0, text: art2.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL3_X + 3.0, y: 3464.25 - 3.0, text: art2.review, typeId: FONT_3MM_TYPE_ID });

  let curSubY = 3464.25 - 3.0;
  textNotesToCreate.push({ x: T1_COL2_X + 2.0, y: curSubY, text: art2.intro1, typeId: FONT_3MM_TYPE_ID });
  curSubY -= 7.5;

  // 子表 1 表頭
  const t1StartX = T1_COL2_X + 1.0;
  const colWidths = [54.0, 24.0, 24.0, 116.0];
  let hX = t1StartX;
  for (let c = 0; c < art2.table1.headers.length; c++) {
    textNotesToCreate.push({ x: hX + 1.5, y: curSubY, text: art2.table1.headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += colWidths[c];
  }
  curSubY -= 7.0;

  for (const row of art2.table1.rows) {
    const wrappedNote = wrapChineseText(row[3], 24.0);
    const lineCount = wrappedNote.split('\n').length;
    const rH = Math.max(1, lineCount) * 5.6 + 2.0;

    let rX = t1StartX;
    textNotesToCreate.push({ x: rX + 1.0, y: curSubY, text: row[0], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[0];
    textNotesToCreate.push({ x: rX + 3.0, y: curSubY, text: row[1], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[1];
    textNotesToCreate.push({ x: rX + 3.0, y: curSubY, text: row[2], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[2];
    textNotesToCreate.push({ x: rX + 1.0, y: curSubY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

    curSubY -= rH;
  }

  curSubY -= 3.0;
  textNotesToCreate.push({ x: T1_COL2_X + 2.0, y: curSubY, text: art2.intro2, typeId: FONT_3MM_TYPE_ID });
  curSubY -= 7.5;

  hX = t1StartX;
  for (let c = 0; c < art2.table2.headers.length; c++) {
    textNotesToCreate.push({ x: hX + 1.5, y: curSubY, text: art2.table2.headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += colWidths[c];
  }
  curSubY -= 7.0;

  for (const row of art2.table2.rows) {
    const wrappedNote = wrapChineseText(row[3], 24.0);
    const lineCount = wrappedNote.split('\n').length;
    const rH = Math.max(1, lineCount) * 5.6 + 2.0;

    let rX = t1StartX;
    textNotesToCreate.push({ x: rX + 1.0, y: curSubY, text: row[0], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[0];
    textNotesToCreate.push({ x: rX + 3.0, y: curSubY, text: row[1], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[1];
    textNotesToCreate.push({ x: rX + 3.0, y: curSubY, text: row[2], typeId: FONT_3MM_TYPE_ID });
    rX += colWidths[2];
    textNotesToCreate.push({ x: rX + 1.0, y: curSubY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

    curSubY -= rH;
  }

  // 條文 3 (Y = 3184.25)
  const art3 = ZONING_ARTICLES[2];
  textNotesToCreate.push({ x: T1_COL1_X + 3.0, y: 3184.25 - 3.0, text: art3.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL2_X + 2.0, y: 3184.25 - 3.0, text: wrapChineseText(art3.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL3_X + 3.0, y: 3184.25 - 3.0, text: art3.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 4 (Y = 2973.58)
  const art4 = ZONING_ARTICLES[3];
  textNotesToCreate.push({ x: T1_COL1_X + 3.0, y: 2973.58 - 3.0, text: art4.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL2_X + 2.0, y: 2973.58 - 3.0, text: wrapChineseText(art4.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T1_COL3_X + 3.0, y: 2973.58 - 3.0, text: art4.review, typeId: FONT_3MM_TYPE_ID });

  // ==========================================
  // 2. 右欄（第五條至第十一條）
  // ==========================================
  // 大標題
  textNotesToCreate.push({
    x: T2_START_X + 5.0,
    y: START_Y - 2.5,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  // 欄名列
  textNotesToCreate.push({ x: T2_COL1_X + 2.5, y: headerY - 2.0, text: '法條', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 4.0, y: headerY - 2.0, text: '土地使用管制規定', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 4.0, y: headerY - 2.0, text: '本案設計檢討', typeId: FONT_3MM_TYPE_ID });

  // 條文 5 (Y = 3474.25)
  const art5 = ZONING_ARTICLES[4];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3474.25 - 3.0, text: art5.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3474.25 - 3.0, text: wrapChineseText(art5.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3474.25 - 3.0, text: art5.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 6 (Y = 3354.25)
  const art6 = ZONING_ARTICLES[5];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3354.25 - 3.0, text: art6.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3354.25 - 3.0, text: wrapChineseText(art6.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3354.25 - 3.0, text: art6.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 7 (Y = 3229.25)
  const art7 = ZONING_ARTICLES[6];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3229.25 - 3.0, text: art7.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3229.25 - 3.0, text: wrapChineseText(art7.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3229.25 - 3.0, text: art7.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 8 (Y = 3088.60)
  const art8 = ZONING_ARTICLES[7];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3088.60 - 3.0, text: art8.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3088.60 - 3.0, text: wrapChineseText(art8.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3088.60 - 3.0, text: art8.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 9 (Y = 3061.10)
  const art9 = ZONING_ARTICLES[8];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3061.10 - 3.0, text: art9.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3061.10 - 3.0, text: wrapChineseText(art9.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3061.10 - 3.0, text: art9.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 10 (Y = 3031.10)
  const art10 = ZONING_ARTICLES[9];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3031.10 - 3.0, text: art10.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3031.10 - 3.0, text: wrapChineseText(art10.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3031.10 - 3.0, text: art10.review, typeId: FONT_3MM_TYPE_ID });

  // 條文 11 (Y = 3010.00)
  const art11 = ZONING_ARTICLES[10];
  textNotesToCreate.push({ x: T2_COL1_X + 3.0, y: 3010.00 - 3.0, text: art11.num, typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL2_X + 2.0, y: 3010.00 - 3.0, text: wrapChineseText(art11.content, 50.0), typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: T2_COL3_X + 3.0, y: 3010.00 - 3.0, text: art11.review, typeId: FONT_3MM_TYPE_ID });

  console.log(`發送 ${textNotesToCreate.length} 個 TextNote 至原雙欄版面...`);
  let noteIndex = 0;
  for (const item of textNotesToCreate) {
    noteIndex++;
    try {
      const res = await client.sendCommand('create_text_note', {
        viewId: viewId,
        x: item.x,
        y: item.y,
        text: item.text
      });
      if (res.data?.ElementId) {
        await client.sendCommand('change_element_type', {
          elementId: res.data.ElementId,
          typeId: item.typeId || FONT_3MM_TYPE_ID
        });
      }
      if (noteIndex % 20 === 0 || noteIndex === textNotesToCreate.length) {
        console.log(`已建立並套用字型: ${noteIndex}/${textNotesToCreate.length}`);
      }
    } catch (err) {
      console.error(`建立 TextNote 失敗:`, err.message);
    }
  }

  console.log('\n========================================================');
  console.log('✅ 原雙欄版面（X: 2114 與 X: 2509）文字全數還原與載入完成！');
  console.log('========================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
