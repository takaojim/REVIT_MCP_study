function wrapFormattedText(text, maxWeight = 52.5) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      wrappedLines.push('');
      continue;
    }

    const trimmed = para.trim();
    let indentSpaces = '';
    const matchIndent = para.match(/^(\s+)/);
    if (matchIndent) {
      indentSpaces = matchIndent[1];
    }

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

const art3PartBText = `（二）電信專用區之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至5款規定辦理。
（三）自行車專用道用地僅供人行、自行車通行。但經本府主管機關審查後得作為自行車休憩、租賃及小型飲食店（樓地板面積300㎡以下）之使用。
（四）園道用地（得兼供自行車專用道及其附屬設施使用）除兼供自行車專用道之附屬設施使用部分外之路段，不得指定建築線。
（五）潭-細公（兒）3用地不得依「都市計畫公共設施用地多目標使用辦法」作多目標使用。
（六）潭-停3、潭-細公（兒）6用地公共設施用地多目標使用限非營利性公共設施使用。
（七）第三類型郵政專用區為促進郵政事業之發展而劃定（建蔽率不得大於50％，容積率不得大於240％），得為下列之使用：
    1.經營郵政事業所需設施及郵政必要附屬設施。
    2.一般商業設施：包括金融保險業、一般批發業、一般零售業、運動服務業、餐飲業、一般商業辦公大樓之商業使用。
    作前項第二款使用時，以都市計畫書載明得為該等使用者為限，其使用之樓地板面積，不得超過該郵政專用區容積總樓地板面積二分之一使用限制。
（八）電信用地之土地使用項目悉依「都市計畫法臺中市施行自治條例」第41條第1項第1至4款規定辦理。`;

const wrapped = wrapFormattedText(art3PartBText, 52.5);
const lines = wrapped.split('\n');
console.log(`Total wrapped lines: ${lines.length}`);
lines.forEach((l, idx) => console.log(`${idx + 1}: ${l}`));
