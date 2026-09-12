---
name: standard-plan-dimension
description: 標準平面階梯標註與軸線整列系統：全自動讀取視圖比例與全區外框包絡（含外牆/結構柱/陽台/雨遮），統一將軸線四向齊頭延伸（配置 A：上側與右側開啟軸號圓圈），並自動建立上右雙層柱心尺寸、四向三層牆心標註（外牆總長/居室主隔間/走廊機能空間）、15CM主牆過濾與中庭內凹方案C標準工作流。觸發條件：標準標註、平面出圖標註、軸線整列、標準柱心標註、牆心標註、40mm基準標註、standard plan dimension、平面全自動標註。
---

# 標準平面階梯標註與軸線整列系統 (Standard Plan Dimension SOP)

本工作流程定義 Revit 建築平面視圖出圖的**最高幾何放樣標準與空間拓撲標註體系**。透過「**全區實體最大包絡線 (Global Physical Envelope)**」與「**等距階梯模矩 (Step Modules)**」，實現軸線齊頭對稱、雙層柱心標註、四向多層牆心標註、自適應牆厚分流與中庭內凹區方案 C 的標準化出圖。

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。詳見 `domain/lessons.md`。
- **L-031**：建築模型圖元查詢原則，`query_elements` 預設上限為 10,000 筆。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。
- **L-038**：平面與立面尺寸標註多尺度自適應模矩換算體系 (Scale-Aware Formula) 與牆心正交量測原則。詳見 `domain/lessons.md`。

---

## 🔍 Step 0：標註型式前置動態查詢與防呆機制 (Preflight DimensionType Check - 必做)

執行任何柱心或外牆標註前，**絕對嚴禁在程式碼中寫死 (Hardcode) 任何靜態 TypeId**！
1. 先呼叫 `query_elements({ category: "DimensionTypes" })` 查詢專案現有標註型式。
2. 優先匹配包含 `柱心-上右`（北/東）與 `柱心-下右`（南/西）或 `TABC-DIM_*` 型式。
3. 若專案未載入 TABC 樣板，模糊匹配 `柱心`、`對齊` (Aligned)、`Linear` 等線性型式，或安全降級使用既有型式並提示警告。

---

## 📐 1. 核心階梯模矩與通用插槽體系 (Unified Ladder Hierarchy)

所有尺寸放樣一律以「**全區實體最大包絡線（Global Physical Envelope）**」為基準線（Step 0），並依出圖比例動態自適應（**Scale-Aware**）：
- **標準圖紙模矩**：紙上固定為 **$6.5\text{ mm}$**。
- **模型空間模矩長度公式**：
  $$\text{stepMm} = 6.5\text{ mm} \times \text{view.Scale} = 650.0\text{ mm} \times \left(\frac{\text{view.Scale}}{100}\right)$$
  - **1:100 比例**：$\text{stepMm} = 6.5 \times 100 = \mathbf{650.0\text{ mm}}$（7 間距藍線 $= +4,550\text{ mm}$）
  - **1:50 比例**：$\text{stepMm} = 6.5 \times 50 = \mathbf{325.0\text{ mm}}$（7 間距藍線 $= +2,275\text{ mm}$）
  - **1:200 比例**：$\text{stepMm} = 6.5 \times 200 = \mathbf{1,300.0\text{ mm}}$（7 間距藍線 $= +9,100\text{ mm}$）

> [!IMPORTANT]
> **視覺與幾何間距核心原則 (Scale-Aware)**：
> 1. **氣泡圓圈與藍線**：齊頭藍線（Step N）即為軸號氣泡圓圈之**下緣基準線**（$\text{GlobalEnv} + N \times \text{stepMm}$）。藍線至第一條柱心總跨尺寸線（Step N-1）相距 1 個動態模矩（$\text{stepMm}$），在視覺上即為標準的「空一格留白」，絕不需額外插入重複空格！
> 2. **【結構與隔間強制空一個間隔（留白隔離帶）】**：柱心標註區最內層與牆心標註區最外層之間，**必須嚴格保留整整 1 個動態模矩（$\text{stepMm}$）作為空隔**！該層絕對嚴禁放置任何尺寸線，使虛擬結構軸心與實體建築隔間徹底視覺分流。
> 3. **【牆心第 1 層（靠近間隔處）強制為最外層牆心總長】**：緊鄰留白隔離帶的牆心標註第一層，**強制為單一全跨總長（`isTotalOnly: true`）**！僅取該向最外兩端之外牆中心線，產出單一全跨數值，**嚴禁產生中間個別牆段分段**。
> 4. **外牆留白緩衝帶**：最內層牆心尺寸線與實體外牆紅線（Step 0）之間，固定保留 1 個模矩作為緩衝留白，避免尺寸線貼在窗框或牆皮上。

