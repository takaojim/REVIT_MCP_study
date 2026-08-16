---
name: auto-dimension
description: "自動標註尺寸：包含『柱間距/柱心連續標註標準工作流』與『Ray-Casting / BoundingBox / Wall-Batch』房間、走廊、MEP、牆段標註。觸發條件：使用者提到標註、柱心、柱間距、尺寸、dimension、annotation、淨寬、淨高、measurement、自動標註、批次標註、自動標尺寸、外牆總尺寸、串接尺寸。工具：create_dimension、change_element_type、create_dimension_by_ray、create_dimension_by_bounding_box、auto_dimension_walls、get_room_info。"
---

# 自動標註尺寸與柱間距標註規範

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。位置線用 BoundingBox 中心 `(max+min)/2`。詳見 `domain/lessons.md`。

---

## 🏛️ 柱間距與柱心連續標註標準工作流（Grid Column Dimensioning SOP）

當使用者要求「標註柱心」、「柱間距標註」、「柱列尺寸」時，**必須 100% 依循以下標準作業程序**：

### 1. 標註架構（雙層連續串接標註 String Dimension）
- **同一線段**：所有跨距標註必須為單一連續標註圖元（`SegmentsCount >= 2`），點選時為一整條連續線，**嚴禁拆成不連續的短線段**。
- **雙層標註**：
  - **外層（第 1 層）**：全棟/各翼總長跨度標註（1 跨總長）。
  - **內層（第 2 層）**：柱心連續間距標註（同一線段串接所有軸線）。

### 2. 純原生 Grid 軸線參照（0 條輔助短細線）
- 必須直接使用 `gridIds: [id1, id2, ...]` 傳入原生 `Grid` 圖元參照。
- **嚴禁使用 DetailCurves / DetailLines 輔助線**，圖面必須保持 100% 乾淨。

### 3. 標註型式（Dimension Type）與文字方位規範
根據視圖四邊方位與文字閱讀朝向，嚴格套用專屬柱心型式：
- **上方（北側）與 右側（東側）**：採用 **`TABC-DIM_*/ S 2.5-柱心-上右`**
- **下方（南側）與 左側（西側）**：採用 **`TABC-DIM_*/ S 2.5-柱心-下右`**

### 4. 繪製向量與輔助線延伸方向（100% 朝向建物內側）
為了讓 `固定尺寸線`（5.0mm）之端點記號正確朝向建築物內側，必須依幾何方位給定正確起訖向量：
| 方位 | 尺寸基準線起訖方向 | 輔助線延伸指向 | 標註型式 (Dimension Type) |
|:---|:---:|:---:|:---|
| **北側 (上方)** | **由右至左**（東向西: A $\to$ G） | ⬇️ **朝下（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **東側 (右側)** | **由下至上**（南向北: 5 $\to$ 7） | ⬅️ **朝左（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-上右` |
| **南側 (下方)** | **由左至右**（西向東: G $\to$ D） | ⬆️ **朝上（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |
| **西側 (左側)** | **由上至下**（北向南: 7 $\to$ 1） | ➡️ **朝右（指向建物）** | `TABC-DIM_*/ S 2.5-柱心-下右` |

### 5. 間距與鎖點規格（5MM 三等距階梯標準）
依出圖比例（1:100 時 1mm = 100mm 模型空間）：
- **外層線（第 1 層）**：距離軸線圓圈底 **`5.0 mm`**（模型空間 $500\text{ mm}$）。
- **內層線（第 2 層）**：距離外層線 **`5.0 mm`**（精確符合型式參數 `尺寸線鎖點距離: 5.0000 mm`，模型空間 $500\text{ mm}$）。
- **端點輔助線（第 3 層）**：向內延伸 **`5.0 mm`**（精確符合型式參數 `輔助線長度: 5.0000 mm`，模型空間 $500\text{ mm}$）。

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
