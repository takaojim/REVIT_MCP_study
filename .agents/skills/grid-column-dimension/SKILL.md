---
name: grid-column-dimension
description: 專屬柱間距與柱心連續標註標準工作流：自動在平面視圖建立雙層同一線段連續串接標註（String Dimension）、純原生 Grid 軸線參照、專屬上右/下右標註型式、朝向建物內側輔助線與 5MM 三等距階梯鎖點。觸發條件：使用者提到標註柱心、柱間距、柱列尺寸、柱心標註、軸線標註、grid dimension、column dimension、柱心連續標註。
---

# 專屬柱間距與柱心連續標註標準工作流 (SOP)

本工作流程定義在 Revit 平面視圖中自動進行柱心連續標註的最高標準，確保標註正確掛載於原生 Grid 軸線，並嚴格遵循雙層標註（外層總長、內層連續）、5MM 鎖點間距與方向延伸原則。

---

## 📌 1. 核心規範原則 (Mandatory Guidelines)

1. **純原生 Grid 參照（0 輔助線）**：
   - 尺寸標註必須**直接掛載在 Grid 軸線元素**上（使用 `gridIds` 參數）。
   - **嚴禁建立 DetailLines 輔助細線**，若發現視圖上有既有輔助細線或舊標註，必須先清理刪除。

2. **雙層同一線段連續串接標註（String Dimensions）**：
   - 每側必須生成**兩道標註線**：
     - **第一條線（最貼近網格圓圈底，距圓圈底 5.0mm）**：**外層總長度標註 (Total Dimension)**
     - **第二條線（第一條線下方 5.0mm，更靠近建物外牆）**：**內層柱心連續間距標註 (Continuous Spacing Dimension)**
   - 內層標註必須一次串接該側所有對應的 Grid 軸線（包含 H 軸與 8 軸）。

3. **專屬標註型式對應 (Dimension Types)**：
   - **北側 (上方) & 東側 (右側)**：必須使用 **`TABC-DIM_*/ S 2.5-柱心-上右`**
   - **南側 (下方) & 西側 (左側)**：必須使用 **`TABC-DIM_*/ S 2.5-柱心-下右`**

---

## 🧭 2. 繪製向量與輔助線延伸方向（100% 朝向建物內側）

為確保 `固定尺寸線`（5.0mm）之端點記號指向建築物本體，必須依幾何方位給定正確起訖向量：

| 方位 | 軸線涵蓋範圍 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) |
|:---|:---:|:---:|:---:|:---|
| **北側 (上方)** | A $\to$ H (含 H) | **由右至左**（東向西: A $\to$ H） | ⬇️ **朝下（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **東側 (右側)** | 5 $\to$ 8 (含 8) | **由下至上**（南向北: 5 $\to$ 8） | ⬅️ **朝左（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **南側 (下方)** | H $\to$ D (含 H) | **由左至右**（西向東: H $\to$ D） | ⬆️ **朝上（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **西側 (左側)** | 8 $\to$ 1 (含 8) | **由上至下**（北向南: 8 $\to$ 1） | ➡️ **朝右（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |

---

## 📏 3. 間距與鎖點規格（5MM 三等距階梯標準）

依出圖比例（1:100 時 1mm = 100mm 模型空間）：
- **第一條線 (外層總長線)**：距離軸線圓圈底 **`5.0 mm`**（模型空間 $500\text{ mm}$）。
- **第二條線 (內層連續線)**：距離第一條線 **`5.0 mm`**（精確符合型式參數 `尺寸線鎖點距離: 5.0000 mm`，模型空間 $500\text{ mm}$）。
- **端點輔助線**：向內延伸 **`5.0 mm`**（精確符合型式參數 `輔助線長度: 5.0000 mm`，模型空間 $500\text{ mm}$）。

---

## 🛠️ 標準調用腳本範例 (Node.js / Revit MCP)

```javascript
// 1. 刪除既有舊標註
const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId });
if (dimsRes.data?.Elements) {
  for (const d of dimsRes.data.Elements) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
}

// 2. 北側柱心標註建立 (外推邊界: 內層 Y=34000, 外層 Y=35500)
// 第 1 條線：內層柱心連續 (Grid G ~ A)
const nContinuous = await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [gridGId, gridFId, gridEId, gridDId, gridCId, gridBId, gridAId],
  startX: 47333.25, startY: 34000,
  endX: -1691.74, endY: 34000
});

// 第 2 條線：外層總長 (Grid G ~ A)
const nTotal = await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [gridGId, gridAId],
  startX: 47333.25, startY: 35500,
  endX: -1691.74, endY: 35500
});

// 3. 套用專屬柱心標註型式 (北側上右)
await client.sendCommand('change_element_type', {
  elementIds: [nContinuous.data.DimensionId, nTotal.data.DimensionId],
  typeId: typeIdUpRight
});
```
