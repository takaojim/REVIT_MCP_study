import fs from 'fs';

const content = `---
name: grid-column-dimension
description: "專屬柱間距與柱心連續標註標準工作流：自動在平面視圖建立雙層同一線段連續串接標註（String Dimension）、純原生 Grid 軸線參照、專屬上右/下右標註型式、朝向建物內側輔助線與 650mm 階梯鎖點。觸發條件：使用者提到標註柱心、柱間距、柱列尺寸、柱心標註、軸線標註、grid dimension、column dimension、柱心連續標註。"
---

# 🏛️ 專屬柱間距與柱心連續標註標準規範 (Grid Column Dimensioning SOP)

本技能為專屬建築平面圖「柱心間距標註」最高優先級標準規範。只要使用者要求「標註柱心」、「柱間距標註」、「柱列尺寸」、「軸線間距」等指令，**必須 100% 依循以下 5 大核心作業程序**。

---

## 📐 1. 全區外框基準與階梯插槽體系 (Global Envelope & Step Slots)
- **基準線定義**：一律以當前樓層或全區標準樓層之「**全區實體最大包絡線（Global Physical Envelope）**」為 Step 0 基準線。
- **標準階梯模矩**：依出圖比例（1:100 時標準模矩間距為 **$650.0\\text{ mm}$ / 圖紙 $6.5\\text{ mm}$**）。
- **雙層柱心定位規則**：
  - **氣泡齊頭線（Step N）**：即為軸號氣泡圓圈之**下緣基準線**。
  - **柱心總跨（Step N-1 / Tier 1）**：距離氣泡線往建物方向 **$650\\text{ mm}$（空一格）**。
  - **柱心連續（Step N-2 / Tier 2）**：距離總跨線往建物方向 **$650\\text{ mm}$（空一格）**。
  - **留白隔離帶（Step N-3）**：距離連續柱心線往建物方向 **$650\\text{ mm}$ 保留為空白**，嚴禁放置標註，使結構尺寸與建築隔間尺寸分流。

---

## ⚡ 2. 純原生 Grid 軸線參照（0 條輔助短細線）
- 必須直接使用 \`gridIds: [id1, id2, ...]\` 傳入原生 \`Grid\` 圖元參照給 \`create_dimension\` 工具。
- **嚴禁在圖面上產生 DetailCurves / DetailLines 輔助短細線**，保持圖面 100% 乾淨，且軸線變動時尺寸線自動連動。

---

## 🏷️ 3. 標註型式（Dimension Type）與文字方位規範
根據視圖四邊幾何方位與文字閱讀朝向，嚴格套用專屬柱心標註型式：
- **上方（北側）與 右側（東側）**：採用 **\`TABC-DIM_*/ S 2.5-柱心-上右\`**（文字向上/向右，端點空心點 1.5mm）
- **下方（南側）與 左側（西側）**：採用 **\`TABC-DIM_*/ S 2.5-柱心-下右\`**（文字向左/向下，端點空心點 1.5mm）

---

## 🧭 4. 繪製向量與輔助線延伸方向（100% 朝向建物內側）
為確保 \`固定尺寸線\`（5.0mm）之端點記號指向建築物本體，必須依幾何方位給定正確起訖向量：

| 方位 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) | 外圈位置 (Tier 1, Step N-1) | 內圈位置 (Tier 2, Step N-2) |
|:---|:---:|:---:|:---|:---|:---|
| **北側 (上方)** | **由右至左**（東向西: 4 $\\to$ 1 / A $\\to$ H） | ⬇️ **朝下（指向建物）** | \`TABC-DIM_*/ S 2.5-柱心-上右\` | $Y = \\text{TopY} - 650\\text{ mm}$ | $Y = \\text{TopY} - 1,300\\text{ mm}$ |
| **南側 (下方)** | **由左至右**（西向東: 1 $\\to$ 4 / H $\\to$ A） | ⬆️ **朝上（指向建物）** | \`TABC-DIM_*/ S 2.5-柱心-下右\` | $Y = \\text{BottomY} + 650\\text{ mm}$ | $Y = \\text{BottomY} + 1,300\\text{ mm}$ |
| **西側 (左側)** | **由上至下**（北向南: A $\\to$ D / 1 $\\to$ 8） | ➡️ **朝右（指向建物）** | \`TABC-DIM_*/ S 2.5-柱心-下右\` | $X = \\text{LeftX} + 650\\text{ mm}$ | $X = \\text{LeftX} + 1,300\\text{ mm}$ |
| **東側 (右側)** | **由下至上**（南向北: D $\\to$ A / 8 $\\to$ 1） | ⬅️ **朝左（指向建物）** | \`TABC-DIM_*/ S 2.5-柱心-上右\` | $X = \\text{RightX} - 650\\text{ mm}$ | $X = \\text{RightX} - 1,300\\text{ mm}$ |

---

## 🛠️ 5. 標準調用範例

\`\`\`javascript
// 1. 北側柱心標註 (以 2FL 為例)
await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [596080, 192066], // 4-1 軸 (Tier 1 總跨)
  startX: spanXMax, startY: TopY - 650.0,
  endX: spanXMin, endY: TopY - 650.0,
  dimensionTypeId: typeIdColumnUpRight
});

await client.sendCommand('create_dimension', {
  viewId: viewId,
  gridIds: [596080, 432630, 432966, 192066], // 4-3-2-1 軸 (Tier 2 連續)
  startX: spanXMax, startY: TopY - 1300.0,
  endX: spanXMin, endY: TopY - 1300.0,
  dimensionTypeId: typeIdColumnUpRight
});
\`\`\`
`;

fs.writeFileSync('.agents/skills/grid-column-dimension/SKILL.md', content, 'utf8');
console.log('Successfully written grid-column-dimension SKILL.md');
