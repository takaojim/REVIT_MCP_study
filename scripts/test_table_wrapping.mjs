import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const FONT_3MM_PITCH = 5.2;
const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;

function wrapChineseText(text, maxWeight = 48.0) {
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

    let subIndent = indentSpaces;
    if (/^\s*[1-9]\./.test(para)) {
      subIndent = indentSpaces + '    ';
    } else if (/^\s*（[0-9]）/.test(para) || /^\s*\([0-9]\)/.test(para)) {
      subIndent = indentSpaces + '        ';
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

// 1. Calculate Table 1 with Item wrapping (col width 52mm -> wrap at 13.5)
const t1 = COMPLETE_ZONING_DATA.leftColumnArticles[1].table1;
let t1Height = 0;
console.log('--- Table 1 Rows ---');
t1.rows.forEach((r, idx) => {
  const w0 = wrapChineseText(r[0], 13.5);
  const w3 = wrapChineseText(r[3], 24.0);
  const l0 = w0.split('\n').length;
  const l3 = w3.split('\n').length;
  const maxL = Math.max(l0, l3);
  const rowH = maxL * FONT_3MM_PITCH + 2.0;
  t1Height += rowH;
  if (l0 > 1 || l3 > 1) {
    console.log(`Row ${idx+1} [${r[0]}]: l0=${l0}, l3=${l3}, rowH=${rowH.toFixed(1)}mm`);
  }
});
console.log('Total Table 1 height:', t1Height.toFixed(2), 'mm');

// 2. Calculate Table 2 with Item wrapping (col width 52mm -> wrap at 13.5)
const t2 = COMPLETE_ZONING_DATA.leftColumnArticles[1].table2;
let t2Height = 0;
console.log('\n--- Table 2 Rows ---');
t2.rows.forEach((r, idx) => {
  const w0 = wrapChineseText(r[0], 13.5);
  const w3 = wrapChineseText(r[3], 24.0);
  const l0 = w0.split('\n').length;
  const l3 = w3.split('\n').length;
  const maxL = Math.max(l0, l3);
  const rowH = maxL * FONT_3MM_PITCH + 2.0;
  t2Height += rowH;
  if (l0 > 1 || l3 > 1) {
    console.log(`Row ${idx+1} [${r[0]}]: l0=${l0}, l3=${l3}, rowH=${rowH.toFixed(1)}mm`);
  }
});
console.log('Total Table 2 height:', t2Height.toFixed(2), 'mm');
