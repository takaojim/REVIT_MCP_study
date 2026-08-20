---
name: auto-dimension
description: "自動標註尺寸：包含『柱間距/柱心連續標註標準工作流』與『Ray-Casting / BoundingBox / Wall-Batch』房間、走廊、MEP、牆段標註。觸發條件：使用者提到標註、柱心、柱間距、尺寸、dimension、annotation、淨寬、淨高、measurement、自動標註、批次標註、自動標尺寸、外牆總尺寸、串接尺寸。工具：create_dimension、change_element_type、create_dimension_by_ray、create_dimension_by_bounding_box、auto_dimension_walls、get_room_info。"
---

# 自動標註尺寸與柱間距標註規範

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。位置線用 BoundingBox 中心 `(max+min)/2`。詳見 `domain/lessons.md`。

---

## 🏛️ 柱間距與柱心連續標註標準工作流（Dynamo 幾何自適應定位 SOP）

本規範正式採用 **`dynamo/標註-尺寸-柱列線.dyn`** 之全動態幾何自適應定位演算法：

### 1. 動態四方極值基準線（軸線氣泡端點基準線）
- **網格自動分類與排序**：
  - 抓取視圖內所有 `OST_Grids` 軸線圖元（透過 `GetCurvesInView(DatumExtentType.ViewSpecific, view)`）。
  - 依向量 `abs(dir.X) > abs(dir.Y)` 分類：
    - **水平軸線 (`h_grids`)**：按 $Y$ 座標由小至大排序（南 $\to$ 北：1 $\to$ 8）。
    - **垂直軸線 (`v_grids`)**：按 $X$ 座標由小至大排序（西 $\to$ 東：H $\to$ A）。
- **四方極值基準線定義（Grid Bubble 氣泡中心連線）**：
  - **頂端基準線 (`max_y`)**：垂直軸線頂部端點之最大 $Y$ 座標（**頂部氣泡圓圈所在之水平線**）。
  - **底部基準線 (`min_y`)**：垂直軸線底部端點之最小 $Y$ 座標（**底部氣泡圓圈所在之水平線**）。
  - **左側基準線 (`min_x`)**：水平軸線左側端點之最小 $X$ 座標（**左側氣泡圓圈所在之垂直線**）。
  - **右側基準線 (`max_x`)**：水平軸線右側端點之最大 $X$ 座標（**右側氣泡圓圈所在之垂直線**）。
- **圖紙比例換算偏移量（向建築物方向退縮）**：
  - 取得視圖比例 `view_scale = view.Scale`。
  - **外圈總尺寸（Tier 1）**：距離氣泡基準線 **`0.5 cm * view_scale`**（圖紙 5mm $\rightarrow$ 1:100 為 $500\text{ mm}$）。
  - **內圈細部尺寸（Tier 2）**：距離氣泡基準線 **`0.5 cm + 0.65 cm = 1.15 cm * view_scale`**（圖紙 11.5mm $\rightarrow$ 1:100 為 $1,150\text{ mm}$）。

### 2. 四方位雙層連續標註定位矩陣
| 方位 | 外圈總尺寸線位置 (Tier 1) | 內圈細部尺寸線位置 (Tier 2) | 參照軸線 (References) | 標註型式 (Dimension Type) |
|:---|:---|:---|:---|:---|
| **頂部 (Top / 北側)** | $Y = \text{max\_y} - 500\text{ mm}$ | $Y = \text{max\_y} - 1,150\text{ mm}$ | 垂直網格 `v_grids` (A $\to$ H) | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **底部 (Bottom / 南側)** | $Y = \text{min\_y} + 500\text{ mm}$ | $Y = \text{min\_y} + 1,150\text{ mm}$ | 垂直網格 `v_grids` (H $\to$ D) | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **左側 (Left / 西側)** | $X = \text{min\_x} + 500\text{ mm}$ | $X = \text{min\_x} + 1,150\text{ mm}$ | 水平網格 `h_grids` (8 $\to$ 1) | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **右側 (Right / 東側)** | $X = \text{max\_x} - 500\text{ mm}$ | $X = \text{max\_x} - 1,150\text{ mm}$ | 水平網格 `h_grids` (5 $\to$ 8) | `TABC-DIM_*/ S 2.5-柱心-上右` |

### 3. 純原生 Grid 參照與單一連續線段
- **外圈**：由首尾兩條軸線組成（`[grids[0], grids[-1]]`）總長跨度。
- **內圈**：由全部軸線串成單一連續標註圖元（`SegmentsCount >= 2`）。
- **0 輔助線**：100% 使用 `Reference(grid)` 原生綁定，嚴禁產生 DetailLines 輔助線。

---

## Method Selection（其他空間與牆體標註）

| 場景 | 方法 | 工具 |
|------|------|------|
| **柱列 / 柱間距 / 柱心** | **Grid-String** | **`create_dimension` (with `gridIds`)** |
| 一般矩形房間 | Ray-Casting | `create_dimension_by_ray` |
| L 形或不規則房間 | BoundingBox | `create_dimension_by_bounding_box` |
| MEP 設備淨空檢查 | Ray-Casting | `create_dimension_by_ray` |
| 批次牆段標註（無 Room、剛蓋完牆） | Wall-Batch | `auto_dimension_walls` |

---

## Wall-Batch Workflow（剛蓋完一批牆要標尺寸）

`auto_dimension_walls` 不依賴 Room，三模式擇一：

| mode | 用途 | 輸出條數 |
|------|------|---------|
| `overall_bbox`（預設）| 外圍兩條總長串：top 邊沿 X、right 邊沿 Y | 2 |
| `chained` | 同列／同排共線牆串成 string dimension（每列一條） | N（依 row/col 數） |
| `per_wall` | 每道牆獨立一個長度標註 | 每牆一條 |

### 參數
- `viewId`（必填）：必須是 `ViewPlan`
- `wallIds`（選填）：未提供則自動抓 view 範圍內所有牆
- `mode`（預設 `overall_bbox`）
- `offsetMm`（預設 1500）

---

## Ray-Casting Workflow

1. 取得房間中心：`get_room_info` → 提取 `Location` 座標
2. 沿 X+/X- 方向發射射線 → 偵測牆面 → 建立 X 軸標註
3. 沿 Y+/Y- 方向發射射線 → 偵測牆面 → 建立 Y 軸標註

---

## Key Rules

- **嚴禁**在 3D 視圖中建立 2D 標註 — 必須先確認 `ActiveView` 類型。
- 柱間距標註一律使用同一線段連續標註（String Dimension）並套用 `TABC-DIM_*/ S 2.5-柱心-上右` / `下右`。
- 柱間距外層線距離圓圈底 5MM，尺寸線間距 5MM，輔助線 5MM 指向建物。
- 詳見 `domain/auto-dimension-workflow.md`。
