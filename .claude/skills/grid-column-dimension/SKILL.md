---
name: grid-column-dimension
description: "專屬柱間距與柱心連續標註標準工作流：自動在平面視圖建立雙層同一線段連續串接標註（String Dimension）、純原生 Grid 軸線參照、專屬上右/下右標註型式、朝向建物內側輔助線與 5MM 三等距階梯鎖點。觸發條件：使用者提到標註柱心、柱間距、柱列尺寸、柱心標註、軸線標註、grid dimension、column dimension、柱心連續標註。"
---

# 🏛️ 專屬柱間距與柱心連續標註標準規範 (Grid Column Dimensioning SOP)

本技能為專屬建築平面圖「柱心間距標註」最高優先級標準規範。只要使用者要求「標註柱心」、「柱間距標註」、「柱列尺寸」、「軸線間距」等指令，**必須 100% 依循以下核心作業程序**。

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。詳見 `domain/lessons.md`。
- **L-031**：建築模型圖元查詢原則，`query_elements` 預設上限為 10,000 筆，批次查詢視圖/圖元時嚴禁受預設截斷影響。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。

---

## 🔍 0. 標註型式前置動態查詢與防呆機制 (Preflight DimensionType Check - 必做)

執行任何柱心或高程標註前，**絕對嚴禁在程式碼中寫死 (Hardcode) 任何靜態 TypeId**！若專案未載入 TABC 樣板，寫死 ID 會導致型式無效、標註失敗或尺寸線完全無法顯示。

### 標準前置查詢與降級處理 SOP：
1. **查詢現有型式**：先呼叫 `query_elements({ category: "DimensionTypes" })` 或 `list_dimension_types` 取得專案清單。
2. **多階優先順序匹配**：
   - **第一優先（專屬標準型式）**：
     - 上方 (北) / 右側 (東)：尋找名稱包含 `柱心-上右` 或 `TABC-DIM_*/ S 2.5-柱心-上右`
     - 下方 (南) / 左側 (西)：尋找名稱包含 `柱心-下右` 或 `TABC-DIM_*/ S 2.5-柱心-下右`
   - **第二優先（模糊相容匹配）**：
     - 若無專屬型式，尋找包含 `柱心`、`對齊` (Aligned)、`Linear`、`標準` 等線性標註型式。
   - **第三優先（安全降級 Fallback）**：
     - 若完全無匹配，使用專案內第一支有效線性標註型式 ID，或在建立時不指定 `typeId`（直接採用 Revit 預設型式）。
3. **透明提示**：
   - 成功匹配時日誌輸出：`[型式確認] 成功套用專屬型式: [型式名稱] (ID: [ID])`
   - 降級時明確警示：`⚠️ 警告：當前專案未載入 TABC 專屬柱心標註型式，已自動採用既有型式 [型式名稱] (ID: [ID]) 進行標註。若需特定出圖字體/箭頭，請先從樣板載入 TABC 標註型式。`

---

## 📐 1. Dynamo 幾何自適應四方極值基準線（軸線氣泡端點極值）
- **四方極值基準線定義（Grid Bubble 氣泡中心連線）**：
  - **頂端基準線 (`max_y`)**：垂直軸線頂部端點最大 $Y$ 座標（**頂部氣泡圓圈所在之水平線**）。
  - **底部基準線 (`min_y`)**：垂直軸線底部端點最小 $Y$ 座標（**底部氣泡圓圈所在之水平線**）。
  - **左側基準線 (`min_x`)**：水平軸線左側端點最小 $X$ 座標（**左側氣泡圓圈所在之垂直線**）。
  - **右側基準線 (`max_x`)**：水平軸線右側端點最大 $X$ 座標（**右側氣泡圓圈所在之垂直線**）。
- **雙層連續標註向建築物方向退縮定位**：
  - **外圈總尺寸（Tier 1）**：距離氣泡基準線往建物方向 **`0.5 cm * view.Scale`**（圖紙 5mm $\rightarrow$ 1:100 時為 $500\text{ mm}$）。
  - **內圈細部尺寸（Tier 2）**：距離氣泡基準線往建物方向 **`0.5 cm + 0.65 cm = 1.15 cm * view.Scale`**（圖紙 11.5mm $\rightarrow$ 1:100 時為 $1,150\text{ mm}$）。

---

## ⚡ 2. 純原生 Grid 軸線參照（0 條輔助短細線）
- 必須直接使用 `gridIds: [id1, id2, ...]` 傳入原生 `Grid` 圖元參照給 `create_dimension` 工具。
- **嚴禁在圖面上產生 DetailCurves / DetailLines 輔助短細線**，保持圖面 100% 乾淨，且軸線變動時尺寸線自動連動。

---

