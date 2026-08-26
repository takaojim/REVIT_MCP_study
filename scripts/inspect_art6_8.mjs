import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

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

// Check Art 6
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
const art6Wrapped = wrapFormattedText(art6Indented, 52.5);
console.log('--- Art 6 Wrapped ---');
console.log(art6Wrapped);
console.log('Lines:', art6Wrapped.split('\n').length);

// Check Art 8
const art8 = COMPLETE_ZONING_DATA.rightColumnArticles[4];
const art8Indented = art8.content
  .split('\n')
  .map(line => {
    const t = line.trim();
    if (/^[0-9]+\./.test(t)) return '    ' + t;
    if (/^（[0-9]+）/.test(t)) return '        ' + t;
    return t;
  })
  .join('\n');
const art8Wrapped = wrapFormattedText(art8Indented, 52.5);
console.log('\n--- Art 8 Wrapped ---');
console.log(art8Wrapped);
console.log('Lines:', art8Wrapped.split('\n').length);
