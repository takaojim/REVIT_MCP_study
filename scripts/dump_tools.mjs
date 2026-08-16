import { registerRevitTools } from '../MCP-Server/build/tools/index.js';
import { baseTools } from '../MCP-Server/build/tools/base-tools.js';
import { wallTools } from '../MCP-Server/build/tools/wall-tools.js';
import { roomTools } from '../MCP-Server/build/tools/room-tools.js';
import { corridorAnalysisTools } from '../MCP-Server/build/tools/corridor-analysis-tools.js';
import { visualizationTools } from '../MCP-Server/build/tools/visualization-tools.js';
import { scheduleTools } from '../MCP-Server/build/tools/schedule-tools.js';
import { mepTools } from '../MCP-Server/build/tools/mep-tools.js';
import { curtainWallTools } from '../MCP-Server/build/tools/curtain-wall-tools.js';
import { smokeExhaustTools } from '../MCP-Server/build/tools/smoke-exhaust-tools.js';
import { STAIR_COMPLIANCE_TOOLS } from '../MCP-Server/build/tools/stair-compliance-tools.js';
import { sheetTools } from '../MCP-Server/build/tools/sheet-tools.js';
import { detailComponentTools } from '../MCP-Server/build/tools/detail-component-tools.js';
import { dimensionTools } from '../MCP-Server/build/tools/dimension-tools.js';
import { dependentViewTools } from '../MCP-Server/build/tools/dependent-view-tools.js';
import { clashTools } from '../MCP-Server/build/tools/clash-tools.js';
import { doorWindowLegendTools } from '../MCP-Server/build/tools/door-window-legend-tools.js';
import { listSeedsTools } from '../MCP-Server/build/tools/list-seeds-tools.js';
import { dimensionTypeTools } from '../MCP-Server/build/tools/dimension-type-tools.js';
import { legendViewTools } from '../MCP-Server/build/tools/legend-view-tools.js';
import { dwgColumnTools } from '../MCP-Server/build/tools/dwg-column-tools.js';
import { dwgBeamTools } from '../MCP-Server/build/tools/dwg-beam-tools.js';
import { cadLinkTools } from '../MCP-Server/build/tools/cad-link-tools.js';
import { structureTools } from '../MCP-Server/build/tools/structure-tools.js';
import { parallelSectionTools } from '../MCP-Server/build/tools/parallel-section-tools.js';
import { smokeDetectorTools } from '../MCP-Server/build/tools/smoke-detector-tools.js';
import { gradingTools } from '../MCP-Server/build/tools/grading-tools.js';
import { detailCopyTools } from '../MCP-Server/build/tools/detail-copy-tools.js';
import { scopeBoxTools } from '../MCP-Server/build/tools/scope-box-tools.js';
import { viewCropBoxTools } from '../MCP-Server/build/tools/view-cropbox-tools.js';
import { textNoteTools } from '../MCP-Server/build/tools/text-note-tools.js';
import { titleblockAlignTools } from '../MCP-Server/build/tools/titleblock-align-tools.js';
import { viewCreationTools } from '../MCP-Server/build/tools/view-creation-tools.js';
import { viewportPositionTools } from '../MCP-Server/build/tools/viewport-position-tools.js';
import { crossDocumentTools } from '../MCP-Server/build/tools/cross-document-tools.js';
import { legendTools } from '../MCP-Server/build/tools/legend-tools.js';
import { scaffoldTools } from '../MCP-Server/build/tools/scaffold-tools.js';
import { viewDuplicateTools } from '../MCP-Server/build/tools/view-duplicate-tools.js';
import { fillRegionTools } from '../MCP-Server/build/tools/fill-region-tools.js';
import { ifcStructuralSyncTools } from '../MCP-Server/build/tools/ifc-structural-sync-tools.js';

const list = [
  ['基礎查詢與視圖控制 (Base Tools)', baseTools],
  ['牆體分析與內外向檢核 (Wall Tools)', wallTools],
  ['房間、天花板與裝修 (Room Tools)', roomTools],
  ['走廊與避難路徑分析 (Corridor Analysis)', corridorAnalysisTools],
  ['模型上色與視覺化 (Visualization)', visualizationTools],
  ['明細表讀取與排版 (Schedule Tools)', scheduleTools],
  ['機電 MEP 與穿梁套管 (MEP Tools)', mepTools],
  ['帷幕牆與嵌板網格 (Curtain Wall)', curtainWallTools],
  ['防煙區劃與排煙檢核 (Smoke Exhaust)', smokeExhaustTools],
  ['偵煙探測器法規檢核 (Smoke Detector)', smokeDetectorTools],
  ['樓梯法規與虛線分析 (Stair Compliance)', STAIR_COMPLIANCE_TOOLS],
  ['圖紙管理與視圖排版 (Sheet Management)', sheetTools],
  ['詳圖元件與圖號同步 (Detail Components)', detailComponentTools],
  ['自動尺寸標註 (Dimensions)', dimensionTools],
  ['依附視圖與裁剪 (Dependent Views)', dependentViewTools],
  ['碰撞檢測與 MCP App (Clash Detection)', clashTools],
  ['門窗圖例與統計 (Door/Window Legend)', doorWindowLegendTools],
  ['種子與族群類別清單 (Seed/Family Lists)', listSeedsTools],
  ['尺寸標註樣式 (Dimension Types)', dimensionTypeTools],
  ['圖例視圖操作 (Legend Views)', legendViewTools],
  ['DWG 轉結構柱 (DWG Column Import)', dwgColumnTools],
  ['DWG 轉結構梁 (DWG Beam Import)', dwgBeamTools],
  ['CAD 連結管理 (CAD Link Tools)', cadLinkTools],
  ['結構開洞與接合解除 (Structure & Joins)', structureTools],
  ['平行剖面圖生成 (Parallel Sections)', parallelSectionTools],
  ['地形與整地坡度 (Grading Tools)', gradingTools],
  ['跨視圖詳圖圖元複製 (Detail Copy)', detailCopyTools],
  ['範圍框批次套用 (Scope Box Tools)', scopeBoxTools],
  ['視圖裁剪框控制 (View CropBox)', viewCropBoxTools],
  ['文字註記批次處理 (Text Note Tools)', textNoteTools],
  ['圖框與標題對齊 (Titleblock Align)', titleblockAlignTools],
  ['視圖批次建立 (View Creation)', viewCreationTools],
  ['視埠精準定位排版 (Viewport Positioning)', viewportPositionTools],
  ['跨專案圖紙與圖元複製 (Cross Document)', crossDocumentTools],
  ['Excel 表格匯入與圖例生成 (Legend Tools)', legendTools],
  ['施工架 (鷹架) 數量計算 (Scaffold Tools)', scaffoldTools],
  ['視圖批次複製 (View Duplicate)', viewDuplicateTools],
  ['填滿區域分析與繪製 (Fill Region Tools)', fillRegionTools],
  ['IFC 結構模型同步 (IFC Structural Sync)', ifcStructuralSyncTools]
];

console.log(`總計模組數: ${list.length}`);
let total = 0;
for (const [name, arr] of list) {
  total += arr.length;
  console.log(`\n### ${name} (${arr.length} 個工具)`);
  for (const t of arr) {
    const desc = (t.description || '').split('\n')[0].substring(0, 60);
    console.log(`- \`${t.name}\`: ${desc}`);
  }
}
console.log(`\n總工具數: ${total}`);
