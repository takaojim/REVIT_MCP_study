/**
 * ==============================================================================
 * 都市計畫土地使用分區管制規則（土管）圖例檢討表格 全局物理幾何與排版引擎
 * 
 * 核心幾何標準與踩坑教訓：
 * 1. 單頁 A102 母框：791.90mm x 524.67mm (基準 X: 3000.00, Y: 3496.25 -> 2971.58)
 * 2. 雙欄結構：Table 1 (左欄) + Table 2 (右欄)，欄寬 393.08mm，間隔 2.31mm
 * 3. 三列分配：法條欄 (15mm) + 條文欄 (220mm，有效 214mm) + 檢討欄 (158.08mm)
 * 4. 滿版黃金常數：50.0 (物理 214mm / 4.25mm 中文字寬 = 50.35 字，嚴格鎖定 50.0 滿版母容量)
 * 5. 全字元物理加權矩陣 (Micro-Metrics Matrix) + 避頭尾禁則 (Kinsoku Shori)
 * 6. 真實物理盒模型：PAD_TOP = 2.00mm, LINE_PITCH = 6.60mm, PAD_BOTTOM = 4.00mm (Revit 3mm 微軟正黑體多行文字真實行距為 6.60mm)
 * 7. 條款級跨欄拆分 (Item-level split)：嚴禁草率跳欄，Part A 貼底、Part B 頂部接續
 * 8. 子表格儲存格全自動物理折行 (Cell Auto-Wrap)：依據各子欄寬度 (colWidths[c]) 換算 maxWeight 自動折行，列高依 max(行數)*6.60 動態撐開，徹底根除字元跨欄重疊！
 * ==============================================================================
 */

// --- 1. 字型類型識別碼 (Revit TextNote Type IDs) ---
export const FONT_3MM_TYPE_ID  = 501966;  // 3 mm 微軟正黑體 (內文與表格專用)
export const FONT_4MM_TYPE_ID  = 695618;  // 4 mm 微軟正黑體 (欄名列專用：法條、土地使用管制規定、本案設計檢討)
export const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm (大標題列專用：通欄合併)

// --- 2. 公版母框標準幾何規格 (A102 單頁雙欄模矩) ---
export const BASE_X         = 3000.00;
export const MASTER_WIDTH   = 791.90;
export const BOX_TOP_Y      = 3494.25;
export const BOX_BOTTOM_Y   = 2973.58;
export const FRAME_TOP_Y    = 3496.25;
export const FRAME_BOTTOM_Y = 2971.58;

export const COL1_W         = 15.0;   // 法條欄寬度
export const COL2_W         = 220.0;  // 土地使用管制規定欄寬度
export const COL3_W         = 158.08; // 本案設計檢討欄寬度
export const COL_TABLE_W    = COL1_W + COL2_W + COL3_W; // 393.08 mm
export const COL_GAP        = 2.31;   // 兩欄間隔

export const TITLE_ROW_H    = 10.0;   // 大標題列高
export const COL_HEADER_H   = 10.0;   // 欄名列高
export const MAX_COLUMN_H   = (BOX_TOP_Y - BOX_BOTTOM_Y) - TITLE_ROW_H - COL_HEADER_H; // 500.67 mm (可用排版淨高)

// 條文欄內縮與有效排版寬度
export const SUB_INSET        = 3.0;   // 條文欄兩側各內縮 3.0mm
export const EFFECTIVE_COL2_W = COL2_W - 2 * SUB_INSET; // 214.0 mm

// --- 3. 精確物理盒模型參數 (Revit 3mm 微軟正黑體真實物理量) ---
export const LINE_PITCH   = 6.60; // 3mm 微軟正黑體真實物理行距 (3.0mm 字高 + 3.60mm Leading，多行連續累加基準)
export const PAD_TOP      = 2.00; // 段落頂部至第一行文字頂端距離
export const PAD_BOTTOM   = 4.00; // 段落最後一行文字頂端至底部橫線之總距離 (實質淨空 = 4.00 - 2.00 = 2.00mm 絕對安全邊距)
export const TOTAL_PAD    = PAD_TOP + PAD_BOTTOM; // 6.00 mm

// --- 4. 滿版黃金常數 ---
export const MAX_WEIGHT_50 = 50.0; // 214.0mm / 4.25mm = 50.35 字，嚴格鎖定 50.0 滿版母容量

/**
 * --- 5. 全字元物理加權矩陣 (Micro-Metrics Matrix) ---
 * 以 Revit 3mm 微軟正黑體標準全形漢字（寬度 4.25mm = 1.00）為基準單位
 */
export function getPreciseCharWeight(char) {
  const code = char.charCodeAt(0);

  // 1. 全形漢字、全形標點、全形符號、特殊法規單位 (㎡、～、Ⅰ、Ⅱ、① 等)
  if (code > 255) {
    return 1.00;
  }

  // 2. 半形空白 (用於 4 格半形懸掛縮排)
  if (code === 32) {
    return 0.40;
  }

  // 3. 半形數字 0-9 (Tabular Figures, 寬度 2.46mm / 4.25mm = 0.578)
  if (code >= 48 && code <= 57) {
    return 0.58;
  }

  // 4. 半形窄標點 (. , : ;)
  if (code === 46 || code === 44 || code === 58 || code === 59) {
    return 0.28;
  }

  // 5. 半形括號與斜線 ( ) [ ] / -
  if (code === 40 || code === 41 || code === 91 || code === 93 || code === 47 || code === 45) {
    return 0.42;
  }

  // 6. 半形寬符號 (% + = < > @ &)
  if (code === 37 || code === 43 || code === 61 || code === 60 || code === 62 || code === 64 || code === 38) {
    return 0.60;
  }

  // 7. 半形英文字母
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
    if ('WMwmQ'.includes(char)) return 0.72; // 寬字母
    if ('ijlIt'.includes(char)) return 0.30; // 窄字母
    return 0.55;                             // 一般字母
  }

  return 0.50; // 其他半形預設
}

