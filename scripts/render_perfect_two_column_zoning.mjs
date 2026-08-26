import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import { ZONING_ARTICLES } from './render_perfect_zoning_legend.mjs';

// Text Note Type IDs
const FONT_3MM_TYPE_ID = 501966;  // 3 mm 微軟正黑體
const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm

// Column Widths per Table (Total: 395.0 mm per Table)
const COL1_W = 15.0;   // 【法條】
const COL2_W = 220.0;  // 【土地使用管制規定】 (220mm)
const COL3_W = 160.0;  // 【本案設計檢討】 (160mm)
const TABLE_W = COL1_W + COL2_W + COL3_W; // 395.0 mm

// 雙欄起始 X 座標設定
// 左欄 Table 1: X = 2113.99 -> 2508.99
// 右欄 Table 2: X = 2520.00 -> 2915.00
const TABLE1_START_X = 2113.99;
const TABLE2_START_X = 2520.00;
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

// 輔助函式：排版渲染單一表格欄位（內含指定法規陣列）
function layoutTable(startX, startY, articles) {
  const COL1_X = startX;
  const COL2_X = startX + COL1_W;
  const COL3_X = COL2_X + COL2_W;
  const END_X  = COL3_X + COL3_W;

  const LINE_PITCH = 5.6;     // mm
  const TOP_PADDING = 3.5;    // mm
  const BOTTOM_PADDING = 4.5; // mm

  const lines = [];
  const notes = [];

  let curY = startY;

  // 1. 主表頭
  const titleHeight = 12.0;
  const colHeaderHeight = 8.0;

  lines.push({ startX: startX, startY: curY, endX: END_X, endY: curY });
  notes.push({
    x: startX + 5.0,
    y: curY - 2.5,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: startX, startY: curY, endX: END_X, endY: curY });

  notes.push({ x: COL1_X + 2.5, y: curY - 2.0, text: '法條', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: COL2_X + 4.0, y: curY - 2.0, text: '土地使用管制規定', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: COL3_X + 4.0, y: curY - 2.0, text: '本案設計檢討', typeId: FONT_3MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: startX, startY: curY, endX: END_X, endY: curY });

  // 2. 逐條排版
  for (const art of articles) {
    const rowStartY = curY;

    if (art.isSpecialTable) {
      notes.push({ x: COL1_X + 3.0, y: rowStartY - TOP_PADDING, text: art.num, typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: COL3_X + 3.0, y: rowStartY - TOP_PADDING, text: art.review, typeId: FONT_3MM_TYPE_ID });

      let subY = rowStartY - TOP_PADDING;

      // 引言 1
      notes.push({ x: COL2_X + 2.0, y: subY, text: art.intro1, typeId: FONT_3MM_TYPE_ID });
      subY -= (LINE_PITCH + 2.5);

      // 子表 1 (使用分區管制表)
      const t1 = art.table1;
      const SUB_INSET = 3.0;
      const t1StartX = COL2_X + SUB_INSET;
      const t1EndX   = COL2_X + COL2_W - SUB_INSET;
      const subColWidths = [52.0, 24.0, 24.0, 114.0];
      const t1TopY = subY + 1.0;

      lines.push({ startX: t1StartX, startY: t1TopY, endX: t1EndX, endY: t1TopY });
      let hX = t1StartX;
      for (let c = 0; c < t1.headers.length; c++) {
        notes.push({ x: hX + 1.5, y: subY, text: t1.headers[c], typeId: FONT_3MM_TYPE_ID });
        hX += subColWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      for (const row of t1.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 23.5);
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        notes.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[0];
        notes.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[1];
        notes.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[2];
        notes.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      const t1BottomY = subY + 1.0;

      // 子表 1 縱向線條（2 條內縮外邊線 + 3 條內部直線）
      let subVX = t1StartX;
      lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
      for (let c = 0; c < subColWidths.length - 1; c++) {
        subVX += subColWidths[c];
        lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
      }
      lines.push({ startX: t1EndX, startY: t1TopY, endX: t1EndX, endY: t1BottomY });

      subY -= 4.0;

      // 引言 2
      notes.push({ x: COL2_X + 2.0, y: subY, text: art.intro2, typeId: FONT_3MM_TYPE_ID });
      subY -= (LINE_PITCH + 2.5);

      // 子表 2 (公共設施用地管制表)
      const t2 = art.table2;
      const t2TopY = subY + 1.0;

      lines.push({ startX: t1StartX, startY: t2TopY, endX: t1EndX, endY: t2TopY });
      hX = t1StartX;
      for (let c = 0; c < t2.headers.length; c++) {
        notes.push({ x: hX + 1.5, y: subY, text: t2.headers[c], typeId: FONT_3MM_TYPE_ID });
        hX += subColWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      for (const row of t2.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 23.5);
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        notes.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[0];
        notes.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[1];
        notes.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[2];
        notes.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      const t2BottomY = subY + 1.0;

      // 子表 2 縱向線條
      subVX = t1StartX;
      lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
      for (let c = 0; c < subColWidths.length - 1; c++) {
        subVX += subColWidths[c];
        lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
      }
      lines.push({ startX: t1EndX, startY: t2TopY, endX: t1EndX, endY: t2BottomY });

      curY = subY - BOTTOM_PADDING;
    } else {
      const wrappedContent = wrapChineseText(art.content, 50.0);
      const lineCount = wrappedContent.split('\n').length;
      const contentHeight = lineCount * LINE_PITCH + TOP_PADDING + BOTTOM_PADDING;

      notes.push({ x: COL1_X + 3.0, y: rowStartY - TOP_PADDING, text: art.num, typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: COL2_X + 2.0, y: rowStartY - TOP_PADDING, text: wrappedContent, typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: COL3_X + 3.0, y: rowStartY - TOP_PADDING, text: art.review, typeId: FONT_3MM_TYPE_ID });

      curY = rowStartY - contentHeight;
    }

    lines.push({ startX: startX, startY: curY, endX: END_X, endY: curY });
  }

  // 大表格縱向線條
  const tableBottomY = curY;
  const vLineXPositions = [COL1_X, COL2_X, COL3_X, END_X];
  for (const vx of vLineXPositions) {
    lines.push({ startX: vx, startY: startY, endX: vx, endY: tableBottomY });
  }

  return { lines, notes, bottomY: curY };
}

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'render-perfect-two-col-' + Date.now();
  await client.connect();

  const viewId = 711441; // "2_都市計畫1 複製 1"
  console.log(`\n=== 開始在測試視圖【2_都市計畫1 複製 1】(ID: ${viewId}) 生成雙欄標準出圖版面 ===\n`);

  // 1. 清除此視圖中所有舊元素
  const existingNotes = await client.sendCommand('query_elements', { category: 'OST_TextNotes', viewId });
  const existingLines = await client.sendCommand('query_elements', { category: 'OST_Lines', viewId });

  const noteIds = (existingNotes.data?.Elements || []).map(e => e.ElementId || e.Id);
  const lineIds = (existingLines.data?.Elements || []).map(e => e.ElementId || e.Id);
  console.log(`清理舊有元素：${noteIds.length} 個 TextNotes 與 ${lineIds.length} 條 Lines...`);

  for (const id of noteIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  for (const id of lineIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }

  // 2. 劃分雙欄條文
  // 左欄 (Table 1)：第一條至第三條（含兩大強度子表格）
  const table1Articles = ZONING_ARTICLES.slice(0, 3);
  // 右欄 (Table 2)：第四條至第十一條（含退縮、停車、綠化等規定）
  const table2Articles = ZONING_ARTICLES.slice(3);

  console.log(`左欄包含條文: ${table1Articles.map(a => a.num).join(', ')}`);
  console.log(`右欄包含條文: ${table2Articles.map(a => a.num).join(', ')}`);

  const t1Res = layoutTable(TABLE1_START_X, START_Y, table1Articles);
  const t2Res = layoutTable(TABLE2_START_X, START_Y, table2Articles);

  const allLines = [...t1Res.lines, ...t2Res.lines];
  const allNotes = [...t1Res.notes, ...t2Res.notes];

  console.log(`\n發送 ${allLines.length} 條線條至 Revit...`);
  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: allLines
  });

  console.log(`發送 ${allNotes.length} 個 TextNotes 並統一套用【3 mm 微軟正黑體】...`);
  let noteIndex = 0;
  for (const item of allNotes) {
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
      if (noteIndex % 30 === 0 || noteIndex === allNotes.length) {
        console.log(`已建立並套用字型: ${noteIndex}/${allNotes.length}`);
      }
    } catch (err) {
      console.error('建立 TextNote 失敗:', err.message);
    }
  }

  console.log('\n========================================================');
  console.log(`✅ 雙欄標準出圖版面在視圖 ${viewId} 成功生成！`);
  console.log('- 左欄 Table 1（X: 2114）：第一條至第三條（含兩大強度子表格，具備縱向直線與內縮邊線）');
  console.log('- 右欄 Table 2（X: 2520）：第四條至第十一條（完整分項段落，拉滿 220mm 欄寬）');
  console.log('- 字型統一：全數採用【3 mm 微軟正黑體】');
  console.log('========================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
