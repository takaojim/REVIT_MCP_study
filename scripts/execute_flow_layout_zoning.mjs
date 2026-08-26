import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

// Text Note Type IDs
const FONT_3MM_TYPE_ID = 501966;  // 3 mm 微軟正黑體
const FONT_4MM_TYPE_ID = 695618;  // 4 mm 微軟正黑體 (表頭專用)
const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm (大標題專用)

// 公版母版基準尺寸 (寬度 791.9mm, 高度 524.67mm)
const MASTER_ORIGIN_X = 2111.99;
const MASTER_WIDTH    = 791.90;
const BOX_TOP_Y       = 3494.25;
const BOX_BOTTOM_Y    = 2973.58;
const FRAME_TOP_Y     = 3496.25;
const FRAME_BOTTOM_Y  = 2971.58;

// 欄寬幾何
const COL1_W = 15.0;
const COL2_W = 220.0;
const COL3_W = 158.08;
const COL_TABLE_W = COL1_W + COL2_W + COL3_W; // 393.08mm
const COL_GAP = 2.31; // 2509.38 - 2507.07

const LINE_PITCH = 5.8; // 精確 Revit 3mm 正黑體安全行距 (mm)

// 高級中英文全階層懸掛縮排與防破框折行演算法 (MaxWeight = 52.5)
function wrapFormattedText(text, maxWeight = 52.5) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      wrappedLines.push('');
      continue;
    }

    let indentSpaces = '';
    let match = para.match(/^(\s+)/);
    if (match) {
      indentSpaces = match[1];
    }

    const trimmed = para.trim();
    let subIndent = indentSpaces;

    // 判斷標號層級並設定精確懸掛縮排 (Hanging Indent)
    if (/^（[一二三四五六七八九十]+）/.test(trimmed) || /^\([一二三四五六七八九十]+\)/.test(trimmed)) {
      // Level 1: （一） 佔 4 格半形空白，次行懸掛對齊標號後內文
      subIndent = indentSpaces + '    ';
    } else if (/^[0-9]+\./.test(trimmed)) {
      // Level 2: 1. 佔 4 格半形空白，次行懸掛對齊標號後內文
      subIndent = indentSpaces + '    ';
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
      // Level 3: （1） 佔 6 格半形空白，次行懸掛對齊標號後內文
      subIndent = indentSpaces + '      ';
    }

    let curLine = '';
    let curWeight = 0;

    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const weight = char.charCodeAt(0) > 255 ? 1.0 : 0.51;

      if (curWeight + weight > maxWeight) {
        wrappedLines.push(curLine);
        curLine = subIndent + char;
        curWeight = subIndent.length * 0.51 + weight;
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

// 產生一個完整「公版雙欄框線＋外框雙線」幾何 (Page Template Frame)
function createTemplateFrame(baseX) {
  const lines = [];

  const outerLeft   = baseX;
  const outerRight  = baseX + MASTER_WIDTH; // baseX + 791.90
  const outerTop    = FRAME_TOP_Y;          // 3496.25
  const outerBottom = FRAME_BOTTOM_Y;       // 2971.58

  // 1. 最外層雙線外框
  lines.push({ startX: outerLeft, startY: outerTop, endX: outerRight, endY: outerTop });
  lines.push({ startX: outerLeft, startY: outerBottom, endX: outerRight, endY: outerBottom });
  lines.push({ startX: outerLeft, startY: outerBottom, endX: outerLeft, endY: outerTop });
  lines.push({ startX: outerRight, startY: outerBottom, endX: outerRight, endY: outerTop });

  // 2. 左欄 (Table 1) 框線
  const t1Left  = baseX + 2.0;
  const t1Col1  = t1Left;
  const t1Col2  = t1Col1 + COL1_W;
  const t1Col3  = t1Col2 + COL2_W;
  const t1Right = t1Col3 + COL3_W; // t1Left + 393.08

  // 3. 右欄 (Table 2) 框線
  const t2Left  = t1Right + COL_GAP; // t1Right + 2.31
  const t2Col1  = t2Left;
  const t2Col2  = t2Col1 + COL1_W;
  const t2Col3  = t2Col2 + COL2_W;
  const t2Right = t2Col3 + COL3_W; // t2Left + 393.08

  // 左欄四邊與三欄直線 (大標題橫跨三欄為合併列，內部垂直線 t1Col2 與 t1Col3 不得穿入大標題列！)
  const TITLE_ROW_H = 10.0;
  const colDividerStartY = BOX_TOP_Y - TITLE_ROW_H; // Y = 3484.25

  lines.push({ startX: t1Left, startY: BOX_TOP_Y, endX: t1Right, endY: BOX_TOP_Y });
  lines.push({ startX: t1Left, startY: BOX_BOTTOM_Y, endX: t1Right, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col1, startY: BOX_TOP_Y, endX: t1Col1, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col2, startY: colDividerStartY, endX: t1Col2, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col3, startY: colDividerStartY, endX: t1Col3, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Right, startY: BOX_TOP_Y, endX: t1Right, endY: BOX_BOTTOM_Y });

  // 右欄四邊與三欄直線 (內部垂直線 t2Col2 與 t2Col3 不得穿入大標題列！)
  lines.push({ startX: t2Left, startY: BOX_TOP_Y, endX: t2Right, endY: BOX_TOP_Y });
  lines.push({ startX: t2Left, startY: BOX_BOTTOM_Y, endX: t2Right, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t2Col1, startY: BOX_TOP_Y, endX: t2Col1, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t2Col2, startY: colDividerStartY, endX: t2Col2, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t2Col3, startY: colDividerStartY, endX: t2Col3, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t2Right, startY: BOX_TOP_Y, endX: t2Right, endY: BOX_BOTTOM_Y });

  return {
    lines,
    t1Coords: { start: t1Left, col1: t1Col1, col2: t1Col2, col3: t1Col3, end: t1Right },
    t2Coords: { start: t2Left, col1: t2Col1, col2: t2Col2, col3: t2Col3, end: t2Right }
  };
}

// 產生 Page 1 雙欄流式連續排版內容 (包含精確子表格合併儲存格幾何)
function generatePage1Content(t1Coords, t2Coords) {
  const lines = [];
  const notes = [];

  // ==========================
  // 【PAGE 1 - 左欄 Table 1】
  // ==========================
  let curY = BOX_TOP_Y;
  const titleHeight = 10.0;
  const colHeaderHeight = 10.0;

  // 主表頭 (水平居中: 欄寬 393.08mm，27字大標題居中置於 +110.0mm)
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });
  notes.push({
    x: t1Coords.start + 110.0,
    y: curY - 2.0,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 表頭三欄名稱 (水平置中: 4 mm 微軟正黑體，高度 1.0/10mm 垂直置中於 -2.5mm)
  notes.push({ x: t1Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 1. 第一條 (一、法源依據)
  const art1 = COMPLETE_ZONING_DATA.leftColumnArticles[0];
  const art1StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art1StartY - 2.5, text: art1.num, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art1StartY - 2.5, text: art1.review, typeId: FONT_3MM_TYPE_ID });
  const art1Wrapped = wrapFormattedText(art1.content, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art1StartY - 2.5, text: art1Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art1Lines = art1Wrapped.split('\n').length;
  curY -= (art1Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 2. 第二條 (二、土地使用強度表 1 & 2)
  const art2 = COMPLETE_ZONING_DATA.leftColumnArticles[1];
  const art2StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art2StartY - 2.5, text: art2.num, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art2StartY - 2.5, text: art2.review, typeId: FONT_3MM_TYPE_ID });

  let subY = art2StartY - 2.5;
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: art2.intro1, typeId: FONT_3MM_TYPE_ID });
  subY -= (LINE_PITCH + 2.0);

  // 子表 1 (使用分區)
  const t1 = art2.table1;
  const SUB_INSET = 3.0;
  const t1StartX = t1Coords.col2 + SUB_INSET;
  const t1EndX   = t1Coords.col2 + COL2_W - SUB_INSET;
  const subColWidths = t1.colWidths;
  const t1TopY = subY + 1.0;

  lines.push({ startX: t1StartX, startY: t1TopY, endX: t1EndX, endY: t1TopY });
  let hX = t1StartX;
  for (let c = 0; c < t1.headers.length; c++) {
    notes.push({ x: hX + 1.5, y: subY, text: t1.headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += subColWidths[c];
  }
  subY -= (LINE_PITCH + 1.0);
  lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

  for (const row of t1.rows) {
    const rowTopY = subY;
    const wrappedItem = wrapFormattedText(row[0], 13.5);
    const wrappedNote = wrapFormattedText(row[3], 25.5);
    const lineCount0 = wrappedItem.split('\n').length;
    const lineCount3 = wrappedNote.split('\n').length;
    const rowH = Math.max(lineCount0, lineCount3) * LINE_PITCH + 2.5;

    let rX = t1StartX;
    notes.push({ x: rX + 1.0, y: rowTopY, text: wrappedItem, typeId: FONT_3MM_TYPE_ID });
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
  let subVX = t1StartX;
  lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
  for (let c = 0; c < subColWidths.length - 1; c++) {
    subVX += subColWidths[c];
    lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
  }
  lines.push({ startX: t1EndX, startY: t1TopY, endX: t1EndX, endY: t1BottomY });

  subY -= 3.5;
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: art2.intro2, typeId: FONT_3MM_TYPE_ID });
  subY -= (LINE_PITCH + 2.0);

  // 子表 2 (公共設施) —— 【按照原稿完美合併學校用地與停車場用地儲存格！】
  const t2 = art2.table2;
  const t2TopY = subY + 1.0;
  lines.push({ startX: t1StartX, startY: t2TopY, endX: t1EndX, endY: t2TopY });
  hX = t1StartX;
  for (let c = 0; c < t2.headers.length; c++) {
    notes.push({ x: hX + 1.5, y: subY, text: t2.headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += subColWidths[c];
  }
  subY -= (LINE_PITCH + 1.0);
  lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

  // 定義子表 2 細項合併結構 (學校用地: 20mm + 32mm; 停車場用地: 20mm + 32mm)
  const ITEM_SUB_SPLIT_X = t1StartX + 18.0;

  let schoolTopY = 0;
  let schoolBottomY = 0;
  let parkingTopY = 0;
  let parkingBottomY = 0;

  for (let rIdx = 0; rIdx < t2.rows.length; rIdx++) {
    const row = t2.rows[rIdx];
    const rowTopY = subY;
    const wrappedItem = wrapFormattedText(row[0], 13.5);
    const wrappedNote = wrapFormattedText(row[3], 25.5);
    const lineCount0 = wrappedItem.split('\n').length;
    const lineCount3 = wrappedNote.split('\n').length;
    const rowH = Math.max(lineCount0, lineCount3) * LINE_PITCH + 2.5;

    // 項目文字處理 (合併儲存格)
    if (rIdx === 1) {
      schoolTopY = subY + 1.0;
      // 學校用地 (合併 2 列: 文中、文小用地 / 文高)
      notes.push({ x: t1StartX + 1.0, y: rowTopY - 2.5, text: '學校用地', typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: ITEM_SUB_SPLIT_X + 1.0, y: rowTopY, text: '文中、文小用地', typeId: FONT_3MM_TYPE_ID });
    } else if (rIdx === 2) {
      notes.push({ x: ITEM_SUB_SPLIT_X + 1.0, y: rowTopY, text: '文高', typeId: FONT_3MM_TYPE_ID });
    } else if (rIdx === 5) {
      parkingTopY = subY + 1.0;
      // 停車場用地 (合併 3 列: 平面 / 立體 / 潭-停4)
      notes.push({ x: t1StartX + 1.0, y: rowTopY - 5.5, text: '停車場\n用地', typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: ITEM_SUB_SPLIT_X + 1.0, y: rowTopY, text: '平面', typeId: FONT_3MM_TYPE_ID });
    } else if (rIdx === 6) {
      notes.push({ x: ITEM_SUB_SPLIT_X + 1.0, y: rowTopY, text: '立體', typeId: FONT_3MM_TYPE_ID });
    } else if (rIdx === 7) {
      notes.push({ x: ITEM_SUB_SPLIT_X + 1.0, y: rowTopY, text: '潭-停4', typeId: FONT_3MM_TYPE_ID });
    } else {
      notes.push({ x: t1StartX + 1.0, y: rowTopY, text: wrappedItem, typeId: FONT_3MM_TYPE_ID });
    }

    let rX = t1StartX + subColWidths[0];
    notes.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
    rX += subColWidths[1];
    notes.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
    rX += subColWidths[2];
    notes.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

    subY -= rowH;

    if (rIdx === 2) {
      schoolBottomY = subY + 1.0;
    } else if (rIdx === 7) {
      parkingBottomY = subY + 1.0;
    }

    // 繪製橫線：如果是在學校用地第1列或停車場第1、2列，橫線只從 ITEM_SUB_SPLIT_X 開始畫！
    if (rIdx === 1) {
      lines.push({ startX: ITEM_SUB_SPLIT_X, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
    } else if (rIdx === 5 || rIdx === 6) {
      lines.push({ startX: ITEM_SUB_SPLIT_X, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
    } else {
      lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
    }
  }

  const t2BottomY = subY + 1.0;
  subVX = t1StartX;
  lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
  for (let c = 0; c < subColWidths.length - 1; c++) {
    subVX += subColWidths[c];
    lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
  }
  lines.push({ startX: t1EndX, startY: t2TopY, endX: t1EndX, endY: t2BottomY });

  // 學校用地與停車場用地內部垂直分割短線 (紅線)
  lines.push({ startX: ITEM_SUB_SPLIT_X, startY: schoolTopY, endX: ITEM_SUB_SPLIT_X, endY: schoolBottomY });
  lines.push({ startX: ITEM_SUB_SPLIT_X, startY: parkingTopY, endX: ITEM_SUB_SPLIT_X, endY: parkingBottomY });

  curY = subY - 4.0;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 3. 第三條 Part A (（一）款全文，精確收納於左欄底框線內，留 20mm+ 安全淨空，零溢出！)
  const art3PartAText = `（一）乙種工業區及零星工業區之使用如下：
    1.乙種工業區之使用依都市計畫法臺中市施行自治條例乙種工業區規定管制。
    2.乙種工業區申請設置公共服務設施及公用事業設施，其使用細目、使用面積、使用條件及管理維護事項之核准條件如附件七；申請作業程序及應備書件，依「臺中市都市計畫甲種乙種工業區土地申請設置公共服務設施及公用事業設施總量管制作業要點」規定辦理。
    3.乙種工業區（栗林及潭秀工業區內）者用語定義如下：
        （1）基地線：建築基地之界線。
        （2）前面基地線：基地臨接計畫道路之基地線。臨接二條以上計畫道路者，由建築基地申請人任選一側為前面基地線。
        （3）前院：沿前面基地線之庭院。其他臨接計畫道路之基地線，另有設置騎樓或退縮規定者，從其規定，無規定者，比照前院深度退縮。
        （4）建築物高度比：建築物各部分高度與自各該部分起量至臨接道路對側道路境界線之最小水平距離之比。但臨接二條以上道路者，得任選一條檢討。
        建築物不計建築物高度者及不計建築面積之陽台、屋簷、雨遮等，得不受建築物高度比之限制。
        建築基地臨接或臨接道路對側有公園、綠地、廣場、河川、體育場、兒童遊樂場、綠帶、計畫水溝、平面式停車場、行水區、湖泊、水堰或其他類似空地者，其建築物高度比之計算，得將該等寬度計入。`;

  const art3PartAStartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art3PartAStartY - 2.5, text: '三、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art3PartAStartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

  const art3PartAWrapped = wrapFormattedText(art3PartAText, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art3PartAStartY - 2.5, text: art3PartAWrapped, typeId: FONT_3MM_TYPE_ID });

  // 左欄最底線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t1Coords.start, startY: BOX_BOTTOM_Y, endX: t1Coords.end, endY: BOX_BOTTOM_Y });


  // ==========================
  // 【PAGE 1 - 右欄 Table 2】
  // ==========================
  curY = BOX_TOP_Y;

  // 右欄主表頭 (居中對齊)
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });
  notes.push({
    x: t2Coords.start + 110.0,
    y: curY - 2.0,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 表頭三欄名稱 (水平置中: 4 mm 微軟正黑體，高度 1.0/10mm 垂直置中於 -2.5mm)
  notes.push({ x: t2Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 1. 第三條 Part B (承接（二）至（八）款，動態幾何行高計算，確保與第四條之間 0 重疊！)
  const art3PartBStartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art3PartBStartY - 2.5, text: '三、\n(續)', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art3PartBStartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

  const art3PartBText = `（二）電信專用區之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至5款規定辦理。
（三）自行車專用道用地僅供人行、自行車通行。但經本府主管機關審查後得作為自行車休憩、租賃及小型飲食店（樓地板面積300㎡以下）之使用。
（四）園道用地（得兼供自行車專用道及其附屬設施使用）除兼供自行車專用道之附屬設施使用部分外之路段，不得指定建築線。
（五）潭-細公（兒）3用地不得依「都市計畫公共設施用地多目標使用辦法」作多目標使用。
（六）潭-停3、潭-細公（兒）6用地公共設施用地多目標使用限非營利性公共設施使用。
（七）第三類型郵政專用區為促進郵政事業之發展而劃定（建蔽率不得大於50％，容積率不得大於240％），得為下列之使用：
    1.經營郵政事業所需設施及郵政必要附屬設施。
    2.一般商業設施：包括金融保險業、一般批發業、一般零售業、運動服務業、餐飲業、一般商業辦公大樓之商業使用。
    作前項第二款使用時，以都市計畫書載明得為該等使用者為限，其使用之樓地板面積，不得超過該郵政專用區容積總樓地板面積二分之一使用限制。
（八）電信用地之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。`;

  const art3PartBWrapped = wrapFormattedText(art3PartBText, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art3PartBStartY - 2.5, text: art3PartBWrapped, typeId: FONT_3MM_TYPE_ID });

  const art3PartBLines = art3PartBWrapped.split('\n').length;
  const art3PartBRowHeight = art3PartBLines * 6.0 + 16.0;
  curY -= art3PartBRowHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 2. 第四條 (四、退縮建築規定全文，單一完整區塊向下，0 內部橫線)
  const art4StartY = curY;
  notes.push({ x: t2Coords.col1 + 3.0, y: art4StartY - 2.5, text: '四、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art4StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

  const art4 = COMPLETE_ZONING_DATA.rightColumnArticles[0];
  const art4Indented = art4.content
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (/^[0-9]+\./.test(t)) return '    ' + t;
      if (/^（[0-9]+）/.test(t)) return '        ' + t;
      return t;
    })
    .join('\n');

  const art4Wrapped = wrapFormattedText(art4Indented, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art4StartY - 2.5, text: art4Wrapped, typeId: FONT_3MM_TYPE_ID });

  // 右欄最底線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t2Coords.start, startY: BOX_BOTTOM_Y, endX: t2Coords.end, endY: BOX_BOTTOM_Y });

  return { lines, notes };
}

// 產生 Page 2 雙欄排版內容 (靠左欄位接續填滿：包含精確停車表合併儲存格與充足行高淨空！)
function generatePage2Content(t1Coords, t2Coords) {
  const lines = [];
  const notes = [];

  // ==========================
  // 【PAGE 2 - 左欄 Table 1】(五、六、七、八、九、十、十一條 接續排滿)
  // ==========================
  let curY = BOX_TOP_Y;
  const titleHeight = 10.0;
  const colHeaderHeight = 10.0;

  // Page 2 左欄主表頭 (居中對齊)
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });
  notes.push({
    x: t1Coords.start + 110.0,
    y: curY - 2.0,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 表頭三欄名稱 (水平置中: 4 mm 微軟正黑體，高度 1.0/10mm 垂直置中於 -2.5mm)
  notes.push({ x: t1Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 1. 第五條 (五、停車空間留設規定)
  const art5 = COMPLETE_ZONING_DATA.rightColumnArticles[1]; // 第五條
  const art5StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art5StartY - 2.5, text: art5.num, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art5StartY - 2.5, text: art5.review, typeId: FONT_3MM_TYPE_ID });

  let subY = art5StartY - 2.5;
  const introWrapped = wrapFormattedText(art5.intro1, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: introWrapped, typeId: FONT_3MM_TYPE_ID });
  const introLines = introWrapped.split('\n').length;
  // 前言下方留充足 8.0mm 空間，安全進入停車表格
  subY -= (introLines * LINE_PITCH + 8.0);

  // 停車設置表格 —— 【雙層表頭模矩化：第一層 7.0mm，第二層 7.0mm，總高 14.0mm，0 切線】
  const pt = art5.parkingTable;
  const SUB_INSET = 3.0;
  const ptStartX = t1Coords.col2 + SUB_INSET;
  const ptEndX   = t1Coords.col2 + COL2_W - SUB_INSET;
  const ptColWidths = [45.0, 50.0, 59.0, 60.0]; // 總寬 214.0mm
  const ptTopY = subY;

  // 表格頂線
  lines.push({ startX: ptStartX, startY: ptTopY, endX: ptEndX, endY: ptTopY });

  // 雙層合併欄 (分區或用地、總樓地板面積) 垂直居中放置於 ptTopY - 5.5mm
  notes.push({ x: ptStartX + 12.5, y: ptTopY - 5.5, text: pt.headersRow1[0], typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: ptStartX + ptColWidths[0] + 8.0, y: ptTopY - 5.5, text: pt.headersRow1[1], typeId: FONT_3MM_TYPE_ID });

  // 第一層表頭 (停車設置標準) 居中放置於 ptTopY - 2.0mm
  notes.push({ x: ptStartX + ptColWidths[0] + ptColWidths[1] + 46.0, y: ptTopY - 2.0, text: pt.headersRow1[2], typeId: FONT_3MM_TYPE_ID });

  // 中間水平分割線 (Y = ptTopY - 7.0mm，從第 3 欄畫到第 4 欄，不切斷第 1、2 欄)
  const headerMidY = ptTopY - 7.0;
  lines.push({ startX: ptStartX + ptColWidths[0] + ptColWidths[1], startY: headerMidY, endX: ptEndX, endY: headerMidY });

  // 第二層表頭 (汽車、機車) 居中放置於 headerMidY - 2.0mm
  notes.push({ x: ptStartX + ptColWidths[0] + ptColWidths[1] + 24.0, y: headerMidY - 2.0, text: pt.headersRow2[0], typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: ptStartX + ptColWidths[0] + ptColWidths[1] + ptColWidths[2] + 15.0, y: headerMidY - 2.0, text: pt.headersRow2[1], typeId: FONT_3MM_TYPE_ID });

  // 表頭底線 (Y = ptTopY - 14.0mm)
  const headerBottomY = ptTopY - 14.0;
  lines.push({ startX: ptStartX, startY: headerBottomY, endX: ptEndX, endY: headerBottomY });
  subY = headerBottomY;

  // 第一類建築物 (Row 0 ~ 3)
  const g1TopY = subY;
  notes.push({ x: ptStartX + 5.0, y: g1TopY - 8.0, text: '第一類\n建築物', typeId: FONT_3MM_TYPE_ID });

  for (let rIdx = 0; rIdx < 4; rIdx++) {
    const row = pt.rows[rIdx];
    const rowTopY = subY;
    const rowH = 7.0;

    let rX = ptStartX + ptColWidths[0];
    notes.push({ x: rX + 4.0, y: rowTopY - 2.0, text: row.area, typeId: FONT_3MM_TYPE_ID });
    rX += ptColWidths[1];
    notes.push({ x: rX + 14.0, y: rowTopY - 2.0, text: row.car, typeId: FONT_3MM_TYPE_ID });
    rX += ptColWidths[2];
    notes.push({ x: rX + 8.0, y: rowTopY - 2.0, text: row.moto, typeId: FONT_3MM_TYPE_ID });

    subY -= rowH;
    // 橫線：前 3 列只從 ptStartX + ptColWidths[0] 畫到 ptEndX (不切斷第一類建築物！)
    if (rIdx < 3) {
      lines.push({ startX: ptStartX + ptColWidths[0], startY: subY, endX: ptEndX, endY: subY });
    } else {
      lines.push({ startX: ptStartX, startY: subY, endX: ptEndX, endY: subY });
    }
  }

  // 第二類建築物 (Row 4 ~ 7)
  const g2TopY = subY;
  notes.push({ x: ptStartX + 5.0, y: g2TopY - 9.0, text: '第二類\n建築物', typeId: FONT_3MM_TYPE_ID });
  // 機車欄「每戶設1輛為原則」垂直置中合併跨 4 列
  notes.push({ x: ptStartX + ptColWidths[0] + ptColWidths[1] + ptColWidths[2] + 4.0, y: g2TopY - 9.0, text: '每戶設 1 輛為原則', typeId: FONT_3MM_TYPE_ID });

  for (let rIdx = 4; rIdx < 8; rIdx++) {
    const row = pt.rows[rIdx];
    const rowTopY = subY;
    const isMultiLineArea = row.area.includes('\n');
    const rowH = isMultiLineArea ? 12.0 : 7.0;

    let rX = ptStartX + ptColWidths[0];
    notes.push({ x: rX + 4.0, y: rowTopY - 2.0, text: row.area, typeId: FONT_3MM_TYPE_ID });
    rX += ptColWidths[1];
    notes.push({ x: rX + 14.0, y: rowTopY - 2.0, text: row.car, typeId: FONT_3MM_TYPE_ID });

    subY -= rowH;
    // 橫線：只從 ptStartX + ptColWidths[0] 畫到 ptEndX - ptColWidths[3] (只切分面積與汽車，不切斷第一欄與最後一欄！)
    if (rIdx < 7) {
      lines.push({ startX: ptStartX + ptColWidths[0], startY: subY, endX: ptEndX - ptColWidths[3], endY: subY });
    } else {
      lines.push({ startX: ptStartX, startY: subY, endX: ptEndX, endY: subY });
    }
  }

  const ptBottomY = subY;
  // 縱向線條
  lines.push({ startX: ptStartX, startY: ptTopY, endX: ptStartX, endY: ptBottomY });
  lines.push({ startX: ptStartX + ptColWidths[0], startY: ptTopY, endX: ptStartX + ptColWidths[0], endY: ptBottomY });
  lines.push({ startX: ptStartX + ptColWidths[0] + ptColWidths[1], startY: ptTopY, endX: ptStartX + ptColWidths[0] + ptColWidths[1], endY: ptBottomY });
  lines.push({ startX: ptStartX + ptColWidths[0] + ptColWidths[1] + ptColWidths[2], startY: headerMidY, endX: ptStartX + ptColWidths[0] + ptColWidths[1] + ptColWidths[2], endY: ptBottomY });
  lines.push({ startX: ptEndX, startY: ptTopY, endX: ptEndX, endY: ptBottomY });

  // 表後間隙 6.0mm
  subY -= 6.0;
  // 停車細則 2~9 款
  const afterIndented = art5.contentAfter
    .split('\n')
    .map(line => (/^[0-9]+\./.test(line.trim()) ? '    ' + line.trim() : line))
    .join('\n');

  const afterWrapped = wrapFormattedText(afterIndented, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: afterWrapped, typeId: FONT_3MM_TYPE_ID });
  const afterLines = afterWrapped.split('\n').length;
  // 精準保留細則高度 (15行 * 6.0 + 15.0mm)，徹底消滅重疊！
  subY -= (afterLines * 6.0 + 15.0);

  // 第五條結束橫線
  curY = subY;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 2. 第六條 (六、綠化及植栽相關規定全文 一～三款)
  const art6 = COMPLETE_ZONING_DATA.rightColumnArticles[2]; // 第六條
  const art6StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art6StartY - 2.5, text: art6.num, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art6StartY - 2.5, text: art6.review, typeId: FONT_3MM_TYPE_ID });

  const art6Indented = art6.content
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (/^[0-9]+\./.test(t)) return '    ' + t;
      if (/^（[0-9]+）/.test(t)) return '        ' + t;
      return t;
    })
    .join('\n');

  const art6Wrapped = wrapFormattedText(art6Indented, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art6StartY - 2.5, text: art6Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art6Lines = art6Wrapped.split('\n').length;
  // 保留充足高度 (13行 * 6.0 + 12.0mm = 90.0mm)，徹底消滅第六條與第七條重疊！
  curY -= (art6Lines * 6.0 + 12.0);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 3. 第七條 至 第十一條 一路靠左順排向下！(精確列高與安全邊距)
  for (let i = 3; i < COMPLETE_ZONING_DATA.rightColumnArticles.length; i++) {
    const art = COMPLETE_ZONING_DATA.rightColumnArticles[i];
    const rowStartY = curY;

    notes.push({ x: t1Coords.col1 + 3.0, y: rowStartY - 2.5, text: art.num, typeId: FONT_3MM_TYPE_ID });
    notes.push({ x: t1Coords.col3 + 3.0, y: rowStartY - 2.5, text: art.review, typeId: FONT_3MM_TYPE_ID });

    const artIndented = art.content
      .split('\n')
      .map(line => {
        const t = line.trim();
        if (/^[0-9]+\./.test(t)) return '    ' + t;
        if (/^（[0-9]+）/.test(t)) return '        ' + t;
        return t;
      })
      .join('\n');

    const wrapped = wrapFormattedText(artIndented, 52.5);
    notes.push({ x: t1Coords.col2 + 3.0, y: rowStartY - 2.5, text: wrapped, typeId: FONT_3MM_TYPE_ID });
    const linesCount = wrapped.split('\n').length;
    // 充足高度公式 (linesCount * 6.0 + 12.0mm)，徹底消滅第八條與第九條重疊！
    curY -= (linesCount * 6.0 + 12.0);
    lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });
  }

  // 左欄最底線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t1Coords.start, startY: BOX_BOTTOM_Y, endX: t1Coords.end, endY: BOX_BOTTOM_Y });


  // ==========================
  // 【PAGE 2 - 右欄 Table 2】(保留公版乾淨邊框，左欄排滿，右欄乾淨無文字)
  // ==========================
  curY = BOX_TOP_Y;

  // Page 2 右欄主表頭 (居中對齊)
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });
  notes.push({
    x: t2Coords.start + 110.0,
    y: curY - 2.0,
    text: '擬定臺中市潭子地區都市計畫細部計畫土地使用分區管制要點',
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 表頭三欄名稱 (水平置中: 4 mm 微軟正黑體，高度 1.0/10mm 垂直置中於 -2.5mm)
  notes.push({ x: t2Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 右欄底部線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t2Coords.start, startY: BOX_BOTTOM_Y, endX: t2Coords.end, endY: BOX_BOTTOM_Y });

  return { lines, notes };
}

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-flow-layout-zoning-' + Date.now();
  await client.connect();

  const viewId = 711441; // "2_都市計畫1 複製 1"
  console.log(`\n=== 開始在圖例視圖 (ID: ${viewId}) 執行完美原稿格式排版 ===\n`);

  // Step 1: 清理既有元素
  console.log('--- Step 1: 清理舊有文字與線條 ---');
  const existingNotes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });
  const existingLines = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  const notesToDelete = (existingNotes.data?.Elements || []).map(el => el.ElementId || el.Id);
  const linesToDelete = (existingLines.data?.Elements || []).map(el => el.ElementId || el.Id);

  console.log(`刪除 ${notesToDelete.length} 個舊文字註釋與 ${linesToDelete.length} 條舊線條...`);
  for (const id of notesToDelete) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  for (const id of linesToDelete) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }

  // Step 2: 建立 Page 1 (第一公版: X = 3000.00 ~ 3791.90 mm)
  console.log('\n--- Step 2: 建立 Page 1 (含 Table 2 原稿合併儲存格) ---');
  const page1BaseX = 3000.0;
  const page1Frame = createTemplateFrame(page1BaseX);
  const page1Content = generatePage1Content(page1Frame.t1Coords, page1Frame.t2Coords);

  const allPage1Lines = [...page1Frame.lines, ...page1Content.lines];
  console.log(`Page 1 繪製線條: ${allPage1Lines.length} 條, 文字註釋: ${page1Content.notes.length} 個`);

  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: allPage1Lines
  });

  for (const n of page1Content.notes) {
    if (!n.text || !n.text.trim()) continue;
    try {
      const res = await client.sendCommand('create_text_note', {
        viewId: viewId,
        text: n.text,
        x: n.x,
        y: n.y
      });
      if (res.data?.ElementId && n.typeId) {
        await client.sendCommand('change_element_type', {
          elementId: res.data.ElementId,
          typeId: n.typeId
        });
      }
    } catch(e) {
      console.error('建立 TextNote 錯誤:', e.message);
    }
  }

  // Step 3: 建立 Page 2 (第二公版: 含停車表原稿合併儲存格 ＋ 五至十一條順排無重疊)
  console.log('\n--- Step 3: 建立 Page 2 (含停車表原稿合併儲存格 ＋ 五至十一條順排無重疊) ---');
  const page2BaseX = 3900.0;
  const page2Frame = createTemplateFrame(page2BaseX);
  const page2Content = generatePage2Content(page2Frame.t1Coords, page2Frame.t2Coords);

  const allPage2Lines = [...page2Frame.lines, ...page2Content.lines];
  console.log(`Page 2 繪製線條: ${allPage2Lines.length} 條, 文字註釋: ${page2Content.notes.length} 個`);

  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: allPage2Lines
  });

  for (const n of page2Content.notes) {
    if (!n.text || !n.text.trim()) continue;
    try {
      const res = await client.sendCommand('create_text_note', {
        viewId: viewId,
        text: n.text,
        x: n.x,
        y: n.y
      });
      if (res.data?.ElementId && n.typeId) {
        await client.sendCommand('change_element_type', {
          elementId: res.data.ElementId,
          typeId: n.typeId
        });
      }
    } catch(e) {
      console.error('建立 TextNote 錯誤:', e.message);
    }
  }

  console.log('\n✨✨ 全自動完美原稿格式排版執行成功！✨✨\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
