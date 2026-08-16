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

## 🏛️ 5 大核心規範

### 1. 雙層同一線段連續串接標註（String Dimension）
- 標註實體必須為單一連續線段（`SegmentsCount >= 2`），點選時為一體，嚴禁拆分為斷開小標註。
- **外層（第 1 層）**：全棟或各翼跨度總長。
- **內層（第 2 層）**：連續柱心間距（串接所有柱列軸線）。

### 2. 純原生 Grid 軸線參照（0 條輔助短細線）
- 透過 `gridIds: [ ... ]` 直接綁定 Revit 原生 `Grid` 軸線。
- **嚴禁在圖面上產生 DetailCurves / DetailLines 輔助線**。

### 3. 標註型式（Dimension Type）
- **上方（北側）與 右側（東側）**：`TABC-DIM_*/ S 2.5-柱心-上右`
- **下方（南側）與 左側（西側）**：`TABC-DIM_*/ S 2.5-柱心-下右`

### 4. 繪製向量與輔助線延伸方向（100% 朝向建物內側）
| 方位 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) |
|:---|:---:|:---:|:---|
| **北側 (上方)** | **由右至左**（東向西: A $\to$ G） | ⬇️ **朝下（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **東側 (右側)** | **由下至上**（南向北: 5 $\to$ 7） | ⬅️ **朝左（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **南側 (下方)** | **由左至右**（西向東: G $\to$ D） | ⬆️ **朝上（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **西側 (左側)** | **由上至下**（北向南: 7 $\to$ 1） | ➡️ **朝右（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |

### 5. 5MM 三等距階梯鎖點規範
依出圖比例（1:100 時 1mm = 100mm 模型空間）：
- **外層線（第 1 層）**：距離軸線圓圈底 **`5.0 mm`**（模型空間 $500\text{ mm}$）。
- **內層線（第 2 層）**：距離外層線 **`5.0 mm`**（符合型式參數 `尺寸線鎖點距離: 5.0000 mm`，模型空間 $500\text{ mm}$）。
- **端點輔助線（第 3 層）**：向內延伸 **`5.0 mm`**（符合型式參數 `輔助線長度: 5.0000 mm`，模型空間 $500\text{ mm}$）。

---
**維護者：** RevitMCP Customization Team
