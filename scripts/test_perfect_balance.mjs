import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.2;
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;
const AVAIL_H = BOX_TOP_Y - BOX_BOTTOM_Y - 17.5; // 503.17 mm

function wrapFormattedText(text, maxWeight = 54.0) {
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
      subIndent = indentSpaces + '    '; // 4 spaces (2 full width chars)
    } else if (/^[0-9]+\./.test(trimmed)) {
      subIndent = indentSpaces + '    '; // 4 spaces
    } else if (/^（[0-9]+）/.test(trimmed) || /^\([0-9]+\)/.test(trimmed)) {
      subIndent = indentSpaces + '      '; // 6 spaces
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

// 1. Check Left Column
console.log('=== LEFT COLUMN CHECK ===');
const art1 = COMPLETE_ZONING_DATA.leftColumnArticles[0];
const art1Wrapped = wrapFormattedText(art1.content, 54.0);
const art1H = art1Wrapped.split('\n').length * FONT_3MM_PITCH + 5.0;

const art2 = COMPLETE_ZONING_DATA.leftColumnArticles[1];
let art2H = (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0);
for (const r of art2.table1.rows) {
  const l0 = wrapFormattedText(r[0], 13.5).split('\n').length;
  const l3 = wrapFormattedText(r[3], 23.5).split('\n').length;
  art2H += Math.max(l0, l3) * FONT_3MM_PITCH + 2.0;
}
art2H += 3.5 + (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0);
for (const r of art2.table2.rows) {
  const l0 = wrapFormattedText(r[0], 13.5).split('\n').length;
  const l3 = wrapFormattedText(r[3], 23.5).split('\n').length;
  art2H += Math.max(l0, l3) * FONT_3MM_PITCH + 2.0;
}

// Article 3 Complete (一 ~ 八)
const art3 = COMPLETE_ZONING_DATA.leftColumnArticles[2];
const art3Indented = art3.content
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
const art3Wrapped = wrapFormattedText(art3Indented, 54.0);
const art3Lines = art3Wrapped.split('\n').length;
const art3H = art3Lines * FONT_3MM_PITCH + 5.0;

const totalLeftH = art1H + art2H + art3H;
console.log(`Art 1: ${art1H.toFixed(1)}mm, Art 2: ${art2H.toFixed(1)}mm, Art 3 (Complete): ${art3H.toFixed(1)}mm (${art3Lines} lines)`);
console.log(`Total Left Column Height: ${totalLeftH.toFixed(1)}mm / Available: ${AVAIL_H.toFixed(1)}mm (Remaining: ${(AVAIL_H - totalLeftH).toFixed(1)}mm)`);

// 2. Check Right Column
console.log('\n=== RIGHT COLUMN CHECK ===');
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
const art4Wrapped = wrapFormattedText(art4Indented, 54.0);
const art4Lines = art4Wrapped.split('\n').length;
const art4H = art4Lines * FONT_3MM_PITCH + 5.0;
console.log(`Art 4 (Complete): ${art4H.toFixed(1)}mm (${art4Lines} lines) / Available: ${AVAIL_H.toFixed(1)}mm (Remaining: ${(AVAIL_H - art4H).toFixed(1)}mm)`);
