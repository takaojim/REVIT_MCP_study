---
name: standard-elevation-dimension
description: 標準建築立面階梯標註與軸線整列系統：基於 Clipper2 3D-to-2D 多邊形布林投影提取建築外輪廓 (Silhouette)，GL 基準地面線釘死，全自動放樣 Step 0 實體外牆紅線框與 Step 5 齊頭藍線框，一鍵整列垂直 Grids 與水平 Levels 基準線，並自動建立頂部雙層柱心標註與左側雙層樓層高程標註。觸發條件：立面標註、建築立面、立面尺寸、立面外輪廓、立面齊頭、立面紅線藍線、standard elevation dimension、elevation silhouette、立面全自動標註。
---

# 標準建築立面階梯標註與軸線整列系統 (Standard Elevation Dimension SOP)

本工作流程定義 Revit 建築立面視圖出圖的**最高幾何放樣標準與空間外輪廓標註體系**。透過「**Clipper2 3D 幾何投影與多邊形布林融合 (Silhouette Outer Contour)**」、「**GL 基準地面線對齊**」與「**等距階梯模矩 (Step Modules)**」，徹底解決過去依賴 BoundingBox 誤抓、視圖原點偏移漂移與人工描線的痛點，實現立面軸線與樓層線齊頭對稱、頂部雙層柱心標註與左側雙層樓層高程標註的標準化出圖。

## Lessons Reference
- **L-002**：自動尺寸標註定位原則與視圖 ID 綁定。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。
- **L-033**：立面圖/剖面圖雙層標註標準工作流。頂部柱心由右至左、側邊樓層由頂至底（`Level.GetPlaneReference()`）。詳見 `domain/lessons.md`。
- **L-037**：建築立面 2D 計算幾何 Silhouette 外輪廓提取 (Clipper2)、GL 基準釘死與階梯整列標準工作流。詳見 `domain/lessons.md`。

---

## 📐 1. 核心幾何架構與座標系統 (Geometric Pipeline)

立面幾何運算採用標準的 **2D 計算幾何 (Computational Geometry)** 投影管線：

```text
Revit 3D BIM Elements (外牆、樓板、屋頂、柱、樑、女兒牆、樓梯、帷幕)
      ↓ (Options.View = activeElevation)
Solid / Face 幾何擷取
      ↓ (Face.Triangulate())
3D 三角網格 (Triangles)
      ↓ (內積投影: u = D·Right, v = D·Up)
立面 2D 三角形群 (Path64)
      ↓ (Clipper2 Polygon Union / NonZero)
最外層外輪廓 (Exterior Ring / PrimaryContour)
      ↓
取得建築外輪廓極值 (uMin, uMax, vMax) 與關鍵折點 (Silhouette Vertices)
```

> [!IMPORTANT]
> **座標轉換唯一黃金公式**：
> 局部立面座標 $(u, v)$ 轉為 Revit 3D 世界座標時，**嚴禁將 $u$ 誤當作 World $X$**，必須嚴格採用：
> $$\mathbf{P}_{world} = \mathbf{View.Origin} + \mathbf{RightDirection} \cdot u + \mathbf{UpDirection} \cdot v$$
> 確保在任意旋轉向度（如北向 $RightDirection = (-1, 0, 0)$）均 100% 精準貼齊。

---

## 🏗️ 2. 五階梯模矩與紅藍框線律定 (Step Modules & Hierarchy)

所有尺寸放樣以「**實體地上建築外圍包絡（Step 0 紅線）**」為基準線，並依出圖比例（1:100 時標準模矩間距為 **$650.0\text{ mm}$ / 圖紙 $6.5\text{ mm}$**）展開等距階梯。

