import {
  BASE_X,
  MASTER_WIDTH,
  BOX_TOP_Y,
  BOX_BOTTOM_Y,
  LINE_PITCH
} from './zoning_dynamic_table_engine.mjs';

// 嚴格鎖定 SKILL.md 黃金常數
const SKILL_WRAP_WEIGHT = 48.5;

function wrapFormattedText(text, maxWeight = SKILL_WRAP_WEIGHT) {
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
    if (curLine) {
      wrappedLines.push(curLine);
    }
  }

  return wrappedLines.join('\n');
}

function calcClauseSkill(text) {
  const wrapped = wrapFormattedText(text, SKILL_WRAP_WEIGHT);
  const lineCount = wrapped.split('\n').length;
  // SKILL.md 公式: H = N * 5.80 + 6.50 mm (Top 3.0mm, Bottom 3.5mm)
  const height = lineCount * LINE_PITCH + 6.50;
  return { wrapped, lineCount, height };
}

function simulateSkillStandard() {
  console.log('=== 【SKILL.md 標準黃金常數 48.5】滿版高度模擬 ===\n');
  const maxAvailableH = BOX_TOP_Y - BOX_BOTTOM_Y - 20.0; // 500.67mm

  // 左欄 (第1點 ~ 第7點)
  let leftH = 0;
  leftH += calcClauseSkill('本要點依都市計畫法第22條及同法臺灣省施行細則第35條規定訂定之。').height; // 第1點
  leftH += calcClauseSkill('本計畫各種土地使用分區之建蔽率及容積率規定詳如下表：').height; // 第2點前言
  leftH += (8.0 + 7 * 7.0 + 3.0); // 第2點分區表
  leftH += calcClauseSkill('註：變更和美主要計畫（第四次通盤檢討）案後續報請核定案件第6案原站2之容積率上限，其他住宅區為200%。').height;
  leftH += calcClauseSkill('本計畫各種公共設施用地之建蔽率及容積率規定詳如下表：').height; // 第3點前言
  leftH += (8.0 + 9 * 7.0 + 13.0 + 3.0); // 第3點公設表
  leftH += calcClauseSkill('古蹟保存區以供保存維護古物、古蹟及有關文物、文化景觀之使用為限，其土地及建築物依現況為準，不得增建及新建。').height; // 第4點

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
  const c5 = calcClauseSkill(text5);
  leftH += c5.height;

  const text6 = `郵政事業專用區其管制如下：
（一）經營郵政事業所需設施：營業廳、辦公室、倉庫、展示中心、銷售中心、物流中心、封裝列印中心、機房、電腦中心、郵件處理中心、郵件投遞場所、客服中心、郵車調度養護中心及其他必要設施。
（二）郵政必要附屬設施：
    1.研發、實驗、推廣、檢驗及營運辦公場所等。
    2.教學、訓練、實習房舍（場所）及學員宿舍等。
    3.郵政文物收藏及展示場所。
    4.員工托育中心、員工托老中心、員工幼稚園、員工課輔班、員工餐廳、員工福利社、員工招待所及員工醫務所等。
（三）其他依郵政法第5條規定及經濟部核准中華郵政公司可營利事業項目之服務項目前提下，除經直轄市、縣（市）政府審查核准之必要設施外，不得作為商業使用。`;
  const c6 = calcClauseSkill(text6);
  leftH += c6.height;

  leftH += calcClauseSkill('農業區應依都市計畫法台灣省施行細則第29條規定辦理，不得設置營建剩餘土石方資源堆置場及廢棄物資源回收貯存場。').height;

  console.log(`第5點滿版行數: ${c5.lineCount} 行, 高度: ${c5.height.toFixed(2)} mm`);
  console.log(`第6點滿版行數: ${c6.lineCount} 行, 高度: ${c6.height.toFixed(2)} mm`);
  console.log(`【左欄總高】: ${leftH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (剩餘: ${(maxAvailableH - leftH).toFixed(2)} mm)\n`);

  // 右欄 (第8點 ~ 第15點)
  let rightH = 0;
  rightH += calcClauseSkill('本計畫建築退縮規定詳如下表，其退縮部分得計入法定空地：').height;
  // 退縮表 6 列 (每列 Top 2.5mm, Bottom 2.5mm)
  // Row 1: 6行 -> 6*5.8 + 5.0 = 39.8mm
  // Row 2: 2行 -> 2*5.8 + 5.0 = 16.6mm
  // Row 3: 7行 -> 7*5.8 + 5.0 = 45.6mm
  // Row 4: 3行 -> 3*5.8 + 5.0 = 22.4mm
  // Row 5: 3行 -> 3*5.8 + 5.0 = 22.4mm
  // Row 6: 3行 -> 3*5.8 + 5.0 = 22.4mm
  // 表頭 8.0mm, 合計 = 8.0 + 39.8 + 16.6 + 45.6 + 22.4 + 22.4 + 22.4 = 177.2mm
  rightH += 177.2 + 3.0;
  rightH += calcClauseSkill('前項表內所示，建築基地臨接2條計畫道路者，倘無其他特殊規定，則其臨計畫道路部分皆應退縮。').height;

  rightH += calcClauseSkill('住宅區、商業區之建築基地於申請建築時，為考量都市發展，訂定停車空間設置標準如下。但基地情形特殊經提縣都市設計審議委員會審議同意者，從其規定。').height;
  rightH += calcClauseSkill('1.實施區段徵收或市地重劃地區及1,000平方公尺以上基地由低使用強度變更為高使用強度之整體開發地區，其停車空間應依下表規定辦理。').height;
  // 停車表 4 列：表頭 8.0mm + 4列*7.0mm = 36.0mm
  rightH += 36.0 + 3.0;
  rightH += calcClauseSkill('2.前款以外地區，依「建築技術規則」規定辦理。').height;

  const text10 = `為維護景觀並加強綠化及基地保水，應依下列規定辦理：
1.本計畫區建築基地地下層開挖範圍，不得超過各該基地之法定建蔽率加10%，惟經縣都市設計審議委員會審議通過者不在在此限。
2.公共設施用地及建築退縮供公眾通行之人行空間，應採用透水性鋪面。
3.建築法定空地應以集中留設為原則，其綠化面積不得低於50%，且其中至少30%應為透水性表面或舖面。
4.公園、鄰里公園兼兒童遊樂場等用地，其綠化面積不得低於50%，其中至少80%應為透水性表面或舖面，有床基之花臺面積不得超過綠化面積10%。
5.本計畫區公共設施用地之植栽，應優先選用臺灣原生樹種，獲環保署建議空氣品質淨化能力A級之樹種。
6.公園、鄰里公園兼兒童遊樂場等用地應植栽樹冠3公尺以上之喬木，其綠覆面積不得少於20%，且其根部應保留適當之透水性表面。
7.廣場、廣場兼停車場及停車場用地（立體停車場除外）應使用透水舖面，且其面積不得低於50%。
8.綠園道用地之綠化面積不得低於20%。`;
  const c10 = calcClauseSkill(text10);
  rightH += c10.height;

  const c11 = calcClauseSkill('本計畫區之公共設施及公共建築應配合整體規劃設計，且符合「建築技術規則建築設計施工編」綠建築基準有關建築基地綠化、建築基地保水、建築物節約能源、建築物雨水或生活雜排水回收再利用、綠建材等規定。');
  rightH += c11.height;

  const text12 = `為落實建築基地實施綠美化及落實節能減碳，本計畫區建築物應依下列規定辦理：
1.公共建築屋頂之綠化面積不得低於建築物頂層（含露臺）面積之40%。
2.臨計畫道路之建築物採立體綠化設計，且達立面總面積（不含開窗部分）20%者，其綠化設施部分得不計入容積。
3.設置綠能發電設備者，得增加等同該設備實際使用面積（含建築立面使用面積）之樓地板面積，且其增加部分之樓地板面積得不計入容積。`;
  const c12 = calcClauseSkill(text12);
  rightH += c12.height;

  const text13 = `建築物提供部分樓地板面積供下列使用者，得增加所提供之樓地板面積。
1.私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人活動中心、景觀公共設施等供公眾使用；其集中留設之面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者。
2.建築物留設空間與天橋或地下道連接供公眾使用，經交通主管機關核准者。`;
  const c13 = calcClauseSkill(text13);
  rightH += c13.height;

  rightH += calcClauseSkill('本計畫區各建築基地除依都市更新法規實施都市更新事業之地區外，依本要點及其他相關法令規定所給予之獎勵容積，以不超過基地面積乘以該基地容積率之20％為限。').height;
  rightH += calcClauseSkill('本要點未規定之事項，適用其他法令規定。').height;

  console.log(`第10點滿版行數: ${c10.lineCount} 行, 高度: ${c10.height.toFixed(2)} mm`);
  console.log(`第12點滿版行數: ${c12.lineCount} 行, 高度: ${c12.height.toFixed(2)} mm`);
  console.log(`第13點滿版行數: ${c13.lineCount} 行, 高度: ${c13.height.toFixed(2)} mm`);
  console.log(`【右欄總高】: ${rightH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (剩餘: ${(maxAvailableH - rightH).toFixed(2)} mm)`);
}

simulateSkillStandard();