/**
 * --- 6. 避頭尾禁則判定 (Kinsoku Shori) ---
 */
export const KINSOKU_HEAD_CHARS = new Set([
  '，', '、', '。', '；', '：', '？', '！', '）', ')', '】', '」', '』', '》', '％', '%', '℃', '”', '’'
]);
export const KINSOKU_TAIL_CHARS = new Set([
  '（', '(', '【', '「', '『', '《', '“', '‘'
]);

/**
 * --- 7. 嚴謹 50.0 滿版折行演算法 (含全階層懸掛縮排與避頭尾禁則) ---
 */
export function wrapFormattedText50(text, maxWeight = MAX_WEIGHT_50) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      wrappedLines.push('');
      continue;
    }

    let indentSpaces = '';
    const match = para.match(/^(\s+)/);
    if (match) {
      indentSpaces = match[1];
    }

    const trimmed = para.trim();
    let subIndent = indentSpaces;

    // 懸掛縮排層級判定 (Hanging Indent Hierarchy)
    if (/^（[一二三四五六七八九十]+）/.test(trimmed) || /^\([一二三四五六七八九十]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '    '; // Level 1: 4 個半形空白
    } else if (/^[0-9]+\./.test(trimmed)) {
      subIndent = indentSpaces + '    '; // Level 2: 4 個半形空白
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '      '; // Level 3: 6 個半形空白
    }

    let curLine = '';
    let curWeight = 0;

    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const nextChar = para[i + 1] || '';
      const weight = getPreciseCharWeight(char);

      // 避頭點保護：如果下一個字是行首禁則字元（如逗號、句號、百分比），且本行已接近上限，提前換行連帶將本字與標點移至次行
      const isNearLimit = (curWeight + weight > maxWeight) || 
                          (curWeight + weight + getPreciseCharWeight(nextChar) > maxWeight && KINSOKU_HEAD_CHARS.has(nextChar));

      if (isNearLimit && curLine.length > 0) {
        wrappedLines.push(curLine);
        curLine = subIndent + char;
        let subWeight = 0;
        for (let c of subIndent) subWeight += getPreciseCharWeight(c);
        curWeight = subWeight + weight;
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

/**
 * --- 8. 動態子表格渲染引擎 (Sub-Table Render Engine - 具備儲存格精確物理折行與動態列高) ---
 */
export function renderDynamicTable({
  startX,
  startY,
  colWidths,
  headers,
  headerHeight = 8.0,
  rows,
  minRowHeight = 8.0
}) {
  const lines = [];
  const notes = [];

  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const endX = startX + tableWidth;

  const colPositions = [startX];
  let curColX = startX;
  for (const w of colWidths) {
    curColX += w;
    colPositions.push(curColX);
  }

  let curY = startY;

  // 1. 表頭列
  const headerTopY = curY;
  const headerBottomY = curY - headerHeight;
  lines.push({ startX, startY: headerTopY, endX, endY: headerTopY });
  lines.push({ startX, startY: headerBottomY, endX, endY: headerBottomY });

  for (let c = 0; c < headers.length; c++) {
    const colLeft = colPositions[c];
    const textY = headerTopY - 2.0;
    notes.push({
      x: colLeft + 2.0,
      y: textY,
      text: headers[c],
      typeId: FONT_3MM_TYPE_ID
    });
  }

  curY = headerBottomY;

  // 2. 資料列（每個儲存格依據該欄實體寬度 colWidths[c] 進行精確折行）
  for (const row of rows) {
    const rowTopY = curY;
    const wrappedCells = [];
    let maxCellLines = 1;

    for (let c = 0; c < row.length; c++) {
      const cellText = row[c] || '';
      const colW = colWidths[c];
      // 儲存格淨寬度 = 欄寬 - 2 * 2.0mm 邊距
      const netCellW = Math.max(8.0, colW - 4.0);
      const cellMaxWeight = (netCellW / 4.25);

      const wrapped = wrapFormattedText50(cellText, cellMaxWeight);
      wrappedCells.push(wrapped);

      const cellLines = wrapped.split('\n').length;
      if (cellLines > maxCellLines) maxCellLines = cellLines;
    }

    // 動態列高 = 頂部 2.0mm + 行數 * 6.60mm + 底部 2.0mm
    const calculatedRowH = 2.0 + maxCellLines * LINE_PITCH + 2.0;
    const actualRowH = Math.max(minRowHeight, calculatedRowH);
    const rowBottomY = rowTopY - actualRowH;

    for (let c = 0; c < wrappedCells.length; c++) {
      const colLeft = colPositions[c];
      const cellText = wrappedCells[c];
      const textY = rowTopY - 2.0;
      notes.push({
        x: colLeft + 2.0,
        y: textY,
        text: cellText,
        typeId: FONT_3MM_TYPE_ID
      });
    }

    lines.push({ startX, startY: rowBottomY, endX, endY: rowBottomY });
    curY = rowBottomY;
  }

  // 3. 垂直分隔線
  for (const x of colPositions) {
    lines.push({ startX: x, startY: startY, endX: x, endY: curY });
  }

  return {
    lines,
    notes,
    endY: curY,
    tableHeight: startY - curY
  };
}
