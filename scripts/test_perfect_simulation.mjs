import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.4;
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;
const AVAIL_H = BOX_TOP_Y - BOX_BOTTOM_Y - 17.5; // 503.17 mm

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

    if (/^（[一二三四五六七八九十]+）/.test(trimmed) || /^\([一二三四五六七八九十]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '    '; // 4 spaces
    } else if (/^[0-9]+\./.test(trimmed)) {
      subIndent = indentSpaces + '    '; // 4 spaces
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '      '; // 6 spaces
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

// 1. Table 1 & Table 2 with 30.0 wrap on 備註
const art2 = COMPLETE_ZONING_DATA.leftColumnArticles[1];
let t1H = (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0);
for (const r of art2.table1.rows) {
  const l0 = wrapFormattedText(r[0], 13.5).split('\n').length;
  const l3 = wrapFormattedText(r[3], 30.0).split('\n').length;
  t1H += Math.max(l0, l3) * FONT_3MM_PITCH + 2.0;
}
let t2H = 3.5 + (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0);
for (const r of art2.table2.rows) {
  const l0 = wrapFormattedText(r[0], 13.5).split('\n').length;
  const l3 = wrapFormattedText(r[3], 30.0).split('\n').length;
  t2H += Math.max(l0, l3) * FONT_3MM_PITCH + 2.0;
}
console.log(`Table 1 H: ${t1H.toFixed(1)}mm, Table 2 H: ${t2H.toFixed(1)}mm (Total Tables: ${(t1H+t2H).toFixed(1)}mm)`);

// 2. Page 1 Left: Article 1 + Article 2 + Article 3 Part A (一 ~ 六)
const art1H = wrapFormattedText(COMPLETE_ZONING_DATA.leftColumnArticles[0].content, 52.5).split('\n').length * FONT_3MM_PITCH + 5.0;

const art3PartAText = `（一）乙種工業區及零星工業區之使用如下：
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
（六）潭-停3、潭-細公（兒）6用地公共設施用地多目標使用限非營利性公共設施使用。`;

const art3PartAWrapped = wrapFormattedText(art3PartAText, 52.5);
const art3PartALines = art3PartAWrapped.split('\n').length;
const art3PartAH = art3PartALines * FONT_3MM_PITCH + 5.0;

const page1LeftH = art1H + (t1H + t2H) + art3PartAH;
console.log(`Page 1 Left: Art1=${art1H.toFixed(1)}, Art2=${(t1H+t2H).toFixed(1)}, Art3 PartA=${art3PartAH.toFixed(1)} (${art3PartALines} lines)`);
console.log(`Total Page 1 Left: ${page1LeftH.toFixed(1)}mm / Available: ${AVAIL_H.toFixed(1)}mm (Remaining: ${(AVAIL_H - page1LeftH).toFixed(1)}mm)`);

// 3. Page 1 Right: Article 3 Part B (七 ~ 八) + Article 4
const art3PartBText = `（七）第三類型郵政專用區為促進郵政事業之發展而劃定（建蔽率不得大於50％，容積率不得大於240％），得為下列之使用：
    1.經營郵政事業所需設施及郵政必要附屬設施。
    2.一般商業設施：包括金融保險業、一般批發業、一般零售業、運動服務業、餐飲業、一般商業辦公大樓之商業使用。
    作前項第二款使用時，以都市計畫書載明得為該等使用者為限，其使用之樓地板面積，不得超過該郵政專用區容積總樓地板面積二分之一使用限制。
（八）電信用地之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。`;

const art3PartBWrapped = wrapFormattedText(art3PartBText, 52.5);
const art3PartBLines = art3PartBWrapped.split('\n').length;
const art3PartBH = art3PartBLines * FONT_3MM_PITCH + 5.0;

const art4 = COMPLETE_ZONING_DATA.rightColumnArticles[0];
const art4Indented = art4.content
  .split('\n')
  .map(line => {
    const t = line.trim();
    if (/^[0-9]+\./.test(t)) {
      return '    ' + t;
    } else if (/^（[0-9]+）/.test(t) || /^\([0-9]+\)/.test(t)) {
      return '        ' + t;
    }
    return t;
  })
  .join('\n');
const art4Wrapped = wrapFormattedText(art4Indented, 52.5);
const art4Lines = art4Wrapped.split('\n').length;
const art4H = art4Lines * FONT_3MM_PITCH + 5.0;

const page1RightH = art3PartBH + art4H;
console.log(`Page 1 Right: Art3 PartB=${art3PartBH.toFixed(1)} (${art3PartBLines} lines), Art4=${art4H.toFixed(1)} (${art4Lines} lines)`);
console.log(`Total Page 1 Right: ${page1RightH.toFixed(1)}mm / Available: ${AVAIL_H.toFixed(1)}mm (Remaining: ${(AVAIL_H - page1RightH).toFixed(1)}mm)`);
