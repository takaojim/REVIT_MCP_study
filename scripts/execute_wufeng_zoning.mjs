import { RevitSocketClient } from '../MCP-Server/build/socket.js';

// Text Note Type IDs
const FONT_3MM_TYPE_ID = 501966;  // 3 mm 微軟正黑體
const FONT_4MM_TYPE_ID = 695618;  // 4 mm 微軟正黑體 (表頭專用)
const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm (大標題專用)

// 公版母版基準尺寸 (寬度 791.9mm, 高度 524.67mm)
const MASTER_ORIGIN_X = 3000.00;
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
const COL_GAP = 2.31; // 2.31mm 間隙

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

  // 大標題橫跨三欄為合併列，內部垂直線 t1Col2 與 t1Col3 不得穿入大標題列！
  const TITLE_ROW_H = 10.0;
  const colDividerStartY = BOX_TOP_Y - TITLE_ROW_H; // Y = 3484.25

  // 左欄四邊與三欄直線
  lines.push({ startX: t1Left, startY: BOX_TOP_Y, endX: t1Right, endY: BOX_TOP_Y });
  lines.push({ startX: t1Left, startY: BOX_BOTTOM_Y, endX: t1Right, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col1, startY: BOX_TOP_Y, endX: t1Col1, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col2, startY: colDividerStartY, endX: t1Col2, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Col3, startY: colDividerStartY, endX: t1Col3, endY: BOX_BOTTOM_Y });
  lines.push({ startX: t1Right, startY: BOX_TOP_Y, endX: t1Right, endY: BOX_BOTTOM_Y });

  // 右欄四邊與三欄直線
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

