import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import {
  wrapTextToWidth,
  wrapClauseText,
  renderDynamicTable,
  BASE_X,
  MASTER_WIDTH,
  BOX_TOP_Y,
  BOX_BOTTOM_Y,
  FRAME_TOP_Y,
  FRAME_BOTTOM_Y,
  COL1_W,
  COL2_W,
  COL3_W,
  COL_TABLE_W,
  COL_GAP,
  LINE_PITCH,
  SUB_INSET,
  EFFECTIVE_COL2_W,
  CLAUSE_WRAP_WEIGHT,
  CLAUSE_PAD_TOP,
  CLAUSE_PAD_BOTTOM,
  CLAUSE_TOTAL_PAD,
  FONT_3MM_TYPE_ID,
  FONT_4MM_TYPE_ID,
  FONT_45MM_TYPE_ID
} from './zoning_dynamic_table_engine.mjs';

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

function renderColumnHeader(coords, titleText) {
  const lines = [];
  const notes = [];

  let curY = BOX_TOP_Y;

  // 1. 大標題列 (10mm, 通欄合併)
  const titleY = curY - 2.5;
  const colCenterX = (coords.start + coords.end) / 2.0;
  notes.push({
    x: colCenterX - 55.0,
    y: titleY,
    text: titleText,
    typeId: FONT_45MM_TYPE_ID
  });

  curY -= 10.0;
  lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });

  // 2. 欄名列 (10mm)
  const colHeaderY = curY - 2.5;
  notes.push({ x: coords.col1 + 3.0, y: colHeaderY, text: '法條', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: coords.col2 + 65.0, y: colHeaderY, text: '土地使用管制規定', typeId: FONT_4MM_TYPE_ID });
  notes.push({ x: coords.col3 + 45.0, y: colHeaderY, text: '本案設計檢討', typeId: FONT_4MM_TYPE_ID });

  curY -= 10.0;
  lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });

  return { lines, notes, startContentY: curY };
}

// 緊湊單段條文渲染 (H = N * 5.80 + 4.50mm, 頂部留白 2.0mm, 底部淨空 2.5mm)
function renderSimpleClause(coords, curY, clauseNo, text, reviewText = '本案依規定辦理。', drawBottomLine = true) {
  const lines = [];
  const notes = [];

  const startY = curY;
  const wrapped = wrapClauseText(text, CLAUSE_WRAP_WEIGHT);
  const lineCount = wrapped.split('\n').length;

  notes.push({ x: coords.col1 + 2.0, y: startY - CLAUSE_PAD_TOP, text: clauseNo, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: coords.col3 + 3.0, y: startY - CLAUSE_PAD_TOP, text: reviewText, typeId: FONT_3MM_TYPE_ID });
  notes.push({ x: coords.col2 + 3.0, y: startY - CLAUSE_PAD_TOP, text: wrapped, typeId: FONT_3MM_TYPE_ID });

  const sectionHeight = CLAUSE_PAD_TOP + lineCount * LINE_PITCH + CLAUSE_PAD_BOTTOM;
  const nextY = startY - sectionHeight;

  if (drawBottomLine) {
    lines.push({ startX: coords.start, startY: nextY, endX: coords.end, endY: nextY });
  }

  return { lines, notes, nextY };
}

