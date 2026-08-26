import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';

const BOX_TOP_Y = 3494.25;
const BOX_BOTTOM_Y = 2973.58;
const START_CONTENT_Y = BOX_TOP_Y - 17.5; // 3476.75
const AVAIL_H = START_CONTENT_Y - BOX_BOTTOM_Y; // 503.17 mm

console.log('Available height per column:', AVAIL_H.toFixed(2), 'mm');

// Test Page 2 Right column proportional distribution
const rows = [
  { artIndex: 3, num: '七、', weight: 1.0, baseH: 55.0 },
  { artIndex: 4, num: '八、', weight: 2.5, baseH: 165.0 },
  { artIndex: 5, num: '九、', weight: 2.0, baseH: 135.0 },
  { artIndex: 6, num: '十、', weight: 1.0, baseH: 70.0 },
  { artIndex: 7, num: '十一、', weight: 1.1, baseH: 78.17 }
];

let curY = START_CONTENT_Y;
rows.forEach((r, idx) => {
  const topY = curY;
  const bottomY = idx === rows.length - 1 ? BOX_BOTTOM_Y : curY - r.baseH;
  const h = topY - bottomY;
  console.log(`Row ${idx+1} [${r.num}]: topY=${topY.toFixed(2)}, bottomY=${bottomY.toFixed(2)}, height=${h.toFixed(2)}mm`);
  curY = bottomY;
});
console.log('Final bottom Y:', curY.toFixed(2), 'vs BOX_BOTTOM_Y:', BOX_BOTTOM_Y);