---

### 📊 三大標準出圖模式階梯插槽速查表 (5 / 7 / 9 間距)

| 階梯層級 | 5 間距 (結構平面模式) | 7 間距 (標準/精簡建築模式 - 推薦) | 9 間距 (超完整建築模式 - 3層牆心) |
| :---: | :--- | :--- | :--- |
| **Step 9** | ─ | ─ | 🔵 **氣泡齊頭線 (藍線, +9 step)** |
| **Step 8** | ─ | ─ | 📏 柱心 Tier 1 總跨 (+8 step) |
| **Step 7** | ─ | 🔵 **氣泡齊頭線 (藍線, +7 step)** | 📏 柱心 Tier 2 連續 (+7 step) |
| **Step 6** | ─ | 📏 柱心 Tier 1 總跨 (+6 step) | ⬜ **【留白隔離帶（空一間隔, +6 step）】** |
| **Step 5** | 🔵 **氣泡齊頭線 (藍線, +5 step)** | 📏 柱心 Tier 2 連續 (+5 step) | 🧱 **牆心 Layer 1 最外層總長 (+5 step)** |
| **Step 4** | 📏 柱心 Tier 1 總跨 (+4 step) | ⬜ **【留白隔離帶（空一間隔, +4 step）】** | 🧱 牆心 Layer 2 居室主隔間 (+4 step) |
| **Step 3** | 📏 柱心 Tier 2 連續 (+3 step) | 🧱 **牆心 Layer 1 最外層總長 (+3 step)** | 🧱 牆心 Layer 3 走廊/細部隔間 (+3 step) |
| **Step 2** | ⬜ 留白緩衝帶 (+2 step) | 🧱 牆心 Layer 2 居室主隔間/12cm (+2 step) | ⬜ 留白緩衝帶 (+2 step) |
| **Step 1** | ⬜ 留白緩衝帶 (+1 step) | 🧱 牆心 Layer 3 5cm庫版/細部 (或留白, +1 step) | ⬜ 留白緩衝帶 (+1 step) |
| **Step 0** | 🔴 **全區實體外牆紅線 (0mm)** | 🔴 **全區實體外牆紅線 (0mm)** | 🔴 **全區實體外牆紅線 (0mm)** |

---

## 🧭 2. 四向排布與同心鏡射規範 (Configuration A & Mirroring)

### (1) 軸號氣泡 (Grid Bubble) 配置
* **上方 (North) & 右側 (East)**：開啟氣泡圓標，承載最外側雙層柱心標註。
* **下方 (South) & 左側 (West)**：隱藏氣泡圓標，僅保留牆心階梯標註，消除半空懸掛感。

### (2) 7 間距四向標註規格明細表 (標準配置)

| 方向 / 側邊 | 柱心總跨 (Step 6) | 柱心分段 (Step 5) | 空一個間隔 (Step 4) | 牆心第 1 層 (Step 3) | 牆心第 2 層 (Step 2) | 牆心第 3 層 (Step 1) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **上方 (North)** | ⭕ Grids 4-1 總跨 | ⭕ Grids 4-3-2-1 | ⬜ **完全無尺寸線** | 🧱 **北外牆心總長 (`isTotalOnly`)** | 居室主隔間/12cm輕隔間 | 5cm庫版/走廊細部(或留白) |
| **右側 (East)** | ⭕ Grids D-A 總跨 | ⭕ Grids D-C-B-A | ⬜ **完全無尺寸線** | 🧱 **東外牆心總長 (`isTotalOnly`)** | 東翼主隔間/12cm輕隔間 | 5cm庫版/走廊細部(或留白) |
| **下方 (South)** | ❌ 無 (留空) | ❌ 無 (留空) | ─ | 🧱 **南外牆心總長 (`isTotalOnly`)** | 南翼主隔間/12cm輕隔間 | 5cm庫版/走廊細部(或留白) |
| **左側 (West)** | ❌ 無 (留空) | ❌ 無 (留空) | ─ | 🧱 **西外牆心總長 (`isTotalOnly`)** | 西側主隔間/12cm輕隔間 | 5cm庫版/梯間細部(或留白) |

