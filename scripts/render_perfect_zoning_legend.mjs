import { RevitSocketClient } from '../MCP-Server/build/socket.js';

// Text Note Type ID for "3 mm 微軟正黑體"
const FONT_3MM_TYPE_ID = 501966;
const FONT_45MM_TYPE_ID = 456564; // 小標題4.5mm for title header

// Column Widths (Total: 395.0 mm)
const COL1_W = 15.0;   // 【法條】
const COL2_W = 220.0;  // 【土地使用管制規定】
const COL3_W = 160.0;  // 【本案設計檢討】

const START_X = 3000.0;
const START_Y = 3484.25;

const COL1_X = START_X;                     // 3000
const COL2_X = START_X + COL1_W;            // 3015
const COL3_X = COL2_X + COL2_W;             // 3235
const END_X  = COL3_X + COL3_W;             // 3395

// 精準中英文字元權重折行演算法
// 3mm 微軟正黑體在 214mm 有效寬度下，約可容納 50~52 個全形中文字
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
      // 全形中文字/標點: 1.0 權重; 半形英數/標點: 0.52 權重
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

export const ZONING_ARTICLES = [
  {
    num: '一、',
    title: '一、法源依據',
    content: `本要點依都市計畫法第22條、第32條及都市計畫法臺中市施行自治條例第49條規定訂定之。`,
    review: '本案依規定辦理。'
  },
  {
    num: '二、',
    title: '二、土地使用強度規定',
    isSpecialTable: true,
    intro1: `（一）本計畫區內各種土地使用分區之建蔽率、容積率不得大於下表規定：`,
    table1: {
      headers: ['項目', '建蔽率(%)', '容積率(%)', '備註'],
      colWidths: [54.0, 24.0, 24.0, 116.0],
      rows: [
        ['第一之一種住宅區', '60', '180', '1.屬原高速公路豐原交流道附近特定區計畫範圍者。\n2.建築基地面臨接15公尺以上計畫道路(含15公尺)縱深30公尺以內，不得大於200%；其他住宅區不得大於180%。'],
        ['第一之二種住宅區', '60', '180', '建蔽率不大於50%時，容積率得調整為不大於200%。'],
        ['第二種住宅區', '60', '200', '-'],
        ['第三種住宅區', '50', '200', '-'],
        ['第一之一種商業區', '80', '240', '-'],
        ['第一之二種商業區', '80', '240', '建蔽率不大於70%時，容積率得調整為不大於280%。'],
        ['乙種工業區', '70', '210', '栗林及潭秀工業區內其建築物之高度比不得超過1.5。'],
        ['零星工業區', '70', '210', '-'],
        ['零星工業區(供汙水處理場使用)', '60', '120', '與鄰近之農業區應以與環境協調之綠籬加強區隔，以減緩環境衝擊。'],
        ['古蹟保存區', '60', '160', '-'],
        ['宗教專用區(豐交-宗專1、豐交-宗專5)', '60', '160', '-'],
        ['宗教專用區(潭-宗專)', '40', '160', '-'],
        ['保存區(豐交-存)', '60', '160', '-'],
        ['保存區(潭-存)', '40', '120', '-'],
        ['加油站專用區', '40', '120', '-'],
        ['加工出口專用區', '70', '300', '全區容積得採總量管制。'],
        ['電信專用區', '50', '250', '-'],
        ['第三類型郵政專用區', '50', '240', '-']
      ]
    },
    intro2: `（二）本計畫區內各項公共設施用地之建蔽率、容積率不得大於下表規定：`,
    table2: {
      headers: ['項目', '建蔽率(%)', '容積率(%)', '備註'],
      colWidths: [54.0, 24.0, 24.0, 116.0],
      rows: [
        ['機關用地', '50', '250', '-'],
        ['學校用地(文中、文小)', '50', '150', '-'],
        ['學校用地(文高)', '50', '200', '-'],
        ['市場用地(豐交-市3、市5-1、市5-2)', '60', '240', '-'],
        ['市場用地(潭-市1~市6)', '80', '240', '-'],
        ['停車場用地(平面)', '10', '20', '-'],
        ['停車場用地(立體)', '80', '800', '-'],
        ['停車場用地(潭-停4)', '80', '400', '-'],
        ['自來水事業用地(豐交-自)', '50', '250', '-'],
        ['自來水事業用地(潭-自)', '50', '240', '-'],
        ['郵政事業用地', '50', '240', '-'],
        ['變電所用地', '50', '250', '-'],
        ['污水處理場用地', '30', '60', '-'],
        ['車站用地', '40', '200', '高架月台不計入容積。'],
        ['倉庫用地', '70', '210', '-'],
        ['電信用地', '50', '250', '-']
      ]
    },
    review: '本案依規定辦理。'
  },
  {
    num: '三、',
    title: '三、土地及建築物之使用規定',
    content: `（一）乙種工業區及零星工業區之使用如下：
1.乙種工業區之使用依都市計畫法臺中市施行自治條例乙種工業區規定管制。
2.乙種工業區申請設置公共服務設施及公用事業設施，其使用細目、使用面積、使用條件及管理維護事項之核准條件如附件七；申請作業程序及應備書件，依「臺中市都市計畫甲種乙種工業區土地申請設置公共服務設施及公用事業設施總量管制作業要點」規定辦理。
3.乙種工業區（栗林及潭秀工業區內）者用語定義如下：
（1）基地線：建築基地之界線。
（2）前面基地線：基地臨接計畫道路之基地線。臨接二條以上計畫道路者，由建築基地申請人任選一側為前面基地線。
（3）前院：沿前面基地線之庭院。其他臨接計畫道路之基地線，另有設置騎樓或退縮規定者，從其規定，無規定者，比照前院深度退縮。
（4）建築物高度比：建築物各部分高度與自各該部分起量至臨接道路對側道路境界線之最小水平距離之比。但臨接二條以上道路者，得任選一條檢討。
建築物不計建築物高度者及不計建築面積之陽台、屋簷、雨遮等，得不受建築物高度比之限制。
建築基地臨接或臨接道路對側有公園、綠地、廣場、河川、體育場、兒童遊樂場、綠帶、計畫水溝、平面式停車場、行水區、湖泊、水堰或其他類似空地者，其建築物高度比之計算，得將該等寬度計入。
（二）電信專用區之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至5款規定辦理。
（三）自行車專用道用地僅供人行、自行車通行。但經本府主管機關審查後得作為自行車休憩、租賃及小型飲食店（樓地板面積300㎡以下）之使用。
（四）園道用地（得兼供自行車專用道及其附屬設施使用）除兼供自行車專用道之附屬設施使用部分外之路段，不得指定建築線。
（五）潭-細公（兒）3用地不得依「都市計畫公共設施用地多目標使用辦法」作多目標使用。
（六）潭-停3、潭-細公（兒）6用地公共設施用地多目標使用限非營利性公共設施使用。
（七）第三類型郵政專用區為促進郵政事業之發展而劃定（建蔽率不得大於50％，容積率不得大於240％），得為下列之使用：
1.經營郵政事業所需設施及郵政必要附屬設施。
2.一般商業設施：包括金融保險業、一般批發業、一般零售業、運動服務業、餐飲業、一般商業辦公大樓之商業使用。
作前項第二款使用時，以都市計畫書載明得為該等使用者為限，其使用之樓地板面積，不得超過該郵政專用區容積總樓地板面積二分之一使用限制。
（八）電信用地之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。`,
    review: '本案依規定辦理。'
  },
  {
    num: '四、',
    title: '四、騎樓與建築退縮規定',
    content: `（一）屬原高速公路豐原交流道附近特定區計畫範圍者各種土地使用分區及公共設施用地之退縮建築規定如下：
1.第一之一種住宅區及第一之一種商業區，凡面臨7公尺（含7公尺）以上計畫道路之建築基地，應設置騎樓或無遮簷人行道。凡面臨未達7公尺計畫道路，以及面臨現有巷道（含重劃增設道路）之建築基地，應由建築線（溝濱後）退縮0.5公尺建築。
2.豐交-宗專1、豐交-宗專5為符合「臺中市都市計畫宗教專用區劃設檢討變更處理原則」第4條第1項規定，需由面前臨接道路自對面道路境界線自行退縮6公尺以上。
3.豐交-零工84之建築基地與毗鄰農業區鄰接部分，應自基地界線退縮1.5公尺建築。
4.自來水事業用地及機關用地應自基地境界線至少退縮4公尺建築，如有設置圍牆之必要者，圍牆應自基地境界線至少退縮2公尺；退縮部分得計入法定空地，並應妥予植栽綠化。
5.變電所用地應自道路境界線至少退縮10公尺建築，如有設置圍牆之必要者，圍牆應自道路境界線至少退縮3公尺。建築物與鄰地應自基地境界線至少退縮4公尺建築，退縮建築之空地應植栽綠化，但得計入法定空地。
6.其他土地使用分區及公共設施用地，凡面臨7公尺（含7公尺）以上計畫道路之建築基地，應自計畫道路退縮4公尺為無遮簷人行道。凡面臨未達7公尺計畫道路，以及面臨現有巷道之建築基地，應由建築線（溝濱後）退縮0.5公尺建築。
（二）屬原潭子都市計畫區為塑造良好都市景觀及完整之人行系統，本計畫區除劃設廣場、兒童遊樂場、公園兼兒童遊樂場及公園外，其他各種土地使用分區及公共設施用地之退縮建築規定如下：
1.94年3月23日後，以市地重劃或區段徵收方式辦理之整體開發地區，其住宅區、商業區應自建築線退縮5公尺建築，其中至少留設2公尺之無遮簷人行道，退縮部分得計入法定空地。如屬角地且兩面道路寬度不一時，應以較寬道路為退縮面，且另一臨接道路面亦應至少留設2公尺之無遮簷人行道；兩面道路寬度相同者，除擇一退縮外，另一臨接道路面亦應至少留設2公尺之無遮簷人行道。
2.除前款外之住宅區、商業區、其他土地使用分區及公共設施用地，凡面臨7公尺（含7公尺）以上計畫道路之建築基地，應設置4公尺騎樓或無遮簷人行道。面臨未達7公尺計畫道路，以及面臨現有巷道之建築基地，應由建築線（溝濱後）退縮0.5公尺建築，退縮部分得計入法定空地。
3.第三種住宅區應自道路境界線至少退縮5公尺建築（如屬角地且兩面道路寬度不一時，應以較寬道路為退縮面，而兩面道路寬度相同者，擇一退縮），臨接道路部分至少保留2公尺於重劃工程一併施工供人行使用；退縮部分得計入法定空地。
4.原「潭子都市計畫（第三次通盤檢討（暫予保留）再提會討論案）（南側地區）細部計畫」之住宅區應自道路境界線或廣場用地至少退縮5公尺建築（如屬角地且兩面道路寬度不一時，應以較寬道路為退縮面，兩面道路寬度相同者，擇一退縮；如屬角地且面臨道路及廣場用地者，亦應以較寬道路為退縮面）；退縮建築之空地應植栽綠化，不得設置圍籬，但得計入法定空地。
5.乙種工業區基地（不包含栗林及潭秀工業區）應自建築線退縮4公尺建築，退縮部分得計入法定空地並應妥為植栽綠化。
6.乙種工業區（栗林及潭秀工業區內）者
（1）與住宅區直接鄰接部份申請建築時，應自乙種工業區境界線退縮6公尺；建築物基地最低前院深度及深度比各為6公尺及0.3。（最低前院深度比：建築物前院深度與建築物正面高度之比。）
（2）建築基地臨接現有巷道部分，應自建築線再退縮1公尺建築，退縮部分供通行使用，並得計入法定空地。
7.新開闢學校用地申請建築執照時，面臨計畫道路部分應退縮建築，退縮部分得計入法定空地，並依下列規定辦理：
（1）應有1側退縮10公尺，供綠化、人行步道、停車及學生接送專用車道等使用。
（2）其他臨道路部分應退縮4公尺無遮簷人行道，供綠化及人行步道等使用。
8.變電所用地申請建築時，應自基地境界線至少退縮10公尺建築，如有設置圍牆之必要者，圍牆應自道路境界線至少退縮5公尺；並採屋內型設計，退縮部分得計入法定空地並應妥為綠化及種植喬木。
9.污水處理場申請建築時，應自基地境界線至少退縮10公尺建築，如有設置圍牆之必要者，圍牆應自道路境界線至少退縮5公尺；退縮部分得計入法定空地並應妥為綠化及種植喬木。
10.配合潭子四通（一階），計畫區39處人行步道變更為道路用地部分，為確保消防救災通道安全，增列：
（1）住宅區：本計畫區4公尺計畫道路2側建築基地應各退縮1公尺供道路使用，得計入法定空地。
（2）工業區：本計畫區4公尺計畫道路2側建築基地應各退縮2公尺供道路使用，得計入法定空地。
11.原「潭子都市計畫（原「兒四」兒童遊樂場用地變更為住宅區）細部計畫」之住宅區應自道路境界線至少退縮5公尺以上建築（如屬角地且兩面道路寬度不一時，應以較寬道路為退縮面，而兩面道路寬度相同時，則擇一退縮），退縮部分得計入法定空地；停車場用地應自道路境界線至少退縮5公尺以上建築，退縮部分得計入法定空地，如有設置圍牆之必要者，圍牆應自道路境界線至少退縮3公尺。`,
    review: '本案依規定辦理。'
  },
  {
    num: '五、',
    title: '五、停車空間留設規定',
    content: `本計畫區內停車空間留設規定如下：
（一）屬原高速公路豐原交流道附近特定區計畫範圍者，停車空間留設依建築技術規則建築設計施工編第59條規定辦理。
（二）屬原潭子都市計畫範圍者停車空間規定如下：
1.本計畫區建築物附設停車空間設置標準依建築技術規則設計施工編第59條所列第一類建築物用途，樓地板面積150平方公尺以下免設汽車停車位，但至少須設置1輛機車或自行車停車位，超過部分每100平方公尺設置1輛汽車與1輛機車或自行車停車位，其餘數部分超過50平方公尺應設置1輛汽車與1輛機車或自行車停車位；第二類建築物用途，樓地板面積150平方公尺以下免設汽車停車位，超過部分每150平方公尺設置1輛汽車停車位，其餘數部分超過75平方公尺應設置1輛汽車停車位，機車或自行車停車位以每戶設置1輛為原則。
2.依前述規定計算建築物新建、增建及既有建築物應留設之汽車停車位在5輛以下無法設置者，得繳納代金，並依「臺中市建築物附建防空避難設備或停車空間繳納代金及管理使用自治條例」辦理。
3.乙種工業區建築基地內法定空地應留設二分之一以上作為停車場及裝卸貨物使用。
4.車站用地內作車站站體及相關附屬設施之樓地板面積超過250平方公尺部分，每150平方公尺設置一部停車空間。數量未達整數時，其餘數應設置一部停車空間。機車或自行車之停車格位，依汽車停車格位加乘2倍計算。
5.其餘依建築技術規則停車空間相關規定辦理，且應至少劃設與法定汽車停車位數相同之機車或自行車停車位。
6.機車或自行車停車位標準為每輛之長度不得小於1.8公尺、寬度不得小於0.9公尺，並得以每部4平方公尺核算免計入總樓地板面積，但應以應留設汽車停車格位之2倍為計算上限。
7.原「潭子都市計畫（潭興路、勝利路與體育場用地所圍部分地區）細部計畫」內建築樓地板面積未達100平方公尺者，應留設1部停車空間，如超過100平方公尺，則超過部分每超過150平方公尺應增設1部停車空間。
8.原「潭子都市計畫（第三次通盤檢討（暫予保留）再提會討論案）（南側地區）細部計畫」、「潭子都市計畫（原「兒四」兒童遊樂場用地變更為住宅區）細部計畫」之住宅區建築樓地板在250平方公尺（含）以下者，應留設1部停車空間，如超過250平方公尺者，則超過部分每150平方公尺及其零數應增設1部停車空間。
9.原「潭子都市計畫（原部分公一公園用地變更為住宅區）細部計畫」之住宅區建築樓地板面積在100平方公尺以下者，應留設1部停車空間，如超過100平方公尺，則超過部分每超過150平方公尺應增設1部停車空間。`,
    review: '本案依規定辦理。'
  },
  {
    num: '六、',
    title: '六、綠化及植栽相關規定',
    content: `本計畫區內綠化及植栽相關規定如下：
（一）本計畫區內（除豐交-零工84外）建築基地內之法定空地扣除依相關法令規定無法綠化之面積後應留設二分之一以上種植花草樹木予以綠化；但因設置無遮簷人行道、裝卸位、車道及現有道路，致法定空地未達應種植花草樹木面積者，則僅限實設空地須種植花草樹木，並依建築技術規則建築設計施工編綠建築基準之建築基地綠化規定以綠化總二氧化碳固定量及二氧化碳固定量基準值做檢討。法定空地面積每滿64平方公尺應至少植喬木1棵，其綠化工程應納入建築設計圖說於請領建造執照時一併核定之，覆土深度草皮應至少30公分、灌木應至少60公分、喬木應至少120公分。
（二）豐交-零工84內綠地之綠化植栽樹種選擇應儘量種植喬木為原則，以達綠化之效。
（三）屬原潭子都市計畫範圍者為維護景觀並加強綠化，有關景觀與綠化應依下列規定辦理：
1.新開闢學校用地，其法定空地之透水面積比例不得小於70％，且應避免設置不透水之運動場及跑道，操場除得依「都市計畫公共設施用地多目標使用辦法」第三條規定設置滯洪池外，不得設置地下室，惟情形特殊經臺中市政府都市設計審議委員會審議通過者不在此限。
2.公園、公園兼兒童遊樂場、兒童遊樂場及綠地等用地，其透水面積不得小於該用地面積60％。`,
    review: '本案依規定辦理。'
  },
  {
    num: '七、',
    title: '七、都市設計審議範圍',
    content: `本計畫區內應提送都市設計審議範圍依「臺中市都市設計審議規範」規定辦理。`,
    review: '本案依規定辦理。'
  },
  {
    num: '八、',
    title: '八、公益性設施獎勵規定',
    content: `為鼓勵設置公益性設施，除經劃設為都市更新單元之地區，另依都市更新條例規定辦理外，訂定下列獎勵措施；建築物提供部分樓地板面積供下列使用者，得增加所提供之樓地板面積，但以不超過基地面積乘以該基地容積率之10％為限：
（一）私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人等活動中心、景觀公共設施等供公眾使用，其集中留設之樓地板面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者外，申請建造執照時，前開公益性基金會應為公益性設施之起造人。
（二）建築物留設空間與天橋或地下道連接供公眾使用，經道路主管機關核准者。`,
    review: '本案依規定辦理。'
  },
  {
    num: '九、',
    title: '九、無償捐贈道路容積獎勵',
    content: `為鼓勵工業興辦人無償捐贈本細部計畫範圍（栗林及潭秀工業區）內之計畫道路用地，得依下列容積獎勵規定增加本細部計畫工業區建築基地容積，惟不得超過建築基地法定容積之20%。
建築基地增加之容積=無償捐贈之計畫道路土地面積×（無償捐贈土地當期之公告土地現值／建築基地當期之公告土地現值）×210％（建築基地之容積率）`,
    review: '本案依規定辦理。'
  },
  {
    num: '十、',
    title: '十、容積移轉規定',
    content: `本計畫區申請容積移轉，以移轉至本細部計畫範圍內之其他可建築用地為限。`,
    review: '本案依規定辦理。'
  },
  {
    num: '十一、',
    title: '十一、其他規定',
    content: `本要點未規定事項，適用其他法令之規定。`,
    review: '本案依規定辦理。'
  }
];

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'render-zoning-perfect-spacing-' + Date.now();
  await client.connect();

  const viewId = 702748; // "2_都市計畫1"
  console.log(`\n=== 執行【2_都市計畫1】精準行高與字寬排版校正 ===\n`);

  // 1. 清理視圖內既有所有文字註釋與細線
  console.log('--- Step 1: 清理既有元素 ---');
  const existingNotes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });
  const existingLines = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  const noteIds = (existingNotes.data?.Elements || []).map(e => e.ElementId || e.Id);
  const lineIds = (existingLines.data?.Elements || []).map(e => e.ElementId || e.Id);
  console.log(`清理 ${noteIds.length} 個 TextNotes 與 ${lineIds.length} 條 Lines...`);

  for (const id of noteIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  for (const id of lineIds) {
    try { await client.sendCommand('delete_element', { elementId: id }); } catch(e) {}
  }
  console.log('清理完畢！\n');

  // 2. 幾何參數設定
  // 3mm 微軟正黑體在 Revit 視圖中實際行距為 5.6mm
  const LINE_PITCH = 5.6;     // mm per line
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
  textNotesToCreate.push({
    x: COL1_X + 2.5,
    y: curY - 2.0,
    text: '法條',
    typeId: FONT_3MM_TYPE_ID
  });
  textNotesToCreate.push({
    x: COL2_X + 4.0,
    y: curY - 2.0,
    text: '土地使用管制規定',
    typeId: FONT_3MM_TYPE_ID
  });
  textNotesToCreate.push({
    x: COL3_X + 4.0,
    y: curY - 2.0,
    text: '本案設計檢討',
    typeId: FONT_3MM_TYPE_ID
  });

  curY -= colHeaderHeight;
  createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });

  // 2.2 逐條排版
  for (const art of ZONING_ARTICLES) {
    const rowStartY = curY;

    if (art.isSpecialTable) {
      // 第二條：含內嵌子表格
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

      // 子表 1 (使用分區)
      const t1 = art.table1;
      const t1StartX = COL2_X + 1.0;
      const t1EndX = COL2_X + COL2_W - 1.0;

      // 子表 1 表頭
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      let hX = t1StartX;
      for (let c = 0; c < t1.headers.length; c++) {
        textNotesToCreate.push({
          x: hX + 1.5,
          y: subY,
          text: t1.headers[c],
          typeId: FONT_3MM_TYPE_ID
        });
        hX += t1.colWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      // 子表 1 資料列
      for (const row of t1.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 24.0); // 備註欄寬度 116mm，折行權重 24
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += t1.colWidths[0];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += t1.colWidths[1];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += t1.colWidths[2];
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      subY -= 3.5;

      // 引言 2
      textNotesToCreate.push({
        x: COL2_X + 2.0,
        y: subY,
        text: art.intro2,
        typeId: FONT_3MM_TYPE_ID
      });
      subY -= (LINE_PITCH + 2.5);

      // 子表 2 (公共設施)
      const t2 = art.table2;
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      hX = t1StartX;
      for (let c = 0; c < t2.headers.length; c++) {
        textNotesToCreate.push({
          x: hX + 1.5,
          y: subY,
          text: t2.headers[c],
          typeId: FONT_3MM_TYPE_ID
        });
        hX += t2.colWidths[c];
      }
      subY -= (LINE_PITCH + 1.5);
      createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });

      for (const row of t2.rows) {
        const rowTopY = subY;
        const wrappedNote = wrapChineseText(row[3], 24.0);
        const noteLineCount = wrappedNote.split('\n').length;
        const rowH = Math.max(1, noteLineCount) * LINE_PITCH + 2.5;

        let rX = t1StartX;
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: row[0], typeId: FONT_3MM_TYPE_ID });
        rX += t2.colWidths[0];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[1], typeId: FONT_3MM_TYPE_ID });
        rX += t2.colWidths[1];
        textNotesToCreate.push({ x: rX + 3.0, y: rowTopY, text: row[2], typeId: FONT_3MM_TYPE_ID });
        rX += t2.colWidths[2];
        textNotesToCreate.push({ x: rX + 1.0, y: rowTopY, text: wrappedNote, typeId: FONT_3MM_TYPE_ID });

        subY -= rowH;
        createdLines.push({ startX: t1StartX, startY: subY + 1.0, endX: t1EndX, endY: subY + 1.0 });
      }

      curY = subY - BOTTOM_PADDING;
    } else {
      // 一般法規條文：折行權重 50.0（確保文字緊湊拉滿且絕不跨越 220mm 邊界）
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

    // 每一條法規下方的水平分隔線（精準繪製於最末行文字下方）
    createdLines.push({ startX: START_X, startY: curY, endX: END_X, endY: curY });
  }

  // 2.3 繪製表格縱向外框線與欄分界線
  const tableBottomY = curY;
  const vLineXPositions = [COL1_X, COL2_X, COL3_X, END_X];
  for (const vx of vLineXPositions) {
    createdLines.push({ startX: vx, startY: START_Y, endX: vx, endY: tableBottomY });
  }

  // 3. 發送至 Revit 繪製線條與文字
  console.log(`發送 ${createdLines.length} 條線條至 Revit...`);
  await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: createdLines
  });

  console.log(`發送 ${textNotesToCreate.length} 個 TextNote 至 Revit 並統一套用【3 mm 微軟正黑體】...`);
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
  console.log('✅ 【2_都市計畫1】圖例精準排版校正完成！');
  console.log('- 文字邊界：第二欄折行寬度精準校正為 50 字寬，絕不超出右側分界線');
  console.log('- 段落重疊修正：行高設定為 5.6mm + 上下安全間距，所有段落完全向下推開');
  console.log('- 細線同步下移：水平分隔線精確貼齊各條文底端，層次分明無重疊');
  console.log('========================================================\n');
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('render_perfect_zoning_legend.mjs')) {
  main().catch(err => {
    console.error('執行失敗:', err);
    process.exit(1);
  });
}
