import {
  BASE_X,
  MASTER_WIDTH,
  BOX_TOP_Y,
  BOX_BOTTOM_Y,
  LINE_PITCH
} from './zoning_dynamic_table_engine.mjs';

// 黃金緊湊字寬權重 (48.0，文字自然緊湊，不浪費行數)
const GOLDEN_CLAUSE_WEIGHT = 48.0;

function wrapText(text, maxWeight) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      wrappedLines.push('');
      continue;
    }
    let indentSpaces = '';
    const match = para.match(/^(\s+)/);
    if (match) indentSpaces = match[1];
    const trimmed = para.trim();
    let subIndent = indentSpaces;
    if (/^（[一二三四五六七八九十]+）/.test(trimmed) || /^\([一二三四五六七八九十]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '    ';
    } else if (/^[0-9]+\./.test(trimmed)) {
      subIndent = indentSpaces + '    ';
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
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
    if (curLine) wrappedLines.push(curLine);
  }
  return wrappedLines.join('\n');
}

function calcCompactClauseH(text) {
  const wrapped = wrapText(text, GOLDEN_CLAUSE_WEIGHT);
  const lineCount = wrapped.split('\n').length;
  // 緊湊黃金排版：頂部留白 2.0mm，底部留白 2.0mm，單段高 = N * 5.8 + 4.0mm
  return { wrapped, lineCount, height: lineCount * LINE_PITCH + 4.0 };
}