---

## 🔍 3. 牆體厚度自適應分流矩陣與演算法

### (1) 三層自適應厚度分流矩陣 (Wall Thickness Matrix)
* **Layer 1 (最外層牆心總長)**：
  * **涵蓋圖元**：最外側之 15cm/17cm/20cm 外牆、烤漆鋼板外牆、女兒牆。
  * **演算法**：**`isTotalOnly: true`**。排序並去重後，**僅取最外兩端之 2 道牆心中心線**，強制產出單一全跨標註。
* **Layer 2 (居室主要隔間)**：
  * **涵蓋圖元**：15cm 主隔間牆、12cm 輕隔間牆、女兒牆。
  * **過濾條件**：`110mm <= Thickness <= 170mm`。
* **Layer 3 (細部機能隔間)**：
  * **涵蓋圖元**：5cm 庫版、管道間隔板、浴廁細部隔間。
  * **過濾條件**：`Thickness <= 60mm` 或名稱含 `庫版`、`5cm`。

### (2) 外牆心總長標準演算法範本 (Code Reference)
```javascript
// 牆心標註建立時的單一全跨總長處理
let targetWalls = uniqueSortedWalls;
if (isTotalOnly) {
  // 強制僅保留最外兩側牆心，嚴禁中間跳點
  targetWalls = [uniqueSortedWalls[0], uniqueSortedWalls[uniqueSortedWalls.length - 1]];
}
```

---

## 🧹 4. 視圖範圍探索與輔助線生命週期治理

1. **同體系全視圖探索 (View Discovery)**：
   - 執行出圖標註時，必須主動查詢該出圖比例下的**所有相關平面視圖**（含主要規劃圖、各樓層圖，以及**二次規劃圖 `-二次`、夾層圖**），嚴格避免遺漏衍生圖紙。
2. **放樣驗證輔助線生命週期 (Helper Lines Lifecycle)**：
   - **Step 0 實體外牆紅線（`#FF0000`）** 與 **Step 7 齊頭藍線（`#0064FF`）** 僅供開發與幾何校驗使用。
   - **正式交付前**：必須執行輔助線清理作業（刪除 Lines / DetailLines），還原正式、乾淨之出圖圖面，嚴禁輔助線殘留於交付成果中。

---

## 🎨 5. 標註型式 (Dimension Type) 標準對照

| 標註類別 | 端點標記 (Tick Mark) | 專屬標註型式名稱 | 說明 |
| :--- | :---: | :--- | :--- |
| **柱心尺寸** | 斜線 (Slash) | `TABC-DIM_*/ S 2.5-柱心-上右` | 虛擬結構軸網基準 |
| **牆心尺寸** | 實心圓點 (Dot) | `TABC-DIM_dot 牆心` (ID: `708965` / `2251126`) | 實體建築牆心基準 |

---

## 💻 6. 標準批次執行成熟腳本 (Production Scripts)

專案已收編成熟的批次執行與清理腳本：

### (1) 全 12 視圖（含二次與夾層）7 間距標準出圖標註
* **腳本路徑**：[`scripts/execute_all_12_plan50_views_gap_7steps.mjs`](file:///c:/Users/User/Documents/REVIT_MCP_study/scripts/execute_all_12_plan50_views_gap_7steps.mjs)
* **特徵**：全自動處理 12 個 1/50 視圖、Step 4 留空一個間隔、Step 3 最外層牆心總長、涵蓋 5cm 庫版/12cm 輕隔間/15cm 主牆/女兒牆。

### (2) 全視圖放樣輔助線一鍵清理腳本
* **腳本路徑**：[`scripts/delete_helper_lines_12_views.mjs`](file:///c:/Users/User/Documents/REVIT_MCP_study/scripts/delete_helper_lines_12_views.mjs)
* **特徵**：一鍵乾淨清除所有平面視圖中的紅藍輔助線。
