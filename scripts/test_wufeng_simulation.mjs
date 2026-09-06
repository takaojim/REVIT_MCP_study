import fs from 'fs';

// 欄寬幾何
const COL1_W = 15.0;
const COL2_W = 220.0;
const COL3_W = 158.08;
const LINE_PITCH = 5.8;

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

const WUFENG_ARTICLES = [
  {
    num: '一、',
    title: '法源依據',
    type: 'text',
    content: '本要點依據都市計畫法第22條、第32條及都市計畫法臺中市施行自治條例第49條規定訂定之。'
  },
  {
    num: '二、',
    title: '土地使用分區強度',
    type: 'table_zoning',
    intro: '本計畫區內各種土地使用分區之建蔽率、容積率不得大於下表規定：',
    table: {
      headers: ['使用分區', '建蔽率（％）', '容積率（％）'],
      colWidths: [74.0, 70.0, 70.0],
      rows: [
        ['住宅區', '60', '200'],
        ['商業區', '80', '320'],
        ['乙種工業區', '60', '210'],
        ['宗教專用區', '50', '160'],
        ['電信專用區', '50', '250']
      ]
    }
  },
  {
    num: '三、',
    title: '乙工公共服務與公用事業設施',
    type: 'text',
    content: '乙種工業區申請設置公共服務設施及公用事業設施，其使用細目、使用面積、使用條件及管理維護事項之核准條件如附表；申請作業程序及應備書件，依「臺中市都市計畫甲種乙種工業區土地申請設置公共服務設施及公用事業設施總量管制作業要點」規定辦理。'
  },
  {
    num: '四、',
    title: '電信專用區規定',
    type: 'text',
    content: '電信專用區之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。'
  },
  {
    num: '五、',
    title: '公共設施用地強度',
    type: 'table_pub',
    intro: '本計畫區內各項公共設施用地之建蔽率與容積率不得大於下表規定：',
    table: {
      headers: ['公共設施種類', '建蔽率（％）', '容積率（％）'],
      colWidths: [74.0, 70.0, 70.0],
      rows: [
        ['市場用地', '60', '240'],
        ['學校用地\n(國中以下)', '40', '150'],
        ['學校用地\n(高中職)', '40', '200'],
        ['機關用地', '50', '250'],
        ['社教用地', '50', '200'],
        ['汙水處理場用地', '50', '150'],
        ['變電所用地', '50', '250'],
        ['自來水事業用地', '50', '250'],
        ['電力事業用地', '50', '250'],
        ['郵政事業用地', '50', '250'],
        ['社會福利設施用地', '50', '400']
      ]
    }
  },
  {
    num: '六、',
    title: '機關用地經營管理',
    type: 'text',
    content: '機關用地（霧-機3）內議員會館及機關用地（霧-機5）內國立臺灣交響樂團坐落範圍，依促進民間參與公共建設法相關規定辦理委外經營管理時，其使用項目得為旅館業及其附屬設施使用。'
  },
  {
    num: '七、',
    title: '社會福利設施用地規定',
    type: 'text',
    content: `社會福利設施用地得為下列之使用：
（一）作社會住宅使用。
（二）依住宅法第33條規定，應保留一定空間供作社會福利服務、長期照顧服務、身心障礙服務、托育服務、幼兒園、青年創業空間、社區活動、文康休閒活動、商業活動、餐飲服務或其他必要附屬設施之用。
（三）其他經臺中市都市計畫委員會同意容許使用項目。`
  },
  {
    num: '八、',
    title: '社教用地退縮規定',
    type: 'text',
    content: `「霧-社2」社教用地專供設置九二一地震教育園區及其他相關附屬設施使用，提供展示空間及教育活動等，並得設置行政辦公廳舍及餐飲服務設施，且新建建築物應自基地北側計畫道路境界線至少退縮5公尺建築，退縮部分得計入法定空地，並應妥為植栽綠化。`
  },
  {
    num: '九、',
    title: '公益性設施獎勵',
    type: 'text',
    content: `為鼓勵設置公益性設施，除經劃設為都市更新單元之地區，另依都市更新條例規定辦理外，訂定下列獎勵措施；其建築物提供部分樓地板面積供下列使用，得增加所提供之樓地板面積，但以不超過基地面積乘以該基地容積率之10％為限：
（一）私人捐獻或設置圖書館、博物館、藝術中心、兒童、青少年、勞工、老人等活動中心、景觀公共設施等供公眾使用；其集中留設之樓地板面積在100平方公尺以上，並經目的事業主管機關核准設立公益性基金管理營運者外，申請建造執照時，前開公益性基金會應為公益性設施之起造人。
（二）建築物留設空間與天橋或地下道連接供公眾使用，經道路主管機關核准者。`
  },
  {
    num: '十、',
    title: '公園用地地下停車場',
    type: 'text',
    content: `本計畫「霧-公1」公園用地得依都市計畫公共設施用地多目標使用辦法規定優先興建地下停車場供公共停車使用。`
  },
  {
    num: '十一、',
    title: '霧峰聯合辦公廳舍退縮',
    type: 'text',
    content: `霧峰聯合辦公廳舍範圍應自道路境界線至少退縮2公尺建築，其退縮地不計入法定空地面積。`
  },
  {
    num: '十二、',
    title: '法定空地綠化規定',
    type: 'text',
    content: `建築基地內之法定空地扣除依相關法令規定無法綠化之面積後應留設二分之一以上種植花草樹木予以綠化；但因設置無遮簷人行道、裝卸位、車道及現有道路，致法定空地未達應種植花草樹木面積者，則僅限實設空地須種植花草樹木，並依建築技術規則建築設計施工編綠建築基準之建築基地綠化規定以綠化總二氧化碳固定量及二氧化碳固定量基準值做檢討。法定空地面積每滿64平方公尺應至少植喬木1棵，其綠化工程應納入建築設計圖說於請領建造執照時一併核定之，覆土深度草皮應至少30公分、灌木應至少60公分、喬木應至少120公分。`
  },
  {
    num: '十三、',
    title: '都市設計審議範圍',
    type: 'text',
    content: `本計畫區內應提送都市設計審議範圍：
（一）公有建築之審議依臺中市公有建築應送都市設計委員會審議要點規定辦理。
（二）公用事業（包括電信局、航空站、大客車運輸業之轉運站、公私立大型醫院、文大及文教區等）建築申請案之總樓地板超過10,000平方公尺者。
（三）新建建築達以下規模：
    1. 新建建築樓層高度12層以上。
    2. 住宅區新建之建築基地面積超過6,000平方公尺者。
    3. 商業區新建之建築基地面積超過3,000平方公尺者。
    4. 住宅區及商業區新建總樓地板面積超過30,000平方公尺者。
（四）新闢立體停車場基地面積6,000平方公尺以上者。但建築物附屬停車場者，不在此限。
（五）實施容積管制前已申請或領有建造執照，在建造執照有效期間內，依建築技術規則建築設計施工編第166條之1第2項執照之申請案。
前項各款建築基地之建築基地規模、開放空間、人車通行系統、交通運輸系統、建築量體造型與色彩、景觀計畫、環境保護設施、防災空間、氣候調適與管理維護計畫等都市設計相關事項，應提送臺中市政府都市設計審議委員會審議，經審議通過後，始依法核發建照。`
  },
  {
    num: '十四、',
    title: '老舊建物重建獎勵',
    type: 'text',
    content: `為鼓勵都市老舊地區申辦獎勵老舊建物重建，屬商業區及住宅區之建築基地，其達都市設計審議規模者從其規定，符合下列條件得予以獎勵基準容積之20％或15％：
（一）基地面積500平方公尺以上，30年以上鋼筋混凝土造、預鑄混凝土造及鋼骨混凝土造合法建築物坐落之建築基地與其他土地上之違章建築物投影面積合計達申請重建基地面積之二分之一，其中30年以上合法建築物坐落之建築基地應達前述面積總和二分之一，得申請獎勵基準容積之20％。
（二）基地面積500平方公尺以上，土磚造、木造、磚造及石造合法建築物、20年以上之加強磚造及鋼鐵造合法建築物坐落之建築基地與其他土地上之違章建築物投影面積合計達申請重建基地面積之二分之一，其中合法建築物坐落之建築基地應達前述面積總和二分之一，得申請獎勵基準容積之15％。
（三）經全部土地所有權人同意。
（四）建築配置時，應自基地退縮二側，包括基地後側及側面，側面得選擇一側並連通至道路，該退縮淨寬至少1.5公尺。
（五）不得再申請建築技術規則所訂定開放空間獎勵。`
  },
  {
    num: '十五、',
    title: '停車空間',
    type: 'text',
    content: `停車空間
（一）本計畫區建築物附設停車空間設置標準依建築技術規則設計施工編第59條所列第一類建築物用途，樓地板面積300平方公尺以下免設汽車停車位，但至少須設置1輛機車（或自行車）停車位，超過300平方公尺部分每150平方公尺設置1輛汽車與1輛機車（或自行車）停車位；第二類建築物用途，樓地板面積500平方公尺以下免設汽車停車位，超過500平方公尺部分每150平方公尺設置1輛汽車停車位與1輛機車（或自行車）停車位。
（二）機車（或自行車）停車位標準為每輛之長度不得小於1.8公尺、寬度不得小於0.9公尺，其集中設置部數在20部（含）以上者，得以每部4平方公尺核計免計入總樓地板面積，機車（或自行車）停車位應設置於地面層或地下一層，必要時得延伸至地下二層。`
  },
  {
    num: '十六、',
    title: '受保護樹木之保護',
    type: 'text',
    content: `受保護樹木之保護
（一）為保存與維護計畫區內經本府認定並公告列管之「受保護樹木」及其必要生育地環境，應依「臺中市樹木保護自治條例」之規定辦理。
（二）建築基地及公共設施用地申請建築開發時，應配合受保護樹木位置集中留設開放空間，以其必要生育地環境及面積至少50平方公尺之範圍為原則，得計本要點第九條之應綠化面積。惟經「臺中市樹木保護委員會」審議同意無需原地保留之受保護樹木者不在此限。
（三）建築基地及公共設施用地申請建築開發時，應檢附基地現況植栽調查與測量資料，至少包括樹種、位置、樹徑樹冠等相關資料。`
  },
  {
    num: '十七、',
    title: '細部計畫管轄規定',
    type: 'text',
    content: `建築基地屬已發布細部計畫範圍內之土地，其土地及建築物之使用，悉依該細部計畫之規定辦理；其餘未規定事項或細部計畫未訂定土地使用分區管制要點之地區，應依本要點管制之。`
  },
  {
    num: '十八、',
    title: '其他法令適用',
    type: 'text',
    content: `本要點未規定事項適用都市計畫法臺中市施行自治條例及其他有關法令之規定辦理。`
  }
];

