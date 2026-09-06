---
name: auto-area-boundary
description: 在面積平面圖 (Area Plan) 中自動抓取牆體中心線建立區域邊界線並放置區域面積。支援 5cm 庫板與無塵室隔間白名單，自動壓平與微小間隙縫合閉合，並無縫銜接 Revit 原生手動編修。觸發條件：抓牆心、區域面積、區域邊界線、area boundary、自動建立面積、庫板隔間面積、樓地板面積放樣、建立區域範圍。
---

# 自動抓牆心建立區域邊界線與面積系統 (Auto Area Boundary SOP)

本工作流程定義在 Revit **面積平面圖 (Area Plan)** 中，自動採集牆體中心線、執行幾何壓平、平行線聚類去重與端點縫合，一鍵批次建立原生粉紅色「區域邊界線 (Area Boundary Lines)」，並自動探測封閉空間中心點放置「區域面積 (Area)」標籤之最高標準規範。

---

## 🔍 Step 0：視圖型別與面積方案前置檢核 (Preflight Check - 必做)

> [!IMPORTANT]
> **區域邊界線（OST_AreaSchemeLines）與面積物件（Area）只能生存在「面積平面圖 (Area Plan)」中！**
> 嚴禁在一般樓層平面（Floor Plan）或天花板平面建立，否則 Revit API 會拋出錯誤。

1. **確認目標視圖**：
   - 呼叫 `get_element_info({ elementId: viewId })` 或 `get_active_view()`。
   - 確認 `ViewType == "AreaPlan"`（在專案瀏覽器通常位於「面積平面圖」或「建地平面圖」）。
2. **面積方案 (Area Scheme) 匹配**：
   - 查詢專案現有面積方案（如：`樓地板面積`、`總建築佔地面積`、`開挖面積`、`防火區劃`）。
   - 若使用者檢討容積樓地板面積，確保當前視圖綁定的是**「樓地板面積」**方案，後續放樣之面積才能即時連動至「P樓地板面積檢討」明細表。
3. **視圖樣板律定（View Template Enforcement - 必做）**：
   - 本功能處理之所有面積平面圖，**視圖樣板一律律定為「計入容積」**。
   - 工具執行時會自動搜尋並將視圖的 `ViewTemplateId` 指定為「計入容積」，確保各樓層線重、過濾器、面積線與標籤顯示樣式百分之百統一。

---

## 🧱 1. 牆體過濾與 5cm 庫板/隔間相容策略 (Wall Filter & Sandwich Panels)

針對不同專案型態，系統提供動態厚度與白名單過濾：

| 專案類型 | 最小厚度閾值 (`minThicknessMm`) | 庫板白名單 (`includePanels`) | 說明 |
| :--- | :---: | :---: | :--- |
| **廠房／無塵室／物流中心／隔間改造案** | **$45\text{ mm}$** | `true` | 完整納入 **$5\text{cm}$（50mm）庫板牆**，排除 $10\sim20\text{mm}$ 磁磚粉刷層 |
| **標準純 RC 住宅／商辦大樓案** | **$140\text{ mm}$** | `false` | 鎖定 $15\text{cm}$ 以上主結構牆，排除 $12\text{cm}$ 管道包板與矮牆 |

### 幾何輕量化演算法原則（移植自 Dynamo 輕量化技術）
1. **Z 軸壓平 (Flatten to Z)**：將所有牆心直線強制投影至目標視圖基準高程，避免產生斜線或未在工作平面之邊界線。
2. **平行線合併 (Merge Tolerance)**：法向量夾角 $< 0.5^\circ$ 且距離 $< 2.5\text{ mm}$ 之平行線段，自動投影合併為單一長線。
3. **間隙縫合 (Snap Gap Tolerance)**：端點間隙 $< 5.0\text{ mm}$（$0.5\text{ cm}$）自動吸附閉合，徹底解決微小斷差導致「面積未完全封閉」之問題。

---

## ⚡ 2. 標準執行工作流 (Standard Execution Workflow)

### 步驟 1：批次建立區域邊界線 (`generate_area_boundaries`)
依據**建築技術規則建築設計施工編第 1 條第 3 款及第 162 條**規定：陽台無外牆者，**以其樓板外緣為界**。
開啟 `snapToSlabEdge: true`（預設開啟）時，系統會自動在欄杆外側 50cm 範圍內尋找平行的樓板頂面邊緣線，自動將邊界由欄杆中心線**向外吸附替換為外緣樓板線**！

```javascript
const resBoundaries = await client.sendCommand('generate_area_boundaries', {
  viewId: targetAreaPlanViewId,
  minThicknessMm: 45,       // 容納 5cm 庫板
  includePanels: true,      // 開啟庫板/Panel白名單
  includeRailings: true,    // 開啟陽台/露台欄杆放樣路徑
  snapToSlabEdge: true,     // 依建築技術規則，陽台以樓板外緣線代替欄杆中心線（預設 true）
  viewTemplate: '計入容積', // 視圖樣板律定為「計入容積」
  clearExisting: false,     // 若需重新放樣可設為 true 清除舊線
  mergeToleranceMm: 2.5,
  snapGapToleranceMm: 5.0
});
console.log(`成功建立 ${resBoundaries.data.CreatedBoundaryLinesCount} 條區域邊界線 (含 ${resBoundaries.data.RailingCurvesExtracted} 段樓板外緣/欄杆邊界)`);
```

### 步驟 2：自動放置區域面積 (`place_areas_in_view` - 支援方法 B 純幾何拓撲)
系統預設啟動 **方法 B（純幾何拓撲自動掃描）**，自動將視圖內所有的 `AreaBoundaryLine` 進行 2D 相交分割並建構半邊圖，遍歷所有最小封閉面提取幾何質心。
- **100% 不依賴既有 Room**：陽台、走廊、管道間、露台、TRFL 頂樓即使模型未建 Room 也能全數覆蓋。
- **房間名稱自動繼承**：若空間內部座落既有 Room（即使 Room.Area 為 0 未閉合），自動以該房間名稱（如「廁所」）命名。
- **Revit 原生 AreaTag 標籤產出**：自動建立標籤、去除引線（`HasLeader = false`），並自動置中於空間正中心（`TagHeadPosition`）。
- **防重複與自動清理**：已存在有效 Area 的空間自動略過；未閉合區域（Area <= 0）自動銷毀，絕不殘留無效圖元。

```javascript
const resAreas = await client.sendCommand('place_areas_in_view', {
  viewId: targetAreaPlanViewId,
  useTopology: true,        // 開啟純幾何拓撲掃描（方法 B，預設 true）
  clearExisting: true,      // 徹底重做時設為 true
  defaultName: '居室',
  defaultUsage: '宿舍',
  countInGross: true,       // 勾選 C計入面積
  countInFloorArea: true,   // 勾選 C計入容積
  viewTemplate: '計入容積'  // 強制律定視圖樣板
});
```

---

## 🛠️ 相關 MCP 工具清單

- `generate_area_boundaries`：在面積平面中抓牆心、合併去重並建立區域邊界線（支援樓板外緣吸附與庫板白名單）。
- `place_areas_in_view`：在面積平面中自動或依座標放置 Area 物件與原生 AreaTag 標籤。
- `center_area_tags`：將面積平面圖中的所有區域標籤去除引線並置中於空間幾何中心。
- `get_active_view`：確認當前視圖型別是否為 AreaPlan。
- `read_schedule`：讀取「P樓地板面積檢討」驗證面積資料庫連動成果。
