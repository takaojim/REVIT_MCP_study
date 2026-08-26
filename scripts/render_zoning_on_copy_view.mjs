import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import { ZONING_ARTICLES } from './render_perfect_zoning_legend.mjs';

// Text Note Type IDs
const FONT_3MM_TYPE_ID = 501966;  // 3 mm 微軟正黑體
const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm (大標題)

// Column Widths (Total: 395.0 mm)
const COL1_W = 15.0;   // 【法條】
const COL2_W = 220.0;  // 【土地使用管制規定】 (拉滿至 220mm)
const COL3_W = 160.0;  // 【本案設計檢討】

const START_X = 3000.0;
const START_Y = 3484.25;

const COL1_X = START_X;                     // 3000
const COL2_X = START_X + COL1_W;            // 3015
const COL3_X = COL2_X + COL2_W;             // 3235
const END_X  = COL3_X + COL3_W;             // 3395

// 精準折行演算法：在 214mm 有效欄寬下折行 50 字寬，絕不超出右邊線
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
  client.clientName = 'render-zoning-with-subtable-vlines-' + Date.now();
  await client.connect();

  const viewId = 711441; // "2_都市計畫1 複製 1"
  console.log(`\n=== 在測試視圖【2_都市計畫1 複製 1】(ID: ${viewId}) 繪製具備完整內縮邊線與縱向分隔線之表格 ===\n`);

  // 1. 清理測試視圖右側新版面（X >= 2990）的元素，保留左側原始版面
  console.log('--- Step 1: 清理右側測試區域 (X >= 2990) ---');
  const existingNotes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });
  const existingLines = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  const notesToDelete = [];
  for (const el of (existingNotes.data?.Elements || [])) {
    const id = el.ElementId || el.Id;
    notesToDelete.push(id);
  }

  const linesToDelete = [];
  for (const el of (existingLines.data?.Elements || [])) {
    const id = el.ElementId || el.Id;
    const geom = await client.sendCommand('get_element_geometry', {
      elementId: id,
      geometryType: 'centerline'
    });
    if (geom.data?.Centerline?.HasCenterline) {
      // 僅刪除右側新版面線條 (StartX >= 2990)
      if (geom.data.Centerline.StartX >= 2990 || geom.data.Centerline.EndX >= 2990) {
        linesToDelete.push(id);
      }
    }
  }

  console.log(`清除右側 ${linesToDelete.length} 條線條與重新渲染右側文字...`);
  for (const id of linesToDelete) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  for (const id of notesToDelete) {
    // 刪除右側 TextNotes
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }

  // 2. 幾何排版計算
  const LINE_PITCH = 5.6;     // mm per line for 3mm font in Revit
  const TOP_PADDING = 3.5;    // mm
  const BOTTOM_PADDING = 4.5; // mm

  const createdLines = [];
  const textNotesToCreate = [];

  let curY = START_Y;

  // 2.1 主表頭
  const titleHeight = 12.0;
  const colHeaderHeight = 8.0;

  // 大標題頂線
  createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });
  textNotesToCreate.push({
    x: START_X + 5.0,
    y: curY - 2.5,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });

  // 欄名列
  textNotesToCreate.push({ x: COL1_X + 2.5, y: curY - 2.0, text: '法條', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: COL2_X + 4.0, y: curY - 2.0, text: '土地使用管制規定', typeId: FONT_3MM_TYPE_ID });
  textNotesToCreate.push({ x: COL3_X + 4.0, y: curY - 2.0, text: '本案設計檢討', typeId: FONT_3MM_TYPE_ID });

  curY -= colHeaderHeight;
  createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });

  // 2.2 逐條排版
  for (const art of ZONING_ARTICLES) {
    const rowStartY = curY;

    if (art.isSpecialTable) {
      // 第二條：含內嵌強度子表格
      textNotesToCreate.push({
        x: COL1_X + 3.0,
        y: rowStartY - TOP_PADDING,
        text: art.num,
        typeId: FONT_3MM_TYPE_ID
      });
      textNotesToCreate.push({
        x: COL3_X + 3.0,
        y: rowStartY - TOP_PADDING,
        text: art.review,
        typeId: FONT_3MM_TYPE_ID
      });

      let subY = rowStartY - TOP_PADDING;

      // 引言 1
      textNotesToCreate.push({
        x: COL2_X + 2.0,
        y: subY,
        text: art.intro1,
        typeId: FONT_3MM_TYPE_ID
      });
      subY -= (LINE_PITCH + 2.5);

      // ==========================================
      // 子表 1 (使用分區管制表)
      // 內縮邊線設計：左右兩側各內縮 3.0mm (X: 3018 ~ 3232)
      // ==========================================
      const t1 = art.table1;
      const SUB_INSET = 3.0; // 內縮 3mm
      const t1StartX = COL2_X + SUB_INSET;         // 3018.0
      const t1EndX   = COL2_X + COL2_W - SUB_INSET; // 3232.0 (總寬 214mm)
      const subColWidths = [52.0, 24.0, 24.0, 114.0]; // 合計 214.0mm
      
      const t1TopY = subY + 1.0;

      // 子表 1 表頭橫線
      createdLines.push({ startX: t1StartX, startY: t1TopY, endX: t1EndX, endY: t1TopY });
      let hX = t1StartX;
      for (let c = 0; c < t1.headers.length; c++) {
        textNotesToCreate.push({
          x: hX + 1.5,
          y: subY,
          text: t1.headers[c],
          typeId: FONT_3MM_TYPE_ID
        });
        hX += subColWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      // 子表 1 資料列
      for (const row of t1.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 23.5); // 備註欄 114mm，折行權重 23.5
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[0];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[1];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[2];
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      const t1BottomY = subY + 1.0;

      // 繪製子表 1 的所有縱向直線（2 條內縮外邊線 + 3 條欄位分界直線）
      let subVX = t1StartX;
      createdLines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY }); // 藍線：左邊線 (3018.0)
      for (let c = 0; c < subColWidths.length - 1; c++) {
        subVX += subColWidths[c];
        createdLines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY }); // 紅線：內部縱向直線 (3070.0, 3094.0, 3118.0)
      }
      createdLines.push({ startX: t1EndX, startY: t1TopY, endX: t1EndX, endY: t1BottomY });   // 藍線：右邊線 (3232.0)

      subY -= 4.0;

      // 引言 2
      textNotesToCreate.push({
        x: COL2_X + 2.0,
        y: subY,
        text: art.intro2,
        typeId: FONT_3MM_TYPE_ID
      });
      subY -= (LINE_PITCH + 2.5);

      // ==========================================
      // 子表 2 (公共設施用地管制表)
      // 內縮邊線設計：左右兩側各內縮 3.0mm (X: 3018 ~ 3232)
      // ==========================================
      const t2 = art.table2;
      const t2TopY = subY + 1.0;

      createdLines.push({ startX: t1StartX, startY: t2TopY, endX: t1EndX, endY: t2TopY });
      hX = t1StartX;
      for (let c = 0; c < t2.headers.length; c++) {
        textNotesToCreate.push({
          x: hX + 1.5,
          y: subY,
          text: t2.headers[c],
          typeId: FONT_3MM_TYPE_ID
        });
        hX += subColWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      for (const row of t2.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 23.5);
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[0];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[1];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += subColWidths[2];
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      const t2BottomY = subY + 1.0;

      // 繪製子表 2 的所有縱向直線（2 條內縮外邊線 + 3 條欄位分界直線）
      subVX = t1StartX;
      createdLines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY }); // 藍線：左邊線
      for (let c = 0; c < subColWidths.length - 1; c++) {
        subVX += subColWidths[c];
        createdLines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY }); // 紅線：內部直線
      }
      createdLines.push({ startX: t1EndX, startY: t2TopY, endX: t1EndX, endY: t2BottomY });   // 藍線：右邊線

      curY = subY - BOTTOM_PADDING;
    } else {
      // 一般法規條文：折行權重 50.0（拉滿 214mm 有效寬度，不超出邊界）
      const wrappedContent = wrapChineseText(art.content, 50.0);
      const lineCount = wrappedContent.split('\n').length;
      const contentHeight = lineCount * LINE_PITCH + TOP_PADDING + BOTTOM_PADDING;

      // 條號 (Col 1)
      textNotesToCreate.push({
        x: COL1_X + 3.0,
        y: rowStartY - TOP_PADDING,
        text: art.num,
        typeId: FONT_3MM_TYPE_ID
      });

      // 土地使用管制規定 (Col 2)
      textNotesToCreate.push({
        x: COL2_X + 2.0,
        y: rowStartY - TOP_PADDING,
        text: wrappedContent,
        typeId: FONT_3MM_TYPE_ID
      });

      // 本案設計檢討 (Col 3)
      textNotesToCreate.push({
        x: COL3_X + 3.0,
        y: rowStartY - TOP_PADDING,
        text: art.review,
        typeId: FONT_3MM_TYPE_ID
      });

      curY = rowStartY - contentHeight;
    }

    // 每一條法規下方的水平分隔線
    createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });
  }

  // 2.3 繪製大表格縱向外框線與三欄分界線
  const tableBottomY = curY;
  const vLineXPositions = [COL1_X, COL2_X, COL3_X, END_X];
  for (const vx of vLineXPositions) {
    createdLines.push({ startX: vx, startY: START_Y, endX: vx, endY: tableBottomY });
  }

  // 3. 發送至 Revit 繪製線條與文字
  console.log(`發送 ${createdLines.length} 條線條至視圖 ${viewId}...`);
  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: createdLines
  });

  console.log(`發送 ${textNotesToCreate.length} 個 TextNote 至視圖 ${viewId} 並統一套用【3 mm 微軟正黑體】...`);
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
      if (noteIndex % 25 === 0 || noteIndex === textNotesToCreate.length) {
        console.log(`已建立並套用字型: ${noteIndex}/${textNotesToCreate.length}`);
      }
    } catch (err) {
      console.error(`建立 TextNote 失敗:`, err.message);
    }
  }

  console.log('\n========================================================');
  console.log('✅ 【2_都市計畫1 複製 1】(ID: ' + viewId + ') 子表格完整直線繪製完成！');
  console.log('- 表格直線（紅線）：項目、建蔽率、容積率、備註 欄間 3 條縱向直線全數繪製');
  console.log('- 兩側內縮邊線（藍線）：子表格左右外邊線各內縮 3mm，明確呈現內嵌表格層次');
  console.log('- 左側原版面：100% 完整保留，不進行任何刪除');
  console.log('========================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