## 🏷️ 3. 標註型式（Dimension Type）與文字方位規範
根據視圖四邊幾何方位與文字閱讀朝向，套用動態解析出的專屬柱心標註型式：
- **上方（北側）與 右側（東側）**：優先採用 **`TABC-DIM_*/ S 2.5-柱心-上右`**（或動態 fallback 型式）
- **下方（南側）與 左側（西側）**：優先採用 **`TABC-DIM_*/ S 2.5-柱心-下右`**（或動態 fallback 型式）

---

## 🧭 4. 繪製向量與輔助線延伸方向（100% 朝向建物內側）
為確保 `固定尺寸線`（5.0mm）之端點記號指向建築物本體，必須依幾何方位給定正確起訖向量：

| 方位 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) | 外圈位置 (Tier 1) | 內圈位置 (Tier 2) |
|:---|:---:|:---:|:---|:---|:---|
| **北側 (上方)** | **由右至左**（東向西: A $\to$ H） | ⬇️ **朝下（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右`（動態 ID） | $Y = \text{max\_y} - 500\text{ mm}$ | $Y = \text{max\_y} - 1,150\text{ mm}$ |
| **南側 (下方)** | **由左至右**（西向東: H $\to$ D） | ⬆️ **朝上（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右`（動態 ID） | $Y = \text{min\_y} + 500\text{ mm}$ | $Y = \text{min\_y} + 1,150\text{ mm}$ |
| **西側 (左側)** | **由上至下**（北向南: 8 $\to$ 1） | ➡️ **朝右（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右`（動態 ID） | $X = \text{min\_x} + 500\text{ mm}$ | $X = \text{min\_x} + 1,150\text{ mm}$ |
| **東側 (右側)** | **由下至上**（南向北: 5 $\to$ 8） | ⬅️ **朝左（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右`（動態 ID） | $X = \text{max\_x} - 500\text{ mm}$ | $X = \text{max\_x} - 1,150\text{ mm}$ |

---

## 📏 5. 間距與鎖點規格（5MM 三等距階梯標準）
依出圖比例（1:100 時 1mm = 100mm 模型空間）：
- **外層線（第 1 層）**：距離軸線圓圈底 **`5.0 mm`**（模型空間 $500\text{ mm}$）。
- **內層線（第 2 層）**：距離外層線 **`5.0 mm`**（精確符合型式參數 `尺寸線鎖點距離: 5.0000 mm`，模型空間 $500\text{ mm}$）。
- **端點輔助線（第 3 層）**：向內延伸 **`5.0 mm`**（精確符合型式參數 `輔助線長度: 5.0000 mm`，模型空間 $500\text{ mm}$）。

---

## 🛠️ 標準調用範例

```javascript
// Step 0. 動態查詢標註型式 (嚴禁寫死 TypeId)
const typesRes = await client.sendCommand('query_elements', { category: 'DimensionTypes' });
const dimTypes = typesRes.data?.DimensionTypes || typesRes.data?.Elements || [];

const typeUpRight = dimTypes.find(t => t.DimensionTypeName?.includes('柱心-上右') || t.Name?.includes('柱心-上右'));
const typeDownRight = dimTypes.find(t => t.DimensionTypeName?.includes('柱心-下右') || t.Name?.includes('柱心-下右'));

const typeIdUpRight = typeUpRight?.DimensionTypeId || typeUpRight?.Id || dimTypes[0]?.DimensionTypeId || dimTypes[0]?.Id;
const typeIdDownRight = typeDownRight?.DimensionTypeId || typeDownRight?.Id || dimTypes[0]?.DimensionTypeId || dimTypes[0]?.Id;

if (!typeUpRight) {
  console.warn('⚠️ 專案未找到 TABC 上右標註型式，動態降級使用:', dimTypes[0]?.DimensionTypeName || dimTypes[0]?.Name);
}

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

// 套用動態解析之上右型式 (若有效)
if (typeIdUpRight) {
  await client.sendCommand('change_element_type', {
    elementIds: [nTotal.data.DimensionId, nContinuous.data.DimensionId],
    typeId: typeIdUpRight
  });
}
```

---

## 🏛️ 立面圖專屬工具快速指引 (Elevation Dimensioning)

- **立面圖頂部柱心雙層標註**：呼叫 `auto_dimension_elevation_grids`
  - 尺寸線向量**由右至左**，5mm 短輔助線全數朝下 $\downarrow$（指向建築物），動態套用上右型式。
- **立面圖側邊樓層雙層標註**：呼叫 `auto_dimension_elevation_levels`
  - 尺寸線向量**由頂至底**，5mm 短輔助線全數朝右 $\rightarrow$（指向建築物），動態套用下右型式。
  - 外層總高程退縮 **30mm (圖紙)**，避開 `TRFL ▼ FL 2680` 等標示圈文字。

---
**維護者：** RevitMCP Customization Team

