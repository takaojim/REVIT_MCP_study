---
name: standard-elevation-dimension
description: 標準建築立面與剖面階梯標註與軸線整列系統：基於 Clipper2 3D-to-2D 多邊形布林投影提取建築外輪廓 (Silhouette)，GL 基準地面線釘死（消除測量高程偏差），全自動放樣 Step 0 實體外牆紅線框與 Step N / N+3 齊頭藍線框（左側樓層線專屬 N+3 模矩規則，如 5+3=8、7+3=10，徹底避開樓層名稱與標高文字並保持頂部與左側內緣尺寸線對稱留白 2 個間隔），一鍵整列垂直 Grids 與水平 Levels 基準線，並自動建立頂部雙層柱心標註與左側雙層樓層高程標註。觸發條件：立面標註、建築立面、立面尺寸、剖面標註、立面外輪廓、立面齊頭、立面紅線藍線、standard elevation dimension、elevation silhouette、立面全自動標註、5個間距、8個間距、N+3。
---

# 標準建築立面與剖面階梯標註與軸線整列系統 (Standard Elevation Dimension SOP)

本工作流程定義 Revit 建築立面與剖面視圖出圖的**最高幾何放樣標準與空間外輪廓標註體系**。透過「**Clipper2 3D 幾何投影與多邊形布林融合 (Silhouette Outer Contour)**」、「**GL 基準地面線對齊**」、「**左側樓層線專屬 $N+3$ 模矩避讓法則**」與「**Silhouette 幾何外框絕對錨定**」，徹底解決過去依賴 BoundingBox 誤抓、視圖海平面高程漂移、Crop Box 裁減框過大干擾、以及樓層標示文字與尺寸線重疊的痛點，實現立面軸線與樓層線齊頭對稱、頂部雙層柱心標註與左側雙層樓層高程標註的標準化出圖。

## Lessons Reference
- **L-002**：自動尺寸標註定位原則與視圖 ID 綁定。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。
- **L-033**：立面圖/剖面圖雙層標註標準工作流。頂部柱心由右至左、側邊樓層由頂至底（`Level.GetPlaneReference()`）。詳見 `domain/lessons.md`。
- **L-037**：建築立面 2D 計算幾何 Silhouette 外輪廓提取 (Clipper2)、GL 基準釘死、Silhouette 絕對錨定與左側 $N+3$ 階梯整列標準工作流。詳見 `domain/lessons.md`。

---

## 🏛️ 1. 核心階梯律定法則：左側樓層線 $N+3$ 規則

當使用者或規範律定基準模矩為 **$N$ 個間距** 時（例如 $N=5$ 或 $N=7$）：
- **頂部 (Top Grids)、右側 (Right)、底部 (Bottom GL)**：一律採用 **$N$ 個模矩**。
- **左側樓層線 (Left Levels)**：**一律採用 $N + 3$ 個模矩**（如 $5 \to 5+3=8$；$7 \to 7+3=10$）。

### 為什麼左側必須加 3 個模矩？
1. **樓層標頭文字避讓**：Revit 樓層符號右側伴隨橫向展開的雙行文字（例如 `TRFL` 樓層名 + `FL 2680` 標高值），寬度約佔 $15\sim 22\text{ mm}$。透過 $N+3$ 外推藍線，能在藍線（Step 8）與 Tier 1 總尺寸線（Step 4）之間創造長達 3 個模矩（Step 7、Step 6、Step 5）的**「專屬文字保護區」**，100% 杜絕標註文字與樓層標高打架！
2. **頂部與左側完全對稱 2 個間隔留白**：
   - **頂部**：Tier 2 柱心細部尺寸線位於 Step 3，距頂部外牆紅線（Step 0）保持 **2 個留白間隔（Step 2 與 Step 1）**。
   - **左側**：Tier 2 連續層高尺寸線位於 Step 3，距左側外牆紅線（Step 0）亦保持 **2 個留白間隔（Step 2 與 Step 1）**！
   - 頂部與左側的視覺留白呼吸感達到完美的數學對稱！

---

## 📐 2. 幾何階梯放樣層級矩陣 (以標準 $N=5$ 即左側 8 模矩為例)

單一模矩間距 $\text{Spacing} = 6.5\text{ mm} \times \text{view.Scale}$（1:100 時為 $650\text{ mm}$、1:60 時為 $390\text{ mm}$、1:50 時為 $325\text{ mm}$）：

