---
name: standard-plan-dimension
description: 標準平面階梯標註與軸線整列系統：全自動讀取視圖比例與全區外框包絡（含外牆/結構柱/陽台/雨遮），統一將軸線四向齊頭延伸 40mm（配置 A：上側與右側開啟軸號圓圈），並自動建立上右雙層柱心尺寸（總尺寸距圓圈 5mm、柱間距距圓圈 10mm）與四向外牆房間牆心/開口標註標準工作流。觸發條件：標準標註、平面出圖標註、軸線整列、標準柱心標註、40mm基準標註、standard plan dimension、平面全自動標註。
---

# 標準平面階梯標註與軸線整列系統 (Standard Plan Dimension SOP)

本工作流程定義 Revit 平面視圖出圖的**最高幾何放樣標準**。透過「**全區外框包絡 (Global Bounding Envelope)**」作為統一絕對基準，實現軸線自動齊頭對稱、動態比例換算，以及多層防重疊階梯式標註。

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。詳見 `domain/lessons.md`。
- **L-031**：建築模型圖元查詢原則，`query_elements` 預設上限為 10,000 筆。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。

---

## 🔍 Step 0：標註型式前置動態查詢與防呆機制 (Preflight DimensionType Check - 必做)

執行任何柱心或外牆標註前，**絕對嚴禁在程式碼中寫死 (Hardcode) 任何靜態 TypeId**！
1. 先呼叫 `query_elements({ category: "DimensionTypes" })` 查詢專案現有標註型式。
2. 優先匹配包含 `柱心-上右`（北/東）與 `柱心-下右`（南/西）或 `TABC-DIM_*` 型式。
3. 若專案未載入 TABC 樣板，模糊匹配 `柱心`、`對齊` (Aligned)、`Linear` 等線性型式，或安全降級使用既有型式並提示警告。

---

## 📐 1. 核心放樣幾何層級 (Datum Hierarchy)

所有尺寸放樣一律以當前樓層的「**全區實體最大包絡線（Global Bounding Box）**」為基準線（基準 0），並依出圖比例 $S$（`View.Scale`，例如 1:100 時 $S=100$）進行圖紙毫米（Sheet mm）至模型公制（Model mm）的動態換算：

$$\text{模型偏移距離 (mm)} = \text{圖紙尺寸 (mm)} \times S$$

