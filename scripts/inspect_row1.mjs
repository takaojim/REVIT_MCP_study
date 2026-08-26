import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

function wrapFormattedText(text, maxWeight = 30.0) {
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

const row1 = COMPLETE_ZONING_DATA.leftColumnArticles[1].table1.rows[0];
console.log('Row 1 raw:', JSON.stringify(row1[3]));
const wrapped = wrapFormattedText(row1[3], 30.0);
console.log('Row 1 wrapped (30.0):');
console.log(wrapped);
console.log('Lines:', wrapped.split('\n').length);

const wrapped26 = wrapFormattedText(row1[3], 26.5);
console.log('\nRow 1 wrapped (26.5):');
console.log(wrapped26);
console.log('Lines:', wrapped26.split('\n').length);