| 階梯層級 | 頂部 (Top Grids, N=5) | 左側 (Left Levels, N+3=8) | 說明與角色 |
| :---: | :--- | :--- | :--- |
| **Step 8** | ─ | 🔵 **藍線齊頭基準線 (Levels Bubble)** | 樓層線左端標記完全齊平此線 |
| **Step 7** | ─ | ⬜ **樓層文字保護專屬留白區** | `TRFL FL 2680` 等文字展開空間 |
| **Step 6** | ─ | ⬜ **樓層文字保護專屬留白區** | 樓層標高文字呼吸帶 |
| **Step 5** | 🔵 **藍線齊頭基準線 (Grids Bubble)** | ⬜ **樓層文字保護專屬留白區** | 頂部軸號圓圈齊平此線 / 左側文字隔離帶 |
| **Step 4** | 📏 **Tier 1 柱心總跨度尺寸線** | 📏 **Tier 1 建築總高度尺寸線** | 頂部全跨度總尺寸 / 左側建築總高（GL~TRFL） |
| **Step 3** | 📏 **Tier 2 連續各柱間距尺寸線** | 📏 **Tier 2 連續各層樓高尺寸線** | 連續柱心分段串接 / 連續各樓層高分段串接 |
| **Step 2** | ⬜ 尺寸線與建築本體留白緩衝 | ⬜ 尺寸線與建築本體留白緩衝 | 留白第 2 格（呼吸空間） |
| **Step 1** | ⬜ 建築外皮第一道留白緩衝 | ⬜ 建築外皮第一道留白緩衝 | 留白第 1 格（呼吸空間） |
| **Step 0** | 🔴 **實體外牆紅線 (0.0mm)** | 🔴 **實體外牆紅線 (0.0mm)** | 左右為實體外牆面、下為 GL (minV)、上為屋突頂點 (maxV) |

---

## 🧭 3. 幾何外輪廓 (Silhouette) 絕對錨定與 GL 釘死規範

1. **GL / 建築實體底界釘死 (`minV`)**：
   - 杜絕依賴 `Level.Elevation = 0` 導致的高程失真（如專案建於絕對測量高程 $Z=95.5\text{m}$ 時）。
   - Step 0 紅線底界一律取外輪廓底界 $V_{\text{bottom}} = \text{minV}$，Step 5 藍線底界為 $\text{minV} - 5 \times \text{Spacing}$。
2. **尺寸線絕對錨定 (Envelope Anchoring)**：
   - 頂部尺寸線直接錨定於 $V_{\text{Top}} = \text{maxV} + 4 \times \text{Spacing}$（Step 4）與 $\text{maxV} + 3 \times \text{Spacing}$（Step 3）。
   - 左側尺寸線直接錨定於 $U_{\text{Left}} = \text{minU} - 4 \times \text{Spacing}$（Step 4）與 $\text{minU} - 3 \times \text{Spacing}$（Step 3）。
   - **完全免疫 Crop Box 裁減範圍與未修剪 3D Datum 漂移干擾**。

---

## 🎨 4. 專屬標註型式與線條樣式對照

| 圖元類別 | 專屬型式名稱 | 視覺規格 | 說明 |
| :--- | :--- | :--- | :--- |
| **外牆紅線 (Step 0)** | `Step0-外牆輪廓紅線` | 純紅色 (RGB 230, 30, 30), 線寬 4 | 實體地上建築最大矩形包絡線 |
| **齊頭藍線 (Step N/N+3)**| `Step5-齊頭藍線` | 純藍色 (RGB 30, 100, 240), 線寬 2 | 軸線與樓層線齊頭放樣基準線 |
| **頂部柱心標註** | `TABC-DIM_*/ S 2.5-柱心-上右` | 斜線 Tick, 5mm 輔助線向下 | 頂部 Tier 1 總跨 + Tier 2 各柱距（由右至左建立） |
| **側邊樓層標註** | `TABC-DIM_*/ S 2.5-柱心-下右` | 斜線 Tick, 5mm 輔助線向右 | 左側 Tier 1 總高 + Tier 2 各層高（由頂至底建立） |

---

## 🚀 5. 自動化呼叫範例

```javascript
import { RevitSocketClient } from '../MCP-Server/build/socket.js';

const client = new RevitSocketClient('localhost', 8964);
await client.connect();

// 1. 確保 TABC 標註型式
await client.sendCommand('ensure_dimension_types', {});

// 2. 繪製紅藍外框（指定基準模矩 N=5，底層自動套用左側 N+3=8）
await client.sendCommand('draw_elevation_envelope_boxes', {
  viewId: targetViewId,
  stepModules: 5, // 頂/右/底=5, 左側自動=8
  cleanExisting: true,
  alignDatum: true
}, 120000);

// 3. 建立頂部雙層柱心標註 (自動鎖定 Step 4 與 Step 3)
await client.sendCommand('auto_dimension_elevation_grids', {
  viewId: targetViewId,
  typeId: topTypeId,
  offsetTier1Mm: 6.5,
  stepTier2Mm: 6.5
}, 120000);

// 4. 建立左側雙層樓層高程標註 (自動鎖定 Step 4 與 Step 3，含地下層判斷)
await client.sendCommand('auto_dimension_elevation_levels', {
  viewId: targetViewId,
  typeId: leftTypeId,
  offsetTier1Mm: 26.0,
  stepTier2Mm: 6.5,
  includeBasement: isSectionView
}, 120000);
```

