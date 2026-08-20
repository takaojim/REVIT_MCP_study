---
name: grid-column-dimension-workflow
description: "專屬柱間距與柱心連續標註標準作業程序（Grid Column Dimensioning SOP）：雙層同一線段連續串接標註、純原生 Grid 軸線參照、專屬上右/下右標註型式、朝向建物內側輔助線與 5MM 三等距階梯鎖點。觸發條件：使用者提到標註柱心、柱間距、柱列尺寸、柱心標註、軸線標註、grid dimension、column dimension。"
metadata:
  version: "1.0"
  updated: "2026-08-16"
  created: "2026-08-16"
  contributors:
    - "RevitMCP Customization Team"
  references: []
  related:
    - auto-dimension-workflow
  referenced_by:
    - grid-column-dimension
  tags: [標註, 柱心, 柱間距, 尺寸, dimension, string dimension, 軸線, Grid, 階梯鎖點]
---

# 專屬柱間距與柱心連續標註標準作業程序 (Grid Column Dimensioning SOP)

## 📋 概述

本文件定義專案中建築平面圖「外圍柱心間距」與「跨度總長」標註的最高規範，確保圖面產出符合最高施工圖標準。

---

## 🏛️ Dynamo 幾何自適應定位核心規範

本 SOP 正式依據 **`dynamo/標註-尺寸-柱列線.dyn`** 定位架構實作：

### 1. 動態四方極值基準線（軸線氣泡端點基準線）
- **網格分類與排序**：
  - 水平網格 (`h_grids`)：依 $Y$ 座標升冪排序（南至北：1 $\to$ 8）。
  - 垂直網格 (`v_grids`)：依 $X$ 座標升冪排序（西至東：H $\to$ A）。
- **四方極值基準線定義（Grid Bubble 氣泡中心連線）**：
  - **頂端基準線 (`max_y`)**：垂直軸線頂部端點最大 $Y$ 座標（**頂部氣泡圓圈所在之水平線**）。
  - **底部基準線 (`min_y`)**：垂直軸線底部端點最小 $Y$ 座標（**底部氣泡圓圈所在之水平線**）。
  - **左側基準線 (`min_x`)**：水平軸線左側端點最小 $X$ 座標（**左側氣泡圓圈所在之垂直線**）。
  - **右側基準線 (`max_x`)**：水平軸線右側端點最大 $X$ 座標（**右側氣泡圓圈所在之垂直線**）。
- **依視圖比例動態向建築物方向退縮計算**：
  - **外圈總尺寸（Tier 1）**：距離氣泡基準線 **`0.5 cm * view.Scale`**（圖紙 5mm $\rightarrow$ 1:100 時為 $500\text{ mm}$）。
  - **內圈細部尺寸（Tier 2）**：距離氣泡基準線 **`0.5 cm + 0.65 cm = 1.15 cm * view.Scale`**（圖紙 11.5mm $\rightarrow$ 1:100 時為 $1,150\text{ mm}$）。

### 2. 四方位雙層連續標註定位矩陣
| 方位 | 外圈總尺寸線位置 (Tier 1) | 內圈細部尺寸線位置 (Tier 2) | 參照軸線 | 標註型式 (Dimension Type) |
|:---|:---|:---|:---|:---|
| **頂部 (Top / 北側)** | $Y = \text{max\_y} - 500\text{ mm}$ | $Y = \text{max\_y} - 1,150\text{ mm}$ | 垂直網格 `v_grids` (A $\to$ H) | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **底部 (Bottom / 南側)** | $Y = \text{min\_y} + 500\text{ mm}$ | $Y = \text{min\_y} + 1,150\text{ mm}$ | 垂直網格 `v_grids` (H $\to$ D) | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **左側 (Left / 西側)** | $X = \text{min\_x} + 500\text{ mm}$ | $X = \text{min\_x} + 1,150\text{ mm}$ | 水平網格 `h_grids` (8 $\to$ 1) | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **右側 (Right / 東側)** | $X = \text{max\_x} - 500\text{ mm}$ | $X = \text{max\_x} - 1,150\text{ mm}$ | 水平網格 `h_grids` (5 $\to$ 8) | `TABC-DIM_*/ S 2.5-柱心-上右` |

### 3. 純原生 Grid 參照與單一連續線段
- **外圈**：由首尾兩條軸線組成（`[grids[0], grids[-1]]`）總長跨度。
- **內圈**：由全部軸線串成單一連續標註圖元（`SegmentsCount >= 2`）。
- **0 條輔助線**：100% 使用 `Reference(grid)` 原生綁定，嚴禁產生 DetailLines 輔助線。

---
**維護者：** RevitMCP Customization Team