| 階梯層級 | 頂部 (North / Top Grids) | 左側 (West / Left Levels) | 說明 |
| :---: | :--- | :--- | :--- |
| **Step 5** | 🔵 **氣泡齊頭線 (藍線, +3250mm)** | 🔵 **氣泡齊頭線 (藍線, -3250mm)** | 垂直軸線與水平樓層線之齊頭極限線 |
| **Step 4** | 📏 **Tier 1 柱心總跨 (+2600mm)** | 📏 **Tier 1 建築總高 (+2600mm)** | 距氣泡圈 1 個模矩（$650\text{ mm}$），單一全跨標註 |
| **Step 3** | 📏 **Tier 2 連續柱間距 (+1950mm)** | 📏 **Tier 2 連續各層層高 (+1950mm)** | 距 Tier 1 總跨 1 個模矩（$650\text{ mm}$），連續細部標註 |
| **Step 2** | ⬜ 留白緩衝帶 (+1300mm) | ⬜ 留白緩衝帶 (+1300mm) | 尺寸線與建築本體之隔離緩衝 |
| **Step 1** | ⬜ 留白緩衝帶 (+650mm) | ⬜ 留白緩衝帶 (+650mm) | 尺寸線與建築本體之隔離緩衝 |
| **Step 0** | 🔴 **實體外牆紅線 (0mm)** | 🔴 **實體外牆紅線 (0mm)** | 左右為實體外牆面、下為 GL、上為屋突最高頂點 |

---

## 🧭 3. 基準線齊頭整列 (Datum Alignment) 規範

1. **垂直軸線 (Grids Alignment)**：
   - 頂端端點延伸至 **Step 5 頂部藍線**。
   - 底端端點延伸至 **Step 5 底部藍線**（GL 往下 5 個間隔 = $-3,250\text{ mm}$）。
   - **氣泡開關**：頂端（End 1）顯示軸號氣泡圓圈；底端（End 0）隱藏氣泡。
2. **水平樓層線 (Levels Alignment)**：
   - 左端端點延伸至 **Step 5 左側藍線**。
   - 右端端點延伸至 **Step 5 右側藍線**。
   - **氣泡開關**：左端（End 0）顯示樓層標高氣泡標籤；右端（End 1）隱藏標籤。

---

## 🎨 4. 專屬標註型式與線條樣式對照

| 圖元類別 | 專屬型式名稱 | 視覺規格 | 說明 |
| :--- | :--- | :--- | :--- |
| **外牆紅線 (Step 0)** | `Step0-外牆輪廓紅線` | 純紅色 (RGB 230, 30, 30), 線寬 4 | 實體地上建築最大矩形包絡線 |
| **齊頭藍線 (Step 5)** | `Step5-齊頭藍線` | 純藍色 (RGB 30, 100, 240), 線寬 2 | 軸線與樓層線齊頭放樣基準線 |
| **頂部柱心標註** | `TABC-DIM_*/ S 2.5-柱心-上右` | 斜線 Tick, 5mm 輔助線向下 | 頂部 Tier 1 總跨 + Tier 2 各柱距 |
| **側邊樓層標註** | `TABC-DIM_*/ S 2.5-柱心-下右` | 斜線 Tick, 5mm 輔助線向右 | 左側 Tier 1 總高 + Tier 2 各層高 |

---

## 🚀 5. 自動化執行範例

呼叫 C# 原生命令或批次腳本一鍵完成：

```javascript
import { RevitSocketClient } from '../MCP-Server/build/socket.js';

const client = new RevitSocketClient('localhost', 8964);
await client.connect();

// 1. 確保 TABC 標註型式
await client.sendCommand('ensure_dimension_types', {});

// 2. 繪製紅藍外框並齊頭軸線與樓層線
await client.sendCommand('draw_elevation_envelope_boxes', {
  viewId: targetViewId,
  stepModules: 5,
  spacingMm: 650.0,
  cleanExisting: true,
  alignDatum: true
});

// 3. 建立頂部雙層柱心標註
await client.sendCommand('auto_dimension_elevation_grids', {
  viewId: targetViewId,
  typeId: 689724, // 上右型式
  offsetTier1Mm: 6.5,
  stepTier2Mm: 6.5
});

// 4. 建立左側雙層樓層高程標註
await client.sendCommand('auto_dimension_elevation_levels', {
  viewId: targetViewId,
  typeId: 689732, // 下右型式
  offsetTier1Mm: 6.5,
  stepTier2Mm: 6.5,
  includeBasement: false
});
```