function simulateCompact1Page() {
  console.log('=== 【黃金單頁滿版緊湊方案】高度模擬 ===');
  const maxAvailableH = BOX_TOP_Y - BOX_BOTTOM_Y - 20.0; // 500.67mm
  console.log(`單欄可用高度: ${maxAvailableH.toFixed(2)} mm (總框高 524.67mm)\n`);

  // ================= 左欄 (第1點 ~ 第7點) =================
  let leftH = 0;
  // 1. 第1點
  leftH += calcCompactClauseH('本要點依都市計畫法第22條及同法臺灣省施行細則第35條規定訂定之。').height;

  // 2. 第2點 (前言 + 分區表 + 註)
  leftH += calcCompactClauseH('本計畫各種土地使用分區之建蔽率及容積率規定詳如下表：').height;
  // 分區表：表頭 7.0mm + 7 列 * 6.5mm = 52.5mm
  leftH += 7.0 + 7 * 6.5 + 2.0;
  leftH += calcCompactClauseH('註：變更和美主要計畫（第四次通盤檢討）案後續報請核定案件第6案原站2之容積率上限，其他住宅區為200%。').height;

  // 3. 第3點 (前言 + 公設表)
  leftH += calcCompactClauseH('本計畫各種公共設施用地之建蔽率及容積率規定詳如下表：').height;
  // 公設表：表頭 7.0mm + 10 列 (第9列做多目標使2行=11.6mm, 其餘9列*6.0=54mm) = 72.6mm
  leftH += 7.0 + 9 * 6.0 + 12.0 + 2.0;

  // 4. 第4點
  leftH += calcCompactClauseH('古蹟保存區以供保存維護古物、古蹟及有關文物、文化景觀之使用為限，其土地及建築物依現況為準，不得增建及新建。').height;

  // 5. 第5點 (電信)
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
  leftH += calcCompactClauseH(text5).height;

  // 6. 第6點 (郵政)
  const text6 = `郵政事業專用區其管制如下：
（一）經營郵政事業所需設施：營業廳、辦公室、倉庫、展示中心、銷售中心、物流中心、封裝列印中心、機房、電腦中心、郵件處理中心、郵件投遞場所、客服中心、郵車調度養護中心及其他必要設施。
（二）郵政必要附屬設施：
    1.研發、實驗、推廣、檢驗及營運辦公場所等。
    2.教學、訓練、實習房舍（場所）及學員宿舍等。
    3.郵政文物收藏及展示場所。
    4.員工托育中心、員工托老中心、員工幼稚園、員工課輔班、員工餐廳、員工福利社、員工招待所及員工醫務所等。
（三）其他依郵政法第5條規定及經濟部核准中華郵政公司可營利事業項目之服務項目前提下，除經直轄市、縣（市）政府審查核准之必要設施外，不得作為商業使用。`;
  leftH += calcCompactClauseH(text6).height;

  // 7. 第7點 (農業區)
  leftH += calcCompactClauseH('農業區應依都市計畫法台灣省施行細則第29條規定辦理，不得設置營建剩餘土石方資源堆置場及廢棄物資源回收貯存場。').height;

  console.log(`【左欄 (第1點~第7點)】使用高度: ${leftH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (剩餘留白: ${(maxAvailableH - leftH).toFixed(2)} mm)`);

  // ================= 右欄 (第8點 ~ 第15點) =================
  let rightH = 0;
  // 8. 第8點 (退縮表)
  rightH += calcCompactClauseH('本計畫建築退縮規定詳如下表，其退縮部分得計入法定空地：').height;
  // 退縮表 6 列精準高度：
  // Row 1 (Col1 6行, Col2 2行, Col3 3行 -> max 6行 = 6*5.8 + 2.0 = 36.8mm)
  // Row 2 (Col1 1行, Col2 2行, Col3 2行 -> max 2行 = 2*5.8 + 2.0 = 13.6mm)
  // Row 3 (Col1 1行, Col2 2行, Col3 7行 -> max 7行 = 7*5.8 + 2.0 = 42.6mm)
  // Row 4 (Col1 1行, Col2 2行, Col3 3行 -> max 3行 = 3*5.8 + 2.0 = 19.4mm)
  // Row 5 (Col1 1行, Col2 2行, Col3 3行 -> max 3行 = 3*5.8 + 2.0 = 19.4mm)
  // Row 6 (Col1 1行, Col2 2行, Col3 3行 -> max 3行 = 3*5.8 + 2.0 = 19.4mm)
  // 表頭 7.0mm, 合計 = 7.0 + 36.8 + 13.6 + 42.6 + 19.4 + 19.4 + 19.4 = 158.2mm
  rightH += 158.2 + 2.0;
  rightH += calcCompactClauseH('前項表內所示，建築基地臨接2條計畫道路者，倘無其他特殊規定，則其臨計畫道路部分皆應退縮。').height;

  // 9. 第9點 (停車表)
  rightH += calcCompactClauseH('住宅區、商業區之建築基地於申請建築時，為考量都市發展，訂定停車空間設置標準如下。但基地情形特殊經提縣都市設計審議委員會審議同意者，從其規定。').height;
  rightH += calcCompactClauseH('1.實施區段徵收或市地重劃地區及1,000平方公尺以上基地由低使用強度變更為高使用強度之整體開發地區，其停車空間應依下表規定辦理。').height;
  // 停車表 4 列：表頭 7.0mm + 4列*6.0mm = 31.0mm
  rightH += 31.0 + 2.0;
  rightH += calcCompactClauseH('2.前款以外地區，依「建築技術規則」規定辦理。').height;

  // 10. 第10點
  const text10 = `為維護景觀並加強綠化及基地保水，應依下列規定辦理：
1.本計畫區建築基地地下層開挖範圍，不得超過各該基地之法定建蔽率加10%，惟經縣都市設計審議委員會審議通過者不在在此限。
2.公共設施用地及建築退縮供公眾通行之人行空間，應採用透水性鋪面。
3.建築法定空地應以集中留設為原則，其綠化面積不得低於50%，且其中至少30%應為透水性表面或舖面。
4.公園、鄰里公園兼兒童遊樂場等用地，其綠化面積不得低於50%，其中至少80%應為透水性表面或舖面，有床基之花臺面積不得超過綠化面積10%。
5.本計畫區公共設施用地之植栽，應優先選用臺灣原生樹種，獲環保署建議空氣品質淨化能力A級之樹種。
6.公園、鄰里公園兼兒童遊樂場等用地應植栽樹冠3公尺以上之喬木，其綠覆面積不得少於20%，且其根部應保留適當之透水性表面。
7.廣場、廣場兼停車場及停車場用地（立體停車場除外）應使用透水舖面，且其面積不得低於50%。
8.綠園道用地之綠化面積不得低於20%。`;
  rightH += calcCompactClauseH(text10).height;

  // 11. 第11點
  rightH += calcCompactClauseH('本計畫區之公共設施及公共建築應配合整體規劃設計，且符合「建築技術規則建築設計施工編」綠建築基準有關建築基地綠化、建築基地保水、建築物節約能源、建築物雨水或生活雜排水回收再利用、綠建材等規定。').height;

  // 12. 第12點
  const text12 = `為落實建築基地實施綠美化及落實節能減碳，本計畫區建築物應依下列規定辦理：
1.公共建築屋頂之綠化面積不得低於建築物頂層（含露臺）面積之40%。
2.臨計畫道路之建築物採立體綠化設計，且達立面總面積（不含開窗部分）20%者，其綠化設施部分得不計入容積。
3.設置綠能發電設備者，得增加等同該設備實際使用面積（含建築立面使用面積）之樓地板面積，且其增加部分之樓地板面積得不計入容積。`;
  rightH += calcCompactClauseH(text12).height;

  // 13. 第13點
  const text13 = `建築物提供部分樓地板面積供下列使用者，得增加所提供之樓地板面積。
1.私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人活動中心、景觀公共設施等供公眾使用；其集中留設之面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者。
2.建築物留設空間與天橋或地下道連接供公眾使用，經交通主管機關核准者。`;
  rightH += calcCompactClauseH(text13).height;

  // 14. 第14點
  rightH += calcCompactClauseH('本計畫區各建築基地除依都市更新法規實施都市更新事業之地區外，依本要點及其他相關法令規定所給予之獎勵容積，以不超過基地面積乘以該基地容積率之20％為限。').height;

  // 15. 第15點
  rightH += calcCompactClauseH('本要點未規定之事項，適用其他法令規定。').height;

  console.log(`【右欄 (第8點~第15點)】使用高度: ${rightH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (剩餘留白: ${(maxAvailableH - rightH).toFixed(2)} mm)`);
}

simulateCompact1Page();
