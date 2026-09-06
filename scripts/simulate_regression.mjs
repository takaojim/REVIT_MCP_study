import { WUFENG_ARTICLES_LEFT, WUFENG_ARTICLES_RIGHT } from './render_wufeng_zoning_legend.mjs';
import { COMPLETE_ZONING_DATA } from './execute_perfect_template_zoning.mjs';
import {
  LINE_PITCH,
  CLAUSE_WRAP_WEIGHT,
  CLAUSE_PAD_TOP,
  CLAUSE_PAD_BOTTOM,
  wrapClauseText,
  renderDynamicTable
} from './zoning_dynamic_table_engine.mjs';

function simulateWufengRegression() {
  console.log('=== 【霧峰專案回歸測試 (Wufeng Regression Test)】 ===');
  const maxAvailableH = 500.67; // mm

  // 左欄 (第1條 ~ 第12條)
  let leftH = 0;
  for (const art of WUFENG_ARTICLES_LEFT) {
    if (art.isSpecialTable) {
      const introWrapped = wrapClauseText(art.intro, CLAUSE_WRAP_WEIGHT);
      const introLines = introWrapped.split('\n').length;
      leftH += (CLAUSE_PAD_TOP + introLines * LINE_PITCH + 1.5);
      
      const tbl = art.table;
      const res = renderDynamicTable({
        startX: 3000,
        startY: 3400,
        colWidths: tbl.colWidths,
        headers: tbl.headers,
        rows: tbl.rows
      });
      leftH += (res.totalHeight + 1.5 + CLAUSE_PAD_BOTTOM);
    } else {
      const wrapped = wrapClauseText(art.content, CLAUSE_WRAP_WEIGHT);
      const lineCount = wrapped.split('\n').length;
      leftH += (CLAUSE_PAD_TOP + lineCount * LINE_PITCH + CLAUSE_PAD_BOTTOM);
    }
  }

  // 右欄 (第13條 ~ 第18條)
  let rightH = 0;
  for (const art of WUFENG_ARTICLES_RIGHT) {
    const wrapped = wrapClauseText(art.content, CLAUSE_WRAP_WEIGHT);
    const lineCount = wrapped.split('\n').length;
    rightH += (CLAUSE_PAD_TOP + lineCount * LINE_PITCH + CLAUSE_PAD_BOTTOM);
  }

  console.log(`霧峰左欄高度: ${leftH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (留白: ${(maxAvailableH - leftH).toFixed(2)} mm) -> 狀態: ${leftH < maxAvailableH ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`霧峰右欄高度: ${rightH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (留白: ${(maxAvailableH - rightH).toFixed(2)} mm) -> 狀態: ${rightH < maxAvailableH ? 'PASS ✅' : 'FAIL ❌'}\n`);
}

function simulateTanziRegression() {
  console.log('=== 【潭子東寶專案回歸測試 (Tanzi Dongbao Regression Test)】 ===');
  const maxAvailableH = 500.67;

  // 潭子左欄
  let leftH = 0;
  for (const art of COMPLETE_ZONING_DATA.leftColumnArticles) {
    if (art.isIntensityTable) {
      const introWrapped = wrapClauseText(art.intro1, CLAUSE_WRAP_WEIGHT);
      leftH += (CLAUSE_PAD_TOP + introWrapped.split('\n').length * LINE_PITCH + 1.5);
      const res = renderDynamicTable({
        startX: 3000,
        startY: 3400,
        colWidths: art.table1.colWidths,
        headers: art.table1.headers,
        rows: art.table1.rows
      });
      leftH += (res.totalHeight + 1.5 + CLAUSE_PAD_BOTTOM);
    } else {
      const wrapped = wrapClauseText(art.content || '', CLAUSE_WRAP_WEIGHT);
      const lineCount = wrapped.split('\n').length;
      leftH += (CLAUSE_PAD_TOP + lineCount * LINE_PITCH + CLAUSE_PAD_BOTTOM);
    }
  }

  // 潭子右欄
  let rightH = 0;
  for (const art of COMPLETE_ZONING_DATA.rightColumnArticles) {
    const wrapped = wrapClauseText(art.content || '', CLAUSE_WRAP_WEIGHT);
    const lineCount = wrapped.split('\n').length;
    rightH += (CLAUSE_PAD_TOP + lineCount * LINE_PITCH + CLAUSE_PAD_BOTTOM);
  }

  console.log(`潭子左欄高度: ${leftH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (留白: ${(maxAvailableH - leftH).toFixed(2)} mm) -> 狀態: ${leftH < maxAvailableH ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`潭子右欄高度: ${rightH.toFixed(2)} mm / ${maxAvailableH.toFixed(2)} mm (留白: ${(maxAvailableH - rightH).toFixed(2)} mm) -> 狀態: ${rightH < maxAvailableH ? 'PASS ✅' : 'FAIL ❌'}\n`);
}

simulateWufengRegression();
simulateTanziRegression();
