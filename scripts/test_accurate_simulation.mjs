import {
  wrapClauseText,
  renderDynamicTable,
  BOX_TOP_Y,
  BOX_BOTTOM_Y,
  LINE_PITCH
} from './zoning_dynamic_table_engine.mjs';

function calcClauseStats(text) {
  const wrapped = wrapClauseText(text);
  const lines = wrapped.split('\n');
  const count = lines.length;
  // Top padding 3.5mm, Bottom padding 4.5mm
  const height = count * LINE_PITCH + 8.0;
  return { wrapped, count, height };
}

function testAccurateLayout() {
  console.log('=== 精準單段與表格高度統計驗證 ===\n');

  // LEFT COLUMN
  let leftY = BOX_TOP_Y - 20.0; // 3474.25
  const leftStart = leftY;

  // 1. 第1點
  const art1 = calcClauseStats('本要點依都市計畫法第22條及同法臺灣省施行細則第35條規定訂定之。');
  console.log(`第1點: ${art1.count} 行, 高度 ${art1.height.toFixed(2)} mm`);
  leftY -= art1.height;

  // 2. 第2點
  const art2Intro = calcClauseStats('本計畫各種土地使用分區之建蔽率及容積率規定詳如下表：');
  const t2Res = renderDynamicTable({
    startX: 0, startY: 0,
    colWidths: [70, 70, 74],
    headers: ['土地使用分區', '建蔽率', '容積率'],
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
  const art2Note = calcClauseStats('註：變更和美主要計畫（第四次通盤檢討）案後續報請核定案件第6案原站2之容積率上限，其他住宅區為200%。');
  const art2TotalH = art2Intro.height + t2Res.totalHeight + 4.0 + art2Note.height;
  console.log(`第2點: 前言+表格(${t2Res.totalHeight.toFixed(1)}mm)+註, 總高 ${art2TotalH.toFixed(2)} mm`);
  leftY -= art2TotalH;

  // 3. 第3點
  const art3Intro = calcClauseStats('本計畫各種公共設施用地之建蔽率及容積率規定詳如下表：');
  const t3Res = renderDynamicTable({
    startX: 0, startY: 0,
    colWidths: [54, 30, 30, 100],
    headers: ['公共設施用地', '建蔽率', '容積率', '備註'],
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
  const art3TotalH = art3Intro.height + t3Res.totalHeight + 4.0;
  console.log(`第3點: 前言+表格(${t3Res.totalHeight.toFixed(1)}mm), 總高 ${art3TotalH.toFixed(2)} mm`);
  leftY -= art3TotalH;

  // 4. 第4點
  const art4 = calcClauseStats('古蹟保存區以供保存維護古物、古蹟及有關文物、文化景觀之使用為限，其土地及建築物依現況為準，不得增建及新建。');
  console.log(`第4點: ${art4.count} 行, 高度 ${art4.height.toFixed(2)} mm`);
  leftY -= art4.height;

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
  const art5 = calcClauseStats(text5);
  console.log(`第5點: ${art5.count} 行, 高度 ${art5.height.toFixed(2)} mm`);
  leftY -= art5.height;

  // 6. 第6點 (郵政)
  const text6 = `郵政事業專用區其管制如下：
（一）經營郵政事業所需設施：營業廳、辦公室、倉庫、展示中心、銷售中心、物流中心、封裝列印中心、機房、電腦中心、郵件處理中心、郵件投遞場所、客服中心、郵車調度養護中心及其他必要設施。
（二）郵政必要附屬設施：
    1.研發、實驗、推廣、檢驗及營運辦公場所等。
    2.教學、訓練、實習房舍（場所）及學員宿舍等。
    3.郵政文物收藏及展示場所。
    4.員工托育中心、員工托老中心、員工幼稚園、員工課輔班、員工餐廳、員工福利社、員工招待所及員工醫務所等。
（三）其他依郵政法第5條規定及經濟部核准中華郵政公司可營利事業項目之服務項目前提下，除經直轄市、縣（市）政府審查核准之必要設施外，不得作為商業使用。`;
  const art6 = calcClauseStats(text6);
  console.log(`第6點: ${art6.count} 行, 高度 ${art6.height.toFixed(2)} mm`);
  leftY -= art6.height;

  // 7. 第7點 (農業區)
  const art7 = calcClauseStats('農業區應依都市計畫法台灣省施行細則第29條規定辦理，不得設置營建剩餘土石方資源堆置場及廢棄物資源回收貯存場。');
  console.log(`第7點: ${art7.count} 行, 高度 ${art7.height.toFixed(2)} mm`);
  leftY -= art7.height;

  const leftUsedH = leftStart - leftY;
  console.log(`\n【左欄結算】總使用高度: ${leftUsedH.toFixed(2)} mm / 500.67 mm (距離底線: ${(leftY - BOX_BOTTOM_Y).toFixed(2)} mm)\n`);

  // RIGHT COLUMN
  let rightY = BOX_TOP_Y - 20.0;
  const rightStart = rightY;

  // 8. 第8點 (退縮表)
  const art8Intro = calcClauseStats('本計畫建築退縮規定詳如下表，其退縮部分得計入法定空地：');
  const t8Res = renderDynamicTable({
    startX: 0, startY: 0,
    colWidths: [50, 56, 108],
    headers: ['項目', '退縮規定', '備註'],
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
  const art8Footer = calcClauseStats('前項表內所示，建築基地臨接2條計畫道路者，倘無其他特殊規定，則其臨計畫道路部分皆應退縮。');
  const art8TotalH = art8Intro.height + t8Res.totalHeight + 4.0 + art8Footer.height;
  console.log(`第8點: 前言+表格(${t8Res.totalHeight.toFixed(1)}mm)+後言, 總高 ${art8TotalH.toFixed(2)} mm`);
  rightY -= art8TotalH;

  // 9. 第9點 (停車表)
  const art9Intro = calcClauseStats('住宅區、商業區之建築基地於申請建築時，為考量都市發展，訂定停車空間設置標準如下。但基地情形特殊經提縣都市設計審議委員會審議同意者，從其規定。');
  const art9Sub1 = calcClauseStats('1.實施區段徵收或市地重劃地區及1,000平方公尺以上基地由低使用強度變更為高使用強度之整體開發地區，其停車空間應依下表規定辦理。');
  const t9Res = renderDynamicTable({
    startX: 0, startY: 0,
    colWidths: [100, 114],
    headers: ['總樓地板面積', '停車設置標準'],
    rows: [
      ['1～250 平方公尺', '設置 1 部'],
      ['251～400 平方公尺', '設置 2 部'],
      ['401～550 平方公尺', '設置 3 部'],
      ['以下類推', '每增加 150 平方公尺增設 1 部']
    ]
  });
  const art9Sub2 = calcClauseStats('2.前款以外地區，依「建築技術規則」規定辦理。');
  const art9TotalH = art9Intro.height + art9Sub1.height + t9Res.totalHeight + 4.0 + art9Sub2.height;
  console.log(`第9點: 前言+分項1+表格(${t9Res.totalHeight.toFixed(1)}mm)+分項2, 總高 ${art9TotalH.toFixed(2)} mm`);
  rightY -= art9TotalH;

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
  const art10 = calcClauseStats(text10);
  console.log(`第10點: ${art10.count} 行, 高度 ${art10.height.toFixed(2)} mm`);
  rightY -= art10.height;

  // 11. 第11點
  const art11 = calcClauseStats('本計畫區之公共設施及公共建築應配合整體規劃設計，且符合「建築技術規則建築設計施工編」綠建築基準有關建築基地綠化、建築基地保水、建築物節約能源、建築物雨水或生活雜排水回收再利用、綠建材等規定。');
  console.log(`第11點: ${art11.count} 行, 高度 ${art11.height.toFixed(2)} mm`);
  rightY -= art11.height;

  // 12. 第12點
  const text12 = `為落實建築基地實施綠美化及落實節能減碳，本計畫區建築物應依下列規定辦理：
1.公共建築屋頂之綠化面積不得低於建築物頂層（含露臺）面積之40%。
2.臨計畫道路之建築物採立體綠化設計，且達立面總面積（不含開窗部分）20%者，其綠化設施部分得不計入容積。
3.設置綠能發電設備者，得增加等同該設備實際使用面積（含建築立面使用面積）之樓地板面積，且其增加部分之樓地板面積得不計入容積。`;
  const art12 = calcClauseStats(text12);
  console.log(`第12點: ${art12.count} 行, 高度 ${art12.height.toFixed(2)} mm`);
  rightY -= art12.height;

  // 13. 第13點
  const text13 = `建築物提供部分樓地板面積供下列使用者，得增加所提供之樓地板面積。
1.私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人活動中心、景觀公共設施等供公眾使用；其集中留設之面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者。
2.建築物留設空間與天橋或地下道連接供公眾使用，經交通主管機關核准者。`;
  const art13 = calcClauseStats(text13);
  console.log(`第13點: ${art13.count} 行, 高度 ${art13.height.toFixed(2)} mm`);
  rightY -= art13.height;

  // 14. 第14點
  const art14 = calcClauseStats('本計畫區各建築基地除依都市更新法規實施都市更新事業之地區外，依本要點及其他相關法令規定所給予之獎勵容積，以不超過基地面積乘以該基地容積率之20％為限。');
  console.log(`第14點: ${art14.count} 行, 高度 ${art14.height.toFixed(2)} mm`);
  rightY -= art14.height;

  // 15. 第15點
  const art15 = calcClauseStats('本要點未規定之事項，適用其他法令規定。');
  console.log(`第15點: ${art15.count} 行, 高度 ${art15.height.toFixed(2)} mm`);
  rightY -= art15.height;

  const rightUsedH = rightStart - rightY;
  console.log(`\n【右欄結算】總使用高度: ${rightUsedH.toFixed(2)} mm / 500.67 mm (距離底線: ${(rightY - BOX_BOTTOM_Y).toFixed(2)} mm)`);
}

testAccurateLayout();
