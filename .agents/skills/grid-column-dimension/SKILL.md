---
name: grid-column-dimension
description: "專屬柱間距與柱心連續標註標準工作流：自動在平面視圖建立雙層同一線段連續串接標註（String Dimension）、純原生 Grid 軸線參照、專屬上右/下右標註型式、朝向建物內側輔助線與 5MM 三等距階梯鎖點。觸發條件：使用者提到標註柱心、柱間距、柱列尺寸、柱心標註、軸線標註、grid dimension、column dimension、柱心連續標註。"
---

# 🏛️ 專屬柱間距與柱心連續標註標準規範 (Grid Column Dimensioning SOP)

本技能為專屬建築平面圖「柱心間距標註」最高優先級標準規範。只要使用者要求「標註柱心」、「柱間距標註」、「柱列尺寸」、「軸線間距」等指令，**必須 100% 依循以下 5 大核心作業程序**。

---

## 📐 1. Dynamo 幾何自適應四方極值基準線（軸線氣泡端點極值）
- **四方極值基準線定義（Grid Bubble 氣泡中心連線）**：
  - **頂端基準線 (`max_y`)**：垂直軸線頂部端點最大 $Y$ 座標（**頂部氣泡圓圈所在之水平線**，4FL: $38,067.05\text{ mm}$）。
  - **底部基準線 (`min_y`)**：垂直軸線底部端點最小 $Y$ 座標（**底部氣泡圓圈所在之水平線**，4FL: $-26,000.00\text{ mm}$）。
  - **左側基準線 (`min_x`)**：水平軸線左側端點最小 $X$ 座標（**左側氣泡圓圈所在之垂直線**，4FL: $-12,941.93\text{ mm}$）。
  - **右側基準線 (`max_x`)**：水平軸線右側端點最大 $X$ 座標（**右側氣泡圓圈所在之垂直線**，4FL: $54,562.34\text{ mm}$）。
- **雙層連續標註向建築物方向退縮定位**：
  - **外圈總尺寸（Tier 1）**：距離氣泡基準線往建物方向 **`0.5 cm * view.Scale`**（圖紙 5mm $\rightarrow$ 1:100 時為 $500\text{ mm}$）。
  - **內圈細部尺寸（Tier 2）**：距離氣泡基準線往建物方向 **`0.5 cm + 0.65 cm = 1.15 cm * view.Scale`**（圖紙 11.5mm $\rightarrow$ 1:100 時為 $1,150\text{ mm}$）。

---

## ⚡ 2. 純原生 Grid 軸線參照（0 條輔助短細線）
- 必須直接使用 `gridIds: [id1, id2, ...]` 傳入原生 `Grid` 圖元參照給 `create_dimension` 工具。
- **嚴禁在圖面上產生 DetailCurves / DetailLines 輔助短細線**，保持圖面 100% 乾淨，且軸線變動時尺寸線自動連動。

---

## 🏷️ 3. 標註型式（Dimension Type）與文字方位規範
根據視圖四邊幾何方位與文字閱讀朝向，嚴格套用專屬柱心標註型式：
- **上方（北側）與 右側（東側）**：採用 **`TABC-DIM_*/ S 2.5-柱心-上右`**
- **下方（南側）與 左側（西側）**：採用 **`TABC-DIM_*/ S 2.5-柱心-下右`**

---

## 🧭 4. 繪製向量與輔助線延伸方向（100% 朝向建物內側）
為確保 `固定尺寸線`（5.0mm）之端點記號指向建築物本體，必須依幾何方位給定正確起訖向量：

| 方位 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) | 外圈位置 (Tier 1) | 內圈位置 (Tier 2) |
|:---|:---:|:---:|:---|:---|:---|
| **北側 (上方)** | **由右至左**（東向西: A $\to$ H） | ⬇️ **朝下（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` | $Y = \text{max\_y} - 500\text{ mm}$ | $Y = \text{max\_y} - 1,150\text{ mm}$ |
| **南側 (下方)** | **由左至右**（西向東: H $\to$ D） | ⬆️ **朝上（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` | $Y = \text{min\_y} + 500\text{ mm}$ | $Y = \text{min\_y} + 1,150\text{ mm}$ |
| **西側 (左側)** | **由上至下**（北向南: 8 $\to$ 1） | ➡️ **朝右（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` | $X = \text{min\_x} + 500\text{ mm}$ | $X = \text{min\_x} + 1,150\text{ mm}$ |
| **東側 (右側)** | **由下至上**（南向北: 5 $\to$ 8） | ⬅️ **朝左（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` | $X = \text{max\_x} - 500\text{ mm}$ | $X = \text{max\_x} - 1,150\text{ mm}$ |

---

## 📏 5. 間距與鎖點規格（5MM 三等距階梯標準）
依出圖比例（1:100 時 1mm = 100mm 模型空間）：
- **外層線（第 1 層）**：距離軸線圓圈底 **`5.0 mm`**（模型空間 $500\text{ mm}$）。
- **內層線（第 2 層）**：距離外層線 **`5.0 mm`**（精確符合型式參數 `尺寸線鎖點距離: 5.0000 mm`，模型空間 $500\text{ mm}$）。
- **端點輔助線（第 3 層）**：向內延伸 **`5.0 mm`**（精確符合型式參數 `輔助線長度: 5.0000 mm`，模型空間 $500\text{ mm}$）。

---

## 🛠️ 標準調用範例

```javascript
// 1. 北側柱心標註 (以 2FL 為例)
// 外層總長 (距圓圈底 5mm)
const nTotal = await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [gridAId, gridGId],
  startX: 47333.25, startY: 38936,
  endX: -1691.74, endY: 38936
});

// 內層柱心連續標註 (距外層 5mm)
const nContinuous = await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [gridAId, gridBId, gridCId, gridDId, gridEId, gridFId, gridGId],
  startX: 47333.25, startY: 38436,
  endX: -1691.74, endY: 38436
});

// 套用上右型式
await client.sendCommand('change_element_type', {
  elementIds: [nTotal.data.DimensionId, nContinuous.data.DimensionId],
  typeId: typeIdUpRight // TABC-DIM_*/ S 2.5-柱心-上右
});
```

---

## 🏛️ 立面圖專屬工具快速指引 (Elevation Dimensioning)

- **立面圖頂部柱心雙層標註**：呼叫 `auto_dimension_elevation_grids`
  - 尺寸線向量**由右至左**，5mm 短輔助線全數朝下 $\downarrow$（指向建築物），套用 `TABC-DIM_*/ S 2.5-柱心-上右`。
- **立面圖側邊樓層雙層標註**：呼叫 `auto_dimension_elevation_levels`
  - 尺寸線向量**由頂至底**，5mm 短輔助線全數朝右 $\rightarrow$（指向建築物），套用 `TABC-DIM_*/ S 2.5-柱心-下右`。
  - 外層總高程退縮 **30mm (圖紙)**，避開 `TRFL ▼ FL 2680` 等標示圈文字。

---
**維護者：** RevitMCP Customization Team
