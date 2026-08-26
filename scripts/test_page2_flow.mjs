import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.4;
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;
const START_CONTENT_Y = BOX_TOP_Y - 17.5; // 3476.75
const AVAIL_H = START_CONTENT_Y - BOX_BOTTOM_Y; // 503.17 mm

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

// 1. Article 5 height calculation
const art5 = COMPLETE_ZONING_DATA.rightColumnArticles[1];
const introLines = wrapFormattedText(art5.intro1, 52.5).split('\n').length;
const introH = introLines * FONT_3MM_PITCH + 8.0;

const pt = art5.parkingTable;
const tableHeaderH = FONT_3MM_PITCH * 2 + 1.5;
let tableRowsH = 0;
for (const row of pt.rows) {
  const isSpecialGroup = row.group.includes('\n');
  tableRowsH += isSpecialGroup ? (FONT_3MM_PITCH * 2 + 1.0) : (FONT_3MM_PITCH + 1.5);
}
const tableH = tableHeaderH + tableRowsH + 6.0; // 6mm after table

const afterIndented = art5.contentAfter
  .split('\n')
  .map(line => (/^[0-9]+\./.test(line.trim()) ? '    ' + line.trim() : line))
  .join('\n');
const afterLines = wrapFormattedText(afterIndented, 52.5).split('\n').length;
const afterH = afterLines * FONT_3MM_PITCH + 10.0;

const art5TotalH = introH + tableH + afterH;
console.log(`Art 5 (停車): Intro=${introH.toFixed(1)}, Table=${tableH.toFixed(1)}, After=${afterH.toFixed(1)} (${afterLines} lines) => Total Art 5 = ${art5TotalH.toFixed(1)}mm`);

// 2. Article 6 (綠化)
const art6 = COMPLETE_ZONING_DATA.rightColumnArticles[2];
const art6Indented = art6.content
  .split('\n')
  .map(line => {
    const t = line.trim();
    if (/^[0-9]+\./.test(t)) return '    ' + t;
    if (/^（[0-9]+）/.test(t)) return '        ' + t;
    return t;
  })
  .join('\n');
const art6Lines = wrapFormattedText(art6Indented, 52.5).split('\n').length;
const art6H = art6Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 6 (綠化): ${art6H.toFixed(1)}mm (${art6Lines} lines)`);

// 3. Article 7 (都設審議)
const art7 = COMPLETE_ZONING_DATA.rightColumnArticles[3];
const art7Lines = wrapFormattedText(art7.content, 52.5).split('\n').length;
const art7H = art7Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 7 (都設): ${art7H.toFixed(1)}mm (${art7Lines} lines)`);

// 4. Article 8 (公益獎勵)
const art8 = COMPLETE_ZONING_DATA.rightColumnArticles[4];
const art8Lines = wrapFormattedText(art8.content, 52.5).split('\n').length;
const art8H = art8Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 8 (公益): ${art8H.toFixed(1)}mm (${art8Lines} lines)`);

// 5. Article 9 (捐路容獎)
const art9 = COMPLETE_ZONING_DATA.rightColumnArticles[5];
const art9Lines = wrapFormattedText(art9.content, 52.5).split('\n').length;
const art9H = art9Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 9 (捐路): ${art9H.toFixed(1)}mm (${art9Lines} lines)`);

// 6. Article 10 (容積移轉)
const art10 = COMPLETE_ZONING_DATA.rightColumnArticles[6];
const art10Lines = wrapFormattedText(art10.content, 52.5).split('\n').length;
const art10H = art10Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 10 (容移): ${art10H.toFixed(1)}mm (${art10Lines} lines)`);

// 7. Article 11 (其他未定)
const art11 = COMPLETE_ZONING_DATA.rightColumnArticles[7];
const art11Lines = wrapFormattedText(art11.content, 52.5).split('\n').length;
const art11H = art11Lines * FONT_3MM_PITCH + 8.0;
console.log(`Art 11 (其他): ${art11H.toFixed(1)}mm (${art11Lines} lines)`);

console.log('\n--- Page 2 Left Column Capacity (Available: 503.2mm) ---');
console.log(`Art 5 (${art5TotalH.toFixed(1)}) + Art 6 (${art6H.toFixed(1)}) = ${(art5TotalH + art6H).toFixed(1)}mm`);
console.log(`+ Art 7 (${art7H.toFixed(1)}) = ${(art5TotalH + art6H + art7H).toFixed(1)}mm`);
console.log(`+ Art 8 (${art8H.toFixed(1)}) = ${(art5TotalH + art6H + art7H + art8H).toFixed(1)}mm`);