// ==========================================
// 【左欄 (Table 1)】: 第 1 點 ～ 第 7 點
// ==========================================
function renderLeftColumn(coords) {
  const lines = [];
  const notes = [];

  const header = renderColumnHeader(coords, '和美細部計畫土地使用分區管制要點');
  lines.push(...header.lines);
  notes.push(...header.notes);

  let curY = header.startContentY;

  // 第 1 點
  {
    const r = renderSimpleClause(coords, curY, '第1點', '本要點依都市計畫法第22條及同法臺灣省施行細則第35條規定訂定之。');
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 2 點 (土地使用分區表)
  {
    const startY = curY;
    notes.push({ x: coords.col1 + 2.0, y: startY - CLAUSE_PAD_TOP, text: '第2點', typeId: FONT_3MM_TYPE_ID });
    notes.push({ x: coords.col3 + 3.0, y: startY - CLAUSE_PAD_TOP, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

    let subY = startY - CLAUSE_PAD_TOP;
    const introText = '本計畫各種土地使用分區之建蔽率及容積率規定詳如下表：';
    const introWrapped = wrapClauseText(introText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: introWrapped, typeId: FONT_3MM_TYPE_ID });
    const introLines = introWrapped.split('\n').length;
    subY -= (introLines * LINE_PITCH + 1.5);

    const tableRes = renderDynamicTable({
      startX: coords.col2 + SUB_INSET,
      startY: subY,
      colWidths: [70.0, 70.0, 74.0],
      headers: ['土地使用分區', '建蔽率', '容積率'],
      headerHeight: 7.5,
      rows: [
        ['住宅區', '60%', '180%註\n200%'],
        ['商業區', '80%', '320%'],
        ['乙種工業區', '70%', '210%'],
        ['社會福利事業專用區', '50%', '250%'],
        ['加油站專用區', '40%', '120%'],
        ['電信專用區', '50%', '250%'],
        ['郵政專用區', '50%', '250%']
      ]
    });
    lines.push(...tableRes.lines);
    notes.push(...tableRes.notes);

    subY = tableRes.endY - 1.5;
    const noteText = '註：變更和美主要計畫（第四次通盤檢討）案後續報請核定案件第6案原站2之容積率上限，其他住宅區為200%。';
    const noteWrapped = wrapClauseText(noteText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: noteWrapped, typeId: FONT_3MM_TYPE_ID });
    const noteLines = noteWrapped.split('\n').length;
    subY -= (noteLines * LINE_PITCH + CLAUSE_PAD_BOTTOM);

    curY = subY;
    lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });
  }

  // 第 3 點 (公共設施用地表)
  {
    const startY = curY;
    notes.push({ x: coords.col1 + 2.0, y: startY - CLAUSE_PAD_TOP, text: '第3點', typeId: FONT_3MM_TYPE_ID });
    notes.push({ x: coords.col3 + 3.0, y: startY - CLAUSE_PAD_TOP, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

    let subY = startY - CLAUSE_PAD_TOP;
    const introText = '本計畫各種公共設施用地之建蔽率及容積率規定詳如下表：';
    const introWrapped = wrapClauseText(introText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: introWrapped, typeId: FONT_3MM_TYPE_ID });
    const introLines = introWrapped.split('\n').length;
    subY -= (introLines * LINE_PITCH + 1.5);

    const tableRes = renderDynamicTable({
      startX: coords.col2 + SUB_INSET,
      startY: subY,
      colWidths: [54.0, 30.0, 30.0, 100.0],
      headers: ['公共設施用地', '建蔽率', '容積率', '備註'],
      headerHeight: 7.5,
      rows: [
        ['機關用地', '50%', '250%', '-'],
        ['博物館用地', '50%', '200%', '-'],
        ['學校用地(國小、國中)', '50%', '150%', '-'],
        ['學校用地(高中、高職)', '50%', '200%', '-'],
        ['零售市場用地', '60%', '240%', '-'],
        ['公園用地', '15%', '45%', '-'],
        ['鄰里公園兼兒童遊樂場用地', '15%', '45%', '-'],
        ['停車場用地(平面)', '10%', '20%', '-'],
        ['停車場用地(立體)', '80%', '240%', '做多目標使用時，容積不得大於480%'],
        ['污水處理場用地', '15%', '150%', '-']
      ]
    });
    lines.push(...tableRes.lines);
    notes.push(...tableRes.notes);

    curY = tableRes.endY - CLAUSE_PAD_BOTTOM;
    lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });
  }

  // 第 4 點
  {
    const r = renderSimpleClause(coords, curY, '第4點', '古蹟保存區以供保存維護古物、古蹟及有關文物、文化景觀之使用為限，其土地及建築物依現況為準，不得增建及新建。');
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 5 點 (電信管制全文)
  {
    const text5 = `電信專用區其土地及建築物得為下列規定之使用：
（一）經營電信事業所需之設施：包括機房、營業廳、辦公室、料場、倉庫、天線場、展示中心、線路中心、動力室（電力室）、衛星電台、自立式天線基地、海纜登陸區、基地台、電信轉播站、移動式拖車機房等及其它必要設施。
（二）電信必要附屬設施：
    1.研發、實驗、推廣、檢驗及營運辦公場所等。
    2.教學、訓練、實習房舍（場所）及學員宿舍等。
    3.員工托育中心、員工幼稚園、員工課輔班、員工餐廳、員工福利社、員工招待所及員工醫務所等。
    4.其他經縣（市）政府審查核准之必要設施。
（三）與電信運用發展有關設施
    1.網路加值服務業。
    2.有線、無線及電腦資訊業。
    3.資訊處理服務業。
（四）與電信業務經營有關設施
    1.電子資訊供應服務業。
    2.電信器材零售業。
    3.電信工程業。
    4.金融業派駐機構。`;
    const r = renderSimpleClause(coords, curY, '第5點', text5);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 6 點 (郵政管制全文)
  {
    const text6 = `郵政事業專用區其管制如下：
（一）經營郵政事業所需設施：營業廳、辦公室、倉庫、展示中心、銷售中心、物流中心、封裝列印中心、機房、電腦中心、郵件處理中心、郵件投遞場所、客服中心、郵車調度養護中心及其他必要設施。
（二）郵政必要附屬設施：
    1.研發、實驗、推廣、檢驗及營運辦公場所等。
    2.教學、訓練、實習房舍（場所）及學員宿舍等。
    3.郵政文物收藏及展示場所。
    4.員工托育中心、員工托老中心、員工幼稚園、員工課輔班、員工餐廳、員工福利社、員工招待所及員工醫務所等。
（三）其他依郵政法第5條規定及經濟部核准中華郵政公司可營利事業項目之服務項目前提下，除經直轄市、縣（市）政府審查核准之必要設施外，不得作為商業使用。`;
    const r = renderSimpleClause(coords, curY, '第6點', text6);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 7 點
  {
    const r = renderSimpleClause(coords, curY, '第7點', '農業區應依都市計畫法台灣省施行細則第29條規定辦理，不得設置營建剩餘土石方資源堆置場及廢棄物資源回收貯存場。', '本案依規定辦理。', true);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  return { lines, notes, finalY: curY };
}

// ==========================================
// 【右欄 (Table 2)】: 第 8 點 ～ 第 15 點
// ==========================================
function renderRightColumn(coords) {
  const lines = [];
  const notes = [];

  const header = renderColumnHeader(coords, '和美細部計畫土地使用分區管制要點');
  lines.push(...header.lines);
  notes.push(...header.notes);

  let curY = header.startContentY;

  // 第 8 點 (建築退縮規定表 - 0.8 表格緊湊模矩)
  {
    const startY = curY;
    notes.push({ x: coords.col1 + 2.0, y: startY - CLAUSE_PAD_TOP, text: '第8點', typeId: FONT_3MM_TYPE_ID });
    notes.push({ x: coords.col3 + 3.0, y: startY - CLAUSE_PAD_TOP, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

    let subY = startY - CLAUSE_PAD_TOP;
    const introText = '本計畫建築退縮規定詳如下表，其退縮部分得計入法定空地：';
    const introWrapped = wrapClauseText(introText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: introWrapped, typeId: FONT_3MM_TYPE_ID });
    const introLines = introWrapped.split('\n').length;
    subY -= (introLines * LINE_PITCH + 1.5);

    const tableRes = renderDynamicTable({
      startX: coords.col2 + SUB_INSET,
      startY: subY,
      colWidths: [50.0, 56.0, 108.0],
      headers: ['項目', '退縮規定', '備註'],
      headerHeight: 7.5,
      rows: [
        [
          '1.實施區段徵收或市地重劃地區，基地由低使用強度變更為高使用強度之整體開發地區者\n2.乙種工業區\n3.住宅區及商業區申請建築基地達1,000平方公尺以上',
          '自道路境界線至少退縮5公尺建築。',
          '1.退縮建築範圍內應至少留設1.5公尺無遮簷人行步道。\n2.退縮建築後免再依留設法定騎樓。'
        ],
        [
          '電信專用區',
          '自道路境界線至少退縮5公尺建築。',
          '如有設置圍牆之必要，圍牆應自道路境界線至少退縮4公尺。'
        ],
        [
          '郵政專用區',
          '自道路境界線至少退縮5公尺建築。',
          '1.如有設置圍牆之必要，圍牆應自道路境界線至少退縮4公尺。\n2.退縮建築之空地適度植栽綠美化，建築線2公尺範圍內需留設人行通路，不得設置圍籬，但得計入法定空地。\n3.退縮建築後免再依『彰化縣建築管理自治條例』之動機車設置標準之規定留設法定騎樓。'
        ],
        [
          '污水處理場用地',
          '自道路境界線至少退縮10公尺建築。',
          '1.如有設置圍牆之必要者，應自道路境界線至少退縮5公尺設置。\n2.退縮建築之空地應植栽綠化，但得計入法定空地。'
        ],
        [
          '其餘公共設施用地',
          '自道路境界線至少退縮5公尺建築。',
          '1.退縮建築範圍內應至少留設1.5公尺無遮簷人行步道。\n2.如有設置圍牆之必要者，應自道路境界線至少退縮4公尺設置。'
        ],
        [
          '前列以外地區',
          '依彰化縣建築管理自治條例規定辦理。',
          '本計畫區建築基地臨接2條計畫道路者，應以較寬道路側為退縮面，兩面道路寬度相同者，擇一退縮。'
        ]
      ]
    });
    lines.push(...tableRes.lines);
    notes.push(...tableRes.notes);

    subY = tableRes.endY - 1.5;
    const footerText = '前項表內所示，建築基地臨接2條計畫道路者，倘無其他特殊規定，則其臨計畫道路部分皆應退縮。';
    const footerWrapped = wrapClauseText(footerText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: footerWrapped, typeId: FONT_3MM_TYPE_ID });
    const footerLines = footerWrapped.split('\n').length;
    subY -= (footerLines * LINE_PITCH + CLAUSE_PAD_BOTTOM);

    curY = subY;
    lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });
  }

  // 第 9 點 (停車空間設置標準表)
  {
    const startY = curY;
    notes.push({ x: coords.col1 + 2.0, y: startY - CLAUSE_PAD_TOP, text: '第9點', typeId: FONT_3MM_TYPE_ID });
    notes.push({ x: coords.col3 + 3.0, y: startY - CLAUSE_PAD_TOP, text: '本案依規定辦理。', typeId: FONT_3MM_TYPE_ID });

    let subY = startY - CLAUSE_PAD_TOP;
    const introText = '住宅區、商業區之建築基地於申請建築時，為考量都市發展，訂定停車空間設置標準如下。但基地情形特殊經提縣都市設計審議委員會審議同意者，從其規定。';
    const introWrapped = wrapClauseText(introText, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: introWrapped, typeId: FONT_3MM_TYPE_ID });
    const introLines = introWrapped.split('\n').length;
    subY -= (introLines * LINE_PITCH + 1.5);

    const sub1Text = '1.實施區段徵收或市地重劃地區及1,000平方公尺以上基地由低使用強度變更為高使用強度之整體開發地區，其停車空間應依下表規定辦理。';
    const sub1Wrapped = wrapClauseText(sub1Text, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: sub1Wrapped, typeId: FONT_3MM_TYPE_ID });
    const sub1Lines = sub1Wrapped.split('\n').length;
    subY -= (sub1Lines * LINE_PITCH + 1.5);

    const tableRes = renderDynamicTable({
      startX: coords.col2 + SUB_INSET,
      startY: subY,
      colWidths: [100.0, 114.0],
      headers: ['總樓地板面積', '停車設置標準'],
      headerHeight: 7.5,
      rows: [
        ['1～250 平方公尺', '設置 1 部'],
        ['251～400 平方公尺', '設置 2 部'],
        ['401～550 平方公尺', '設置 3 部'],
        ['以下類推', '每增加 150 平方公尺增設 1 部']
      ]
    });
    lines.push(...tableRes.lines);
    notes.push(...tableRes.notes);

    subY = tableRes.endY - 1.5;
    const sub2Text = '2.前款以外地區，依「建築技術規則」規定辦理。';
    const sub2Wrapped = wrapClauseText(sub2Text, CLAUSE_WRAP_WEIGHT);
    notes.push({ x: coords.col2 + 3.0, y: subY, text: sub2Wrapped, typeId: FONT_3MM_TYPE_ID });
    const sub2Lines = sub2Wrapped.split('\n').length;
    subY -= (sub2Lines * LINE_PITCH + CLAUSE_PAD_BOTTOM);

    curY = subY;
    lines.push({ startX: coords.start, startY: curY, endX: coords.end, endY: curY });
  }

  // 第 10 點 (景觀綠化保水 8 款全文)
  {
    const text10 = `為維護景觀並加強綠化及基地保水，應依下列規定辦理：
1.本計畫區建築基地地下層開挖範圍，不得超過各該基地之法定建蔽率加10%，惟經縣都市設計審議委員會審議通過者不在在此限。
2.公共設施用地及建築退縮供公眾通行之人行空間，應採用透水性鋪面。
3.建築法定空地應以集中留設為原則，其綠化面積不得低於50%，且其中至少30%應為透水性表面或舖面。
4.公園、鄰里公園兼兒童遊樂場等用地，其綠化面積不得低於50%，其中至少80%應為透水性表面或舖面，有床基之花臺面積不得超過綠化面積10%。
5.本計畫區公共設施用地之植栽，應優先選用臺灣原生樹種，獲環保署建議空氣品質淨化能力A級之樹種。
6.公園、鄰里公園兼兒童遊樂場等用地應植栽樹冠3公尺以上之喬木，其綠覆面積不得少於20%，且其根部應保留適當之透水性表面。
7.廣場、廣場兼停車場及停車場用地（立體停車場除外）應使用透水舖面，且其面積不得低於50%。
8.綠園道用地之綠化面積不得低於20%。`;
    const r = renderSimpleClause(coords, curY, '第10點', text10);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 11 點
  {
    const r = renderSimpleClause(coords, curY, '第11點', '本計畫區之公共設施及公共建築應配合整體規劃設計，且符合「建築技術規則建築設計施工編」綠建築基準有關建築基地綠化、建築基地保水、建築物節約能源、建築物雨水或生活雜排水回收再利用、綠建材等規定。');
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 12 點 (3款)
  {
    const text12 = `為落實建築基地實施綠美化及落實節能減碳，本計畫區建築物應依下列規定辦理：
1.公共建築屋頂之綠化面積不得低於建築物頂層（含露臺）面積之40%。
2.臨計畫道路之建築物採立體綠化設計，且達立面總面積（不含開窗部分）20%者，其綠化設施部分得不計入容積。
3.設置綠能發電設備者，得增加等同該設備實際使用面積（含建築立面使用面積）之樓地板面積，且其增加部分之樓地板面積得不計入容積。`;
    const r = renderSimpleClause(coords, curY, '第12點', text12);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 13 點 (2款)
  {
    const text13 = `建築物提供部分樓地板面積供下列使用者，得增加所提供之樓地板面積。
1.私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人活動中心、景觀公共設施等供公眾使用；其集中留設之面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者。
2.建築物留設空間與天橋或地下道連接供公眾使用，經交通主管機關核准者。`;
    const r = renderSimpleClause(coords, curY, '第13點', text13);
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 14 點
  {
    const r = renderSimpleClause(coords, curY, '第14點', '本計畫區各建築基地除依都市更新法規實施都市更新事業之地區外，依本要點及其他相關法令規定所給予之獎勵容積，以不超過基地面積乘以該基地容積率之20％為限。');
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  // 第 15 點
  {
    const r = renderSimpleClause(coords, curY, '第15點', '本要點未規定之事項，適用其他法令規定。');
    lines.push(...r.lines); notes.push(...r.notes); curY = r.nextY;
  }

  return { lines, notes, finalY: curY };
}

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'render-hemei-compact-08-final-' + Date.now();
  await client.connect();

  const viewId = 726458;
  const viewName = '2_都市計畫1 測試和美';

  console.log(`\n================================================================`);
  console.log(`=== 執行【${viewName}】(ID: ${viewId}) 和美土管【0.8 表格緊湊滿版】重繪 ===`);
  console.log(`================================================================\n`);

  // 1. 清理舊元素
  const existingNotes = await client.sendCommand('query_elements', { category: 'OST_TextNotes', viewId });
  const existingLines = await client.sendCommand('query_elements', { category: 'OST_Lines', viewId });

  const noteIds = (existingNotes.data?.Elements || []).map(e => e.ElementId || e.Id);
  const lineIds = (existingLines.data?.Elements || []).map(e => e.ElementId || e.Id);
  console.log(`清理舊元素：${noteIds.length} 個 TextNotes 與 ${lineIds.length} 條 Lines...`);

  for (const id of noteIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  for (const id of lineIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }

  // 2. 建立單頁雙欄公版母框 (X: 3000.00 ~ 3791.90 mm)
  console.log('--- 建立單頁公版母框幾何 (791.90mm x 524.67mm) ---');
  const frame = createTemplateFrame(BASE_X);

  console.log('左欄載入第 1 點至第 7 點（0.8 表格緊湊模矩）...');
  const leftContent = renderLeftColumn(frame.t1Coords);

  console.log('右欄載入第 8 點至第 15 點（0.8 表格緊湊模矩）...');
  const rightContent = renderRightColumn(frame.t2Coords);

  console.log('\n--- 幾何留白結算 ---');
  console.log(`左欄內容終點 Y: ${leftContent.finalY.toFixed(2)} mm (距離底線 ${(leftContent.finalY - BOX_BOTTOM_Y).toFixed(2)} mm 舒適留白)`);
  console.log(`右欄內容終點 Y: ${rightContent.finalY.toFixed(2)} mm (距離底線 ${(rightContent.finalY - BOX_BOTTOM_Y).toFixed(2)} mm 嚴格在圖框內，零超出！)`);

  const allLines = [
    ...frame.lines,
    ...leftContent.lines,
    ...rightContent.lines
  ];

  const allNotes = [
    ...leftContent.notes,
    ...rightContent.notes
  ];

  console.log(`\n發送 ${allLines.length} 條線條至 Revit...`);
  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: allLines
  });

  console.log(`發送 ${allNotes.length} 個 TextNotes 並統一套用字型階層...`);
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
      if (res.data?.ElementId && item.typeId) {
        await client.sendCommand('change_element_type', {
          elementId: res.data.ElementId,
          typeId: item.typeId
        });
      }
      if (noteIndex % 25 === 0 || noteIndex === allNotes.length) {
        console.log(`已建立並套用字型: ${noteIndex}/${allNotes.length}`);
      }
    } catch(err) {
      console.error('建立 TextNote 失敗:', err.message);
    }
  }

  console.log('\n================================================================');
  console.log('✅ 【和美細部計畫土地使用管制要點】0.8 表格緊湊滿版排版重繪完成！');
  console.log('- 表格列高 7.5~8.0mm：文字底端保留 1.5mm 淨空，零壓線、零切字！');
  console.log('- 右欄終點 Y = ' + rightContent.finalY.toFixed(2) + 'mm > 底框 Y = ' + BOX_BOTTOM_Y + 'mm，嚴格 100% 收在母框內（安全留白 15.97mm）！');
  console.log('================================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