console.log('=== 條文高度模擬 ===');
let totalH = 0;
const heights = [];

for (const art of WUFENG_ARTICLES) {
  let h = 0;
  if (art.type === 'text') {
    const wrapped = wrapFormattedText(art.content, 52.5);
    const lines = wrapped.split('\n').length;
    h = lines * LINE_PITCH + 6.0;
    console.log(`${art.num} ${art.title}: ${lines} lines, Height: ${h.toFixed(1)} mm`);
  } else if (art.type === 'table_zoning') {
    // intro + table (6 rows * 6.5mm = 39mm + intro 12mm)
    h = 12.0 + 39.0 + 8.0;
    console.log(`${art.num} ${art.title}: Table (5 rows), Height: ${h.toFixed(1)} mm`);
  } else if (art.type === 'table_pub') {
    // intro + table (11 rows * 6.5mm = 71.5mm + intro 12mm)
    h = 12.0 + 75.0 + 8.0;
    console.log(`${art.num} ${art.title}: Table (10 items/11 rows), Height: ${h.toFixed(1)} mm`);
  }
  heights.push({ num: art.num, title: art.title, h });
  totalH += h;
}

console.log(`\n總內容高度: ${totalH.toFixed(1)} mm`);
console.log(`單欄可用高度: 500.67 mm`);
console.log(`雙欄（Page 1 左右兩欄）總可用高度: ${(500.67 * 2).toFixed(1)} mm`);

// Check pagination
let page1L = 0;
let page1R = 0;
let page2L = 0;

let p1L_items = [];
let p1R_items = [];
let p2L_items = [];

let curCol = 1;
for (const item of heights) {
  if (curCol === 1) {
    if (page1L + item.h <= 485.0) {
      page1L += item.h;
      p1L_items.push(item.num);
    } else {
      curCol = 2;
    }
  }
  if (curCol === 2) {
    if (page1R + item.h <= 485.0) {
      page1R += item.h;
      p1R_items.push(item.num);
    } else {
      curCol = 3;
    }
  }
  if (curCol === 3) {
    page2L += item.h;
    p2L_items.push(item.num);
  }
}

console.log('\n--- 推薦版面配置 ---');
console.log(`Page 1 左欄 (${page1L.toFixed(1)} mm / 500.7 mm):`, p1L_items.join(' '));
console.log(`Page 1 右欄 (${page1R.toFixed(1)} mm / 500.7 mm):`, p1R_items.join(' '));
console.log(`Page 2 左欄 (${page2L.toFixed(1)} mm / 500.7 mm):`, p2L_items.join(' '));