```
========================= 軸線端點 (距最外實體 40mm * S) =========================
  [○] 軸號圓圈 (上/右側顯示)
       │
       │  ← 距端點 5mm * S (距外牆 35mm * S)
       ▼
------------------------- 第 1 層：柱心總長尺寸 (Total Dimension) -------------------------
       │
       │  ← 距第 1 層 5mm * S (距外牆 30mm * S)
       ▼
------------------------- 第 2 層：各柱間距分段尺寸 (Column Spacing Dimension) ------------
       │
       │  ← 距第 2 層 5mm * S (距外牆 25mm * S)
       ▼
------------------------- 第 3 層：外牆房間牆心/開口尺寸 (Wall & Opening Dimension) --------
       │
       │
┌──────┴────────────────────────────────────────────────────────────────────────┐
│                      建物本體最大包絡外緣 (基準線 0)                            │
│           (包含所有 Exterior Walls, Columns, Floors, Roofs/Balconies)          │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧭 2. 四向排布與配置規範 (Configuration A)

### (1) 軸號圓圈 (Grid Bubble) 配置
* **上方 (North) & 右側 (East)**：開啟軸號圓圈。
* **下方 (South) & 左側 (West)**：關閉圓圈（若專案為特殊複雜四向全標註需求，可手動保留）。
* **四向齊頭長度**：四邊軸線端點**一律齊頭延伸至最外包絡線外側 40mm**，確保圖面完全對稱、預留充足出圖緩衝區。

### (2) 四向標註層級規格表

| 方向 | 軸線端點（圖紙 40mm） | 圓圈 (Bubble) | 第 1 層（距端點 5mm / 外牆 35mm） | 第 2 層（距端點 10mm / 外牆 30mm） | 第 3 層（距端點 15mm / 外牆 25mm） | 標註型式 |
| :--- | :--- | :---: | :--- | :--- | :--- | :---|
| **上方 (North)** | $Y_{\max} + 40 \times S$ | ⭕ 有 | **柱心全區總尺寸** | **各柱間距連續分段尺寸** | 外牆房間隔間與門窗開口 | `柱心-上右`（動態 ID） |
| **右側 (East)** | $X_{\max} + 40 \times S$ | ⭕ 有 | **柱心全區總尺寸** | **各柱間距連續分段尺寸** | 外牆房間隔間與門窗開口 | `柱心-上右`（動態 ID） |
| **下方 (South)** | $Y_{\min} - 40 \times S$ | ❌ 無 | **外牆房間隔間與門窗開口** | *(細部開口或備用層)* | — | `柱心-下右`（動態 ID） |
| **左側 (West)** | $X_{\min} - 40 \times S$ | ❌ 無 | **外牆房間隔間與門窗開口** | *(細部開口或備用層)* | — | `柱心-下右`（動態 ID） |

---

## 🛠️ 3. 自動化執行四步驟演算法 (Implementation Pipeline)

### 步驟 1：計算全區最大幾何包絡 (Global Bounding Envelope)
1. 查詢該視圖/樓層可視之所有構件：`Walls`, `StructuralColumns`, `Floors`, `Roofs`。
2. 計算聯集包絡框 $[X_{\min}, X_{\max}, Y_{\min}, Y_{\max}]$。

### 步驟 2：軸線 2D Datum Extent 自動齊頭與圓圈切換
1. 取得當前視圖 `viewId` 與 `view.Scale`。
2. 垂直軸線（南北向）：
   * 端點 $Y_{\text{top}} = Y_{\max} + 40 \times S$（開 Bubble End 1）
   * 端點 $Y_{\text{bottom}} = Y_{\min} - 40 \times S$（關 Bubble End 0）
3. 水平軸線（東西向）：
   * 端點 $X_{\text{right}} = X_{\max} + 40 \times S$（開 Bubble End 1）
   * 端點 $X_{\text{left}} = X_{\min} - 40 \times S$（關 Bubble End 0）

### 步驟 3：生成上方與右側「雙層柱心標註」
1. **北側第 1 層 (總尺寸)**：
   * 基準線：$Y = Y_{\max} + 35 \times S$
   * 串接軸線：最左 Grid 至 最右 Grid
2. **北側第 2 層 (柱間距)**：
   * 基準線：$Y = Y_{\max} + 30 \times S$
   * 串接軸線：所有垂直 Grid 依 X 座標連續排序串接
3. **東側第 1 層 (總尺寸)**：
   * 基準線：$X = X_{\max} + 35 \times S$
   * 串接軸線：最下 Grid 至 最上 Grid
4. **東側第 2 層 (柱間距)**：
   * 基準線：$X = X_{\max} + 30 \times S$
   * 串接軸線：所有水平 Grid 依 Y 座標連續排序串接

### 步驟 4：套用動態解析之標註型式 (Dimension Type)
* 北側與東側標註優先套用：`TABC-DIM_*/ S 2.5-柱心-上右`（動態查詢）
* 南側與西側標註優先套用：`TABC-DIM_*/ S 2.5-柱心-下右`（動態查詢）

---

## 💻 4. 標準自動化腳本範例 (Node.js Reference)

```javascript
import { RevitMcpClient } from './revit_mcp_client.mjs';

export async function runStandardPlanDimension(viewId) {
  const client = new RevitMcpClient();
  
  // 0. 動態解析標註型式
  const typesRes = await client.sendCommand('query_elements', { category: 'DimensionTypes' });
  const dimTypes = typesRes.data?.DimensionTypes || typesRes.data?.Elements || [];
  const typeUpRight = dimTypes.find(t => t.DimensionTypeName?.includes('柱心-上右') || t.Name?.includes('柱心-上右'));
  const typeIdUpRight = typeUpRight?.DimensionTypeId || typeUpRight?.Id || dimTypes[0]?.DimensionTypeId || dimTypes[0]?.Id;

  // 1. 取得視圖資訊與 Scale
  const viewRes = await client.sendCommand('get_active_view', {});
  const scale = viewRes.data.Scale || 100; // 例如 100
  
  // 2. 取得全區外框實體包絡
  const envelope = await client.sendCommand('get_floor_envelope', { 
    viewId: viewId, 
    includeBalconies: true, 
    includeRoofs: true 
  });
  const { minX, maxX, minY, maxY } = envelope.data;

  // 3. 換算 40mm / 35mm / 30mm / 25mm 偏移量 (單位: mm)
  const offset40 = 40 * scale;
  const offset35 = 35 * scale;
  const offset30 = 30 * scale;
  const offset25 = 25 * scale;

  // 4. 取得並排序軸線
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids' });
  // 分為 verticalGrids (依 X 排序) 與 horizontalGrids (依 Y 排序)
  
  // 5. 建立上方雙層標註 (North)
  // 第 1 層 (總長 Y = maxY + offset35)
  const dim1 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: [firstVGridId, lastVGridId],
    startX: maxX, startY: maxY + offset35,
    endX: minX, endY: maxY + offset35
  });

  // 第 2 層 (柱間距 Y = maxY + offset30)
  const dim2 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: allVGridIdsSorted,
    startX: maxX, startY: maxY + offset30,
    endX: minX, endY: maxY + offset30
  });

  // 套用型式
  if (typeIdUpRight) {
    await client.sendCommand('change_element_type', {
      elementIds: [dim1.data.DimensionId, dim2.data.DimensionId],
      typeId: typeIdUpRight
    });
  }
}
```
