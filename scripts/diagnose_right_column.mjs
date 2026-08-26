import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.2;
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;

// Test wrapping with Level 1 hanging indent, Level 2, Level 3 and maxWeight = 53.5
function wrapFormattedText(text, maxWeight = 53.5) {
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

    // 判斷標號層級並設定懸掛縮排 (Hanging Indent)
    if (/^（[一二三四五六七八九十]+）/.test(trimmed) || /^\([一二三四五六七八九十]+\)/.test(trimmed)) {
      // Level 1: （一） 佔約 4 格半形空白
      subIndent = indentSpaces + '    ';
    } else if (/^[0-9]+\./.test(trimmed)) {
      // Level 2: 1. 佔約 3~4 格半形空白
      subIndent = indentSpaces + '    ';
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
      // Level 3: （1） 佔約 5~6 格半形空白
      subIndent = indentSpaces + '      ';
    }

    let curLine = '';
    let curWeight = 0;

    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const weight = char.charCodeAt(0) > 255 ? 1.0 : 0.52;

      if (curWeight + weight > maxWeight) {
        wrappedLines.push(curLine);
        curLine = subIndent + char;
        curWeight = subIndent.length * 0.52 + weight;
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

// Check Right column Article 3 Part B and Article 4 Y coordinates
let curY = BOX_TOP_Y - 17.5; // after header (3476.75)
console.log('Right Column Start Y:', curY);

const art3PartBText = `（七）第三類型郵政專用區為促進郵政事業之發展而劃定（建蔽率不得大於50％，容積率不得大於240％），得為下列之使用：
    1.經營郵政事業所需設施及郵政必要附屬設施。
    2.一般商業設施：包括金融保險業、一般批發業、一般零售業、運動服務業、餐飲業、一般商業辦公大樓之商業使用。
    作前項第二款使用時，以都市計畫書載明得為該等使用者為限，其使用之樓地板面積，不得超過該郵政專用區容積總樓地板面積二分之一使用限制。
（八）電信用地之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。`;

const art3PartBWrapped = wrapFormattedText(art3PartBText, 53.5);
const art3PartBLines = art3PartBWrapped.split('\n').length;
console.log('Art 3 Part B lines:', art3PartBLines, 'startY:', curY, 'endY:', curY - (art3PartBLines * FONT_3MM_PITCH + 5.0));
curY -= (art3PartBLines * FONT_3MM_PITCH + 5.0);

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

const art4Wrapped = wrapFormattedText(art4Indented, 53.5);
const art4Lines = art4Wrapped.split('\n').length;
console.log('Art 4 lines:', art4Lines, 'startY:', curY, 'endY:', curY - (art4Lines * FONT_3MM_PITCH + 5.0));
const finalEndY = curY - (art4Lines * FONT_3MM_PITCH + 5.0);
console.log('Final Y in Right Column:', finalEndY, 'vs BOX_BOTTOM_Y:', BOX_BOTTOM_Y, 'Diff:', (finalEndY - BOX_BOTTOM_Y).toFixed(2), 'mm');
