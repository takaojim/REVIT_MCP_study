import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.2; // mm
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;
const TOTAL_AVAIL_H = BOX_TOP_Y - BOX_BOTTOM_Y - 17.5; // minus title (10) & header (7.5) = 503.17 mm

console.log('Total available content height per column:', TOTAL_AVAIL_H.toFixed(2), 'mm');

function wrapChineseText(text, maxWeight = 58.0) {
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

// Calculate Item 1 height
const item1 = COMPLETE_ZONING_DATA.leftColumnArticles[0];
const item1Wrapped = wrapChineseText(item1.content, 58.0);
const item1Lines = item1Wrapped.split('\n').length;
const item1Height = item1Lines * FONT_3MM_PITCH + 6.0;
console.log('Item 1 height:', item1Height.toFixed(2), 'mm (lines:', item1Lines, ')');

// Calculate Item 2 height (Table 1 + Table 2)
const item2 = COMPLETE_ZONING_DATA.leftColumnArticles[1];
const t1 = item2.table1;
let t1Height = (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0); // intro + header
for (const row of t1.rows) {
  const wrapped = wrapChineseText(row[3], 26.0);
  const lines = wrapped.split('\n').length;
  t1Height += lines * FONT_3MM_PITCH + 1.8;
}
const t2 = item2.table2;
let t2Height = 3.5 + (FONT_3MM_PITCH + 2.0) + (FONT_3MM_PITCH + 1.0); // space + intro + header
for (const row of t2.rows) {
  const wrapped = wrapChineseText(row[3], 26.0);
  const lines = wrapped.split('\n').length;
  t2Height += lines * FONT_3MM_PITCH + 1.8;
}
const item2Height = t1Height + t2Height + 6.0;
console.log('Item 2 height:', item2Height.toFixed(2), 'mm (t1:', t1Height.toFixed(2), ', t2:', t2Height.toFixed(2), ')');

const usedInLeft = item1Height + item2Height;
const leftRemaining = TOTAL_AVAIL_H - usedInLeft;
console.log('Left Column remaining height:', leftRemaining.toFixed(2), 'mm');

// Inspect Item 3 paragraphs
const item3 = COMPLETE_ZONING_DATA.leftColumnArticles[2];
const item3Paras = item3.content.split('\n');
console.log('\n--- Item 3 Paragraphs ---');
let item3TotalH = 0;
item3Paras.forEach((p, idx) => {
  const w = wrapChineseText(p, 58.0);
  const l = w.split('\n').length;
  const h = l * FONT_3MM_PITCH;
  item3TotalH += h;
  console.log(`P${idx+1}: [${l} lines, ${h.toFixed(1)}mm] ${p.substring(0, 30)}...`);
});
console.log('Item 3 total raw text height:', item3TotalH.toFixed(2), 'mm');