// 產生 Page 1 雙欄完整法規排版內容
function generateWufengPage1Content(t1Coords, t2Coords) {
  const lines = [];
  const notes = [];

  const titleHeight = 10.0;
  const colHeaderHeight = 10.0;
  const TITLE_TEXT = '霧峰地區都市計畫細部計畫土地使用分區管制要點';

  // ==========================
  // 【PAGE 1 - 左欄 Table 1】(一 至 十一條)
  // ==========================
  let curY = BOX_TOP_Y;

  // 主表頭
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });
  notes.push({
    x: t1Coords.start + 110.0,
    y: curY - 2.0,
    text: TITLE_TEXT,
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 表頭三欄名稱
  notes.push({ x: t1Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 1. 第一條 (一、法源依據)
  const art1StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art1StartY - 2.5, text: '一、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art1StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art1Text = '本要點依據都市計畫法第22條、第32條及都市計畫法臺中市施行自治條例第49條規定訂定之。';
  const art1Wrapped = wrapFormattedText(art1Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art1StartY - 2.5, text: art1Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art1Lines = art1Wrapped.split('\n').length;
  curY -= (art1Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 2. 第二條 (二、土地使用分區強度表)
  const art2StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art2StartY - 2.5, text: '二、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art2StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

  let subY = art2StartY - 2.5;
  const art2Intro = '本計畫區內各種土地使用分區之建蔽率、容積率不得大於下表規定：';
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: art2Intro, typeId: FONT_3MM_TYPE_ID });
  subY -= (LINE_PITCH + 2.5);

  // 子表 1 (使用分區)
  const SUB_INSET = 3.0;
  const t1StartX = t1Coords.col2 + SUB_INSET;
  const t1EndX   = t1Coords.col2 + COL2_W - SUB_INSET;
  const sub1ColWidths = [74.0, 70.0, 70.0];
  const t1TopY = subY + 1.0;

  lines.push({ startX: t1StartX, startY: t1TopY, endX: t1EndX, endY: t1TopY });
  const sub1Headers = ['使用分區', '建蔽率（％）', '容積率（％）'];
  let hX = t1StartX;
  for (let c = 0; c < sub1Headers.length; c++) {
    notes.push({ x: hX + 18.0, y: subY, text: sub1Headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += sub1ColWidths[c];
  }
  subY -= (LINE_PITCH + 1.0);
  lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

  const sub1Rows = [
    ['住宅區', '60', '200'],
    ['商業區', '80', '320'],
    ['乙種工業區', '60', '210'],
    ['宗教專用區', '50', '160'],
    ['電信專用區', '50', '250']
  ];

  for (const row of sub1Rows) {
    const rowTopY = subY;
    const rowH = LINE_PITCH + 1.2;

    let rX = t1StartX;
    notes.push({ x: rX + 22.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
    rX += sub1ColWidths[0];
    notes.push({ x: rX + 28.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
    rX += sub1ColWidths[1];
    notes.push({ x: rX + 28.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });

    subY -= rowH;
    lines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
  }

  const t1BottomY = subY + 1.0;
  let subVX = t1StartX;
  lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
  for (let c = 0; c < sub1ColWidths.length - 1; c++) {
    subVX += sub1ColWidths[c];
    lines.push({ startX: subVX, startY: t1TopY, endX: subVX, endY: t1BottomY });
  }
  lines.push({ startX: t1EndX, startY: t1TopY, endX: t1EndX, endY: t1BottomY });

  curY = subY - 3.5;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 3. 第三條 (三、乙工公共服務與公用事業設施)
  const art3StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art3StartY - 2.5, text: '三、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art3StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art3Text = '乙種工業區申請設置公共服務設施及公用事業設施，其使用細目、使用面積、使用條件及管理維護事項之核准條件如附表；申請作業程序及應備書件，依「臺中市都市計畫甲種乙種工業區土地申請設置公共服務設施及公用事業設施總量管制作業要點」規定辦理。';
  const art3Wrapped = wrapFormattedText(art3Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art3StartY - 2.5, text: art3Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art3Lines = art3Wrapped.split('\n').length;
  curY -= (art3Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 4. 第四條 (四、電信專用區)
  const art4StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art4StartY - 2.5, text: '四、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art4StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art4Text = '電信專用區之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。';
  const art4Wrapped = wrapFormattedText(art4Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art4StartY - 2.5, text: art4Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art4Lines = art4Wrapped.split('\n').length;
  curY -= (art4Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 5. 第五條 (五、公共設施用地強度表，含學校用地合併儲存格)
  const art5StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art5StartY - 2.5, text: '五、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art5StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

  subY = art5StartY - 2.5;
  const art5Intro = '本計畫區內各項公共設施用地之建蔽率與容積率不得大於下表規定：';
  notes.push({ x: t1Coords.col2 + 3.0, y: subY, text: art5Intro, typeId: FONT_3MM_TYPE_ID });
  subY -= (LINE_PITCH + 2.5);

  const t2StartX = t1Coords.col2 + SUB_INSET;
  const t2EndX   = t1Coords.col2 + COL2_W - SUB_INSET;
  const sub2ColWidths = [74.0, 70.0, 70.0];
  const t2TopY = subY + 1.0;

  lines.push({ startX: t2StartX, startY: t2TopY, endX: t2EndX, endY: t2TopY });
  const sub2Headers = ['公共設施種類', '建蔽率（％）', '容積率（％）'];
  hX = t2StartX;
  for (let c = 0; c < sub2Headers.length; c++) {
    notes.push({ x: hX + 16.0, y: subY, text: sub2Headers[c], typeId: FONT_3MM_TYPE_ID });
    hX += sub2ColWidths[c];
  }
  subY -= (LINE_PITCH + 1.0);
  lines.push({ startX: t2StartX, startY: subY + 1.0, endX: t2EndX, endY: subY + 1.0 });

  // 學校用地分割短線 X 座標 (左側 26mm「學校用地」，右側 48mm「國中以下 / 高中職」)
  const SCHOOL_SPLIT_X = t2StartX + 26.0;
  let schoolTopY = 0;
  let schoolBottomY = 0;

  const sub2Rows = [
    { type: 'normal', item: '市場用地', cov: '60', far: '240' },
    { type: 'school_1', item: '學校用地', sub: '國中以下', cov: '40', far: '150' },
    { type: 'school_2', item: '', sub: '高中職', cov: '40', far: '200' },
    { type: 'normal', item: '機關用地', cov: '50', far: '250' },
    { type: 'normal', item: '社教用地', cov: '50', far: '200' },
    { type: 'normal', item: '汙水處理場用地', cov: '50', far: '150' },
    { type: 'normal', item: '變電所用地', cov: '50', far: '250' },
    { type: 'normal', item: '自來水事業用地', cov: '50', far: '250' },
    { type: 'normal', item: '電力事業用地', cov: '50', far: '250' },
    { type: 'normal', item: '郵政事業用地', cov: '50', far: '250' },
    { type: 'normal', item: '社會福利設施用地', cov: '50', far: '400' }
  ];

  for (let rIdx = 0; rIdx < sub2Rows.length; rIdx++) {
    const row = sub2Rows[rIdx];
    const rowTopY = subY;
    const rowH = LINE_PITCH + 1.2;

    if (row.type === 'school_1') {
      schoolTopY = subY + 1.0;
      notes.push({ x: t2StartX + 4.0, y: rowTopY - 2.5, text: '學校用地', typeId: FONT_3MM_TYPE_ID });
      notes.push({ x: SCHOOL_SPLIT_X + 8.0, y: rowTopY, text: row.sub, typeId: FONT_3MM_TYPE_ID });
    } else if (row.type === 'school_2') {
      notes.push({ x: SCHOOL_SPLIT_X + 11.0, y: rowTopY, text: row.sub, typeId: FONT_3MM_TYPE_ID });
    } else {
      notes.push({ x: t2StartX + 18.0, y: rowTopY, text: row.item, typeId: FONT_3MM_TYPE_ID });
    }

    let rX = t2StartX + sub2ColWidths[0];
    notes.push({ x: rX + 28.0, y: rowTopY, text: row.cov, typeId: FONT_3MM_TYPE_ID });
    rX += sub2ColWidths[1];
    notes.push({ x: rX + 28.0, y: rowTopY, text: row.far, typeId: FONT_3MM_TYPE_ID });

    subY -= rowH;

    if (row.type === 'school_2') {
      schoolBottomY = subY + 1.0;
    }

    if (row.type === 'school_1') {
      lines.push({ startX: SCHOOL_SPLIT_X, startY: subY + 1.0, endX: t2EndX, endY: subY + 1.0 });
    } else {
      lines.push({ startX: t2StartX, startY: subY + 1.0, endX: t2EndX, endY: subY + 1.0 });
    }
  }

  const t2BottomY = subY + 1.0;
  subVX = t2StartX;
  lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
  for (let c = 0; c < sub2ColWidths.length - 1; c++) {
    subVX += sub2ColWidths[c];
    lines.push({ startX: subVX, startY: t2TopY, endX: subVX, endY: t2BottomY });
  }
  lines.push({ startX: t2EndX, startY: t2TopY, endX: t2EndX, endY: t2BottomY });

  // 學校用地內部垂直分割短線
  lines.push({ startX: SCHOOL_SPLIT_X, startY: schoolTopY, endX: SCHOOL_SPLIT_X, endY: schoolBottomY });

  curY = subY - 3.5;
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 6. 第六條 (六、機關用地經營管理)
  const art6StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art6StartY - 2.5, text: '六、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art6StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art6Text = '機關用地（霧-機3）內議員會館及機關用地（霧-機5）內國立臺灣交響樂團坐落範圍，依促進民間參與公共建設法相關規定辦理委外經營管理時，其使用項目得為旅館業及其附屬設施使用。';
  const art6Wrapped = wrapFormattedText(art6Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art6StartY - 2.5, text: art6Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art6Lines = art6Wrapped.split('\n').length;
  curY -= (art6Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 7. 第七條 (七、社會福利設施用地規定)
  const art7StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art7StartY - 2.5, text: '七、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art7StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art7Text = `社會福利設施用地得為下列之使用：
（一）作社會住宅使用。
（二）依住宅法第33條規定，應保留一定空間供作社會福利服務、長期照顧服務、身心障礙服務、托育服務、幼兒園、青年創業空間、社區活動、文康休閒活動、商業活動、餐飲服務或其他必要附屬設施之用。
（三）其他經臺中市都市計畫委員會同意容許使用項目。`;
  const art7Wrapped = wrapFormattedText(art7Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art7StartY - 2.5, text: art7Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art7Lines = art7Wrapped.split('\n').length;
  curY -= (art7Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 8. 第八條 (八、社教用地退縮規定)
  const art8StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art8StartY - 2.5, text: '八、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art8StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art8Text = `「霧-社2」社教用地專供設置九二一地震教育園區及其他相關附屬設施使用，提供展示空間及教育活動等，並得設置行政辦公廳舍及餐飲服務設施，且新建建築物應自基地北側計畫道路境界線至少退縮5公尺建築，退縮部分得計入法定空地，並應妥為植栽綠化。`;
  const art8Wrapped = wrapFormattedText(art8Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art8StartY - 2.5, text: art8Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art8Lines = art8Wrapped.split('\n').length;
  curY -= (art8Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 9. 第九條 (九、公益性設施獎勵)
  const art9StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art9StartY - 2.5, text: '九、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art9StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art9Text = `為鼓勵設置公益性設施，除經劃設為都市更新單元之地區，另依都市更新條例規定辦理外，訂定下列獎勵措施；其建築物提供部分樓地板面積供下列使用，得增加所提供之樓地板面積，但以不超過基地面積乘以該基地容積率之10％為限：
（一）私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人等活動中心、景觀公共設施等供公眾使用；其集中留設之樓地板面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者外，申請建造執照時，前開公益性基金會應為公益性設施之起造人。
（二）建築物留設空間與天橋或地下道連接供公眾使用，經道路主管機關核准者。`;
  const art9Wrapped = wrapFormattedText(art9Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art9StartY - 2.5, text: art9Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art9Lines = art9Wrapped.split('\n').length;
  curY -= (art9Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 10. 第十條 (十、公園用地地下停車場)
  const art10StartY = curY;
  notes.push({ x: t1Coords.col1 + 3.0, y: art10StartY - 2.5, text: '十、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art10StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art10Text = '本計畫「霧-公1」公園用地得依都市計畫公共設施用地多目標使用辦法規定優先興建地下停車場供公共停車使用。';
  const art10Wrapped = wrapFormattedText(art10Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art10StartY - 2.5, text: art10Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art10Lines = art10Wrapped.split('\n').length;
  curY -= (art10Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 11. 第十一條 (十一、霧峰聯合辦公廳舍退縮)
  const art11StartY = curY;
  notes.push({ x: t1Coords.col1 + 1.5, y: art11StartY - 2.5, text: '十一、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 3.0, y: art11StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art11Text = '霧峰聯合辦公廳舍範圍應自道路境界線至少退縮2公尺建築，其退縮地不計入法定空地面積。';
  const art11Wrapped = wrapFormattedText(art11Text, 52.5);
  notes.push({ x: t1Coords.col2 + 3.0, y: art11StartY - 2.5, text: art11Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art11Lines = art11Wrapped.split('\n').length;
  curY -= (art11Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t1Coords.start, startY: curY, endX: t1Coords.end, endY: curY });

  // 左欄最底線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t1Coords.start, startY: BOX_BOTTOM_Y, endX: t1Coords.end, endY: BOX_BOTTOM_Y });


  // ==========================
  // 【PAGE 1 - 右欄 Table 2】(十二 至 十八條)
  // ==========================
  curY = BOX_TOP_Y;

  // 右欄主表頭
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });
  notes.push({
    x: t2Coords.start + 110.0,
    y: curY - 2.0,
    text: TITLE_TEXT,
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= titleHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 表頭三欄名稱
  notes.push({ x: t2Coords.col1 + 3.5, y: curY - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col2 + 94.0, y: curY - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 67.0, y: curY - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= colHeaderHeight;
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 12. 第十二條 (十二、法定空地綠化規定)
  const art12StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art12StartY - 2.5, text: '十二、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art12StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art12Text = '建築基地內之法定空地扣除依相關法令規定無法綠化之面積後應留設二分之一以上種植花草樹木予以綠化；但因設置無遮簷人行道、裝卸位、車道及現有道路，致法定空地未達應種植花草樹木面積者，則僅限實設空地須種植花草樹木，並依建築技術規則建築設計施工編綠建築基準之建築基地綠化規定以綠化總二氧化碳固定量及二氧化碳固定量基準值做檢討。法定空地面積每滿64平方公尺應至少植喬木1棵，其綠化工程應納入建築設計圖說於請領建造執照時一併核定之，覆土深度草皮應至少30公分、灌木應至少60公分、喬木應至少120公分。';
  const art12Wrapped = wrapFormattedText(art12Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art12StartY - 2.5, text: art12Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art12Lines = art12Wrapped.split('\n').length;
  curY -= (art12Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 13. 第十三條 (十三、都市設計審議範圍)
  const art13StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art13StartY - 2.5, text: '十三、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art13StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art13Text = `本計畫區內應提送都市設計審議範圍：
（一）公有建築之審議依臺中市公有建築應送都市設計委員會審議要點規定辦理。
（二）公用事業（包括電信局、航空站、大客車運輸業之轉運站、公私立大型醫院、文大及文教區等）建築申請案之總樓地板超過10,000平方公尺者。
（三）新建建築達以下規模：
    1. 新建建築樓層高度12層以上。
    2. 住宅區新建之建築基地面積超過6,000平方公尺者。
    3. 商業區新建之建築基地面積超過3,000平方公尺者。
    4. 住宅區及商業區新建總樓地板面積超過30,000平方公尺者。
（四）新闢立體停車場基地面積6,000平方公尺以上者。但建築物附屬停車場者，不在此限。
（五）實施容積管制前已申請或領有建造執照，在建造執照有效期間內，依建築技術規則建築設計施工編第166條之1第2項執照之申請案。
前項各款建築基地之建築基地規模、開放空間、人車通行系統、交通運輸系統、建築量體造型與色彩、景觀計畫、環境保護設施、防災空間、氣候調適與管理維護計畫等都市設計相關事項，應提送臺中市政府都市設計審議委員會審議，經審議通過後，始依法核發建照。`;
  const art13Wrapped = wrapFormattedText(art13Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art13StartY - 2.5, text: art13Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art13Lines = art13Wrapped.split('\n').length;
  curY -= (art13Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 14. 第十四條 (十四、老舊建物重建獎勵)
  const art14StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art14StartY - 2.5, text: '十四、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art14StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art14Text = `為鼓勵都市老舊地區申辦獎勵老舊建物重建，屬商業區及住宅區之建築基地，其達都市設計審議規模者從其規定，符合下列條件得予以獎勵基準容積之20％或15％：
（一）基地面積500平方公尺以上，30年以上鋼筋混凝土造、預鑄混凝土造及鋼骨混凝土造合法建築物坐落之建築基地與其他土地上之違章建築物投影面積合計達申請重建基地面積之二分之一，其中30年以上合法建築物坐落之建築基地應達前述面積總和二分之一，得申請獎勵基準容積之20％。
（二）基地面積500平方公尺以上，土磚造、木造、磚造及石造合法建築物、20年以上之加強磚造及鋼鐵造合法建築物坐落之建築基地與其他土地上之違章建築物投影面積合計達申請重建基地面積之二分之一，其中合法建築物坐落之建築基地應達前述面積總和二分之一，得申請獎勵基準容積之15％。
（三）經全部土地所有權人同意。
（四）建築配置時，應自基地退縮二側，包括基地後側及側面，側面得選擇一側並連通至道路，該退縮淨寬至少1.5公尺。
（五）不得再申請建築技術規則所訂定開放空間獎勵。`;
  const art14Wrapped = wrapFormattedText(art14Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art14StartY - 2.5, text: art14Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art14Lines = art14Wrapped.split('\n').length;
  curY -= (art14Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 15. 第十五條 (十五、停車空間)
  const art15StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art15StartY - 2.5, text: '十五、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art15StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art15Text = `停車空間
（一）本計畫區建築物附設停車空間設置標準依建築技術規則設計施工編第59條所列第一類建築物用途，樓地板面積300平方公尺以下免設汽車停車位，但至少須設置1輛機車（或自行車）停車位，超過300平方公尺部分每150平方公尺設置1輛汽車與1輛機車（或自行車）停車位；第二類建築物用途，樓地板面積500平方公尺以下免設汽車停車位，超過500平方公尺部分每150平方公尺設置1輛汽車停車位與1輛機車（或自行車）停車位。
（二）機車（或自行車）停車位標準為每輛之長度不得小於1.8公尺、寬度不得小於0.9公尺，其集中設置部數在20部（含）以上者，得以每部4平方公尺核計免計入總樓地板面積，機車（或自行車）停車位應設置於地面層或地下一層，必要時得延伸至地下二層。`;
  const art15Wrapped = wrapFormattedText(art15Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art15StartY - 2.5, text: art15Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art15Lines = art15Wrapped.split('\n').length;
  curY -= (art15Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 16. 第十六條 (十六、受保護樹木之保護)
  const art16StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art16StartY - 2.5, text: '十六、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art16StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art16Text = `受保護樹木之保護
（一）為保存與維護計畫區內經本府認定並公告列管之「受保護樹木」及其必要生育地環境，應依「臺中市樹木保護自治條例」之規定辦理。
（二）建築基地及公共設施用地申請建築開發時，應配合受保護樹木位置集中留設開放空間，以其必要生育地環境及面積至少50平方公尺之範圍為原則，得計本要點第九條之應綠化面積。惟經「臺中市樹木保護委員會」審議同意無需原地保留之受保護樹木者不在此限。
（三）建築基地及公共設施用地申請建築開發時，應檢附基地現況植栽調查與測量資料，至少包括樹種、位置、樹徑樹冠等相關資料。`;
  const art16Wrapped = wrapFormattedText(art16Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art16StartY - 2.5, text: art16Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art16Lines = art16Wrapped.split('\n').length;
  curY -= (art16Lines * LINE_PITCH + 5.0);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 17. 第十七條 (十七、細部計畫管轄規定)
  const art17StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art17StartY - 2.5, text: '十七、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art17StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art17Text = '建築基地屬已發布細部計畫範圍內之土地，其土地及建築物之使用，悉依該細部計畫之規定辦理；其餘未規定事項或細部計畫未訂定土地使用分區管制要點之地區，應依本要點管制之。';
  const art17Wrapped = wrapFormattedText(art17Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art17StartY - 2.5, text: art17Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art17Lines = art17Wrapped.split('\n').length;
  curY -= (art17Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 18. 第十八條 (十八、其他法令適用)
  const art18StartY = curY;
  notes.push({ x: t2Coords.col1 + 1.5, y: art18StartY - 2.5, text: '十八、', typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 3.0, y: art18StartY - 2.5, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });
  const art18Text = '本要點未規定事項適用都市計畫法臺中市施行自治條例及其他有關法令之規定辦理。';
  const art18Wrapped = wrapFormattedText(art18Text, 52.5);
  notes.push({ x: t2Coords.col2 + 3.0, y: art18StartY - 2.5, text: art18Wrapped, typeId: FONT_3MM_TYPE_ID });
  const art18Lines = art18Wrapped.split('\n').length;
  curY -= (art18Lines * LINE_PITCH + 4.5);
  lines.push({ startX: t2Coords.start, startY: curY, endX: t2Coords.end, endY: curY });

  // 右欄最底線貼齊 BOX_BOTTOM_Y
  lines.push({ startX: t2Coords.start, startY: BOX_BOTTOM_Y, endX: t2Coords.end, endY: BOX_BOTTOM_Y });

  return { lines, notes };
}

// 產生 Page 2 備用母版框 (乾淨留白，作為標準備用出圖欄位)
function generatePage2BlankContent(t1Coords, t2Coords) {
  const lines = [];
  const notes = [];

  const titleHeight = 10.0;
  const colHeaderHeight = 10.0;
  const TITLE_TEXT = '霧峰地區都市計畫細部計畫土地使用分區管制要點';

  // Page 2 左欄主表頭
  lines.push({ startX: t1Coords.start, startY: BOX_TOP_Y, endX: t1Coords.end, endY: BOX_TOP_Y });
  notes.push({
    x: t1Coords.start + 110.0,
    y: BOX_TOP_Y - 2.0,
    text: TITLE_TEXT,
    typeId: FONT_45MM_TYPE_ID
  });
  lines.push({ startX: t1Coords.start, startY: BOX_TOP_Y - titleHeight, endX: t1Coords.end, endY: BOX_TOP_Y - titleHeight });
  notes.push({ x: t1Coords.col1 + 3.5, y: BOX_TOP_Y - titleHeight - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col2 + 94.0, y: BOX_TOP_Y - titleHeight - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t1Coords.col3 + 67.0, y: BOX_TOP_Y - titleHeight - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });
  lines.push({ startX: t1Coords.start, startY: BOX_TOP_Y - titleHeight - colHeaderHeight, endX: t1Coords.end, endY: BOX_TOP_Y - titleHeight - colHeaderHeight });
  lines.push({ startX: t1Coords.start, startY: BOX_BOTTOM_Y, endX: t1Coords.end, endY: BOX_BOTTOM_Y });

  // Page 2 右欄主表頭
  lines.push({ startX: t2Coords.start, startY: BOX_TOP_Y, endX: t2Coords.end, endY: BOX_TOP_Y });
  notes.push({
    x: t2Coords.start + 110.0,
    y: BOX_TOP_Y - 2.0,
    text: TITLE_TEXT,
    typeId: FONT_45MM_TYPE_ID
  });
  lines.push({ startX: t2Coords.start, startY: BOX_TOP_Y - titleHeight, endX: t2Coords.end, endY: BOX_TOP_Y - titleHeight });
  notes.push({ x: t2Coords.col1 + 3.5, y: BOX_TOP_Y - titleHeight - 2.5, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col2 + 94.0, y: BOX_TOP_Y - titleHeight - 2.5, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: t2Coords.col3 + 67.0, y: BOX_TOP_Y - titleHeight - 2.5, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });
  lines.push({ startX: t2Coords.start, startY: BOX_TOP_Y - titleHeight - colHeaderHeight, endX: t2Coords.end, endY: BOX_TOP_Y - titleHeight - colHeaderHeight });
  lines.push({ startX: t2Coords.start, startY: BOX_BOTTOM_Y, endX: t2Coords.end, endY: BOX_BOTTOM_Y });

  return { lines, notes };
}

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-wufeng-zoning-' + Date.now();
  await client.connect();

  const viewId = 721395; // "2_都市計畫1 測試霧峰"
  console.log(`\n=== 開始在圖例視圖「2_都市計畫1 測試霧峰」(ID: ${viewId}) 執行霧峰都市計畫排版 ===\n`);

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
  console.log('\n--- Step 2: 建立 Page 1 (包含完整一至十八條法規與二大強度表格) ---');
  const page1BaseX = 3000.0;
  const page1Frame = createTemplateFrame(page1BaseX);
  const page1Content = generateWufengPage1Content(page1Frame.t1Coords, page1Frame.t2Coords);

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

  // Step 3: 建立 Page 2 (第二公版備用框: X = 3900.00 ~ 4691.90 mm)
  console.log('\n--- Step 3: 建立 Page 2 (標準備用公版母框) ---');
  const page2BaseX = 3900.0;
  const page2Frame = createTemplateFrame(page2BaseX);
  const page2Content = generatePage2BlankContent(page2Frame.t1Coords, page2Frame.t2Coords);

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

  console.log('\n✨✨ 霧峰都市計畫細部計畫土地使用分區管制要點排版成功完成！✨✨\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
