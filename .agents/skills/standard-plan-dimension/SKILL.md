---
name: standard-plan-dimension
description: 標準平面階梯標註與軸線整列系統：全自動讀取視圖比例與全區外框包絡（含外牆/結構柱/陽台/雨遮），統一將軸線四向齊頭延伸（配置 A：上側與右側開啟軸號圓圈），並自動建立上右雙層柱心尺寸、四向三層牆心標註（外牆總長/居室主隔間/走廊機能空間）、15CM主牆過濾與中庭內凹方案C標準工作流。觸發條件：標準標註、平面出圖標註、軸線整列、標準柱心標註、牆心標註、40mm基準標註、standard plan dimension、平面全自動標註。
---

# 標準平面階梯標註與軸線整列系統 (Standard Plan Dimension SOP)

本工作流程定義 Revit 建築平面視圖出圖的**最高幾何放樣標準與空間拓撲標註體系**。透過「**全區實體最大包絡線 (Global Physical Envelope)**」與「**等距階梯模矩 (Step Modules)**」，實現軸線齊頭對稱、雙層柱心標註、四向三層牆心標註、15CM 主牆精確過濾與中庭內凹區方案 C 的標準化出圖。

## Lessons Reference
- **L-002**：標註必須匹配正確的視圖 ID，嚴禁在 3D 視圖建立平面標註。詳見 `domain/lessons.md`。
- **L-031**：建築模型圖元查詢原則，`query_elements` 預設上限為 10,000 筆。詳見 `domain/lessons.md`。
- **L-032**：標註型式前置動態查詢與降級防呆原則。嚴禁寫死 TypeId，執行標註前必須先查詢專案既有 DimensionTypes。詳見 `domain/lessons.md`。

---

## 🔍 Step 0：標註型式前置動態查詢與防呆機制 (Preflight DimensionType Check - 必做)

執行任何柱心或外牆標註前，**絕對嚴禁在程式碼中寫死 (Hardcode) 任何靜態 TypeId**！
1. 先呼叫 `query_elements({ category: "DimensionTypes" })` 查詢專案現有標註型式。
2. 優先匹配包含 `柱心-上右`（北/東）與 `柱心-下右`（南/西）或 `TABC-DIM_*` 型式。
3. 若專案未載入 TABC 樣板，模糊匹配 `柱心`、`對齊` (Aligned)、`Linear` 等線性型式，或安全降級使用既有型式並提示警告。

---

## 📐 1. 核心階梯模矩與幾何層級 (Ladder Hierarchy)

所有尺寸放樣一律以當前樓層的「**全區實體最大包絡線（Global Physical Envelope）**」為基準線（Step 0），並依出圖比例（1:100 時標準模矩間距為 **$650.0\text{ mm}$ / 圖紙 $6.5\text{ mm}$**）展開 8~9 個等距階梯：

```
[最外側] Step 9 (+5,850 mm) ── 🔵 軸線氣泡圓標基準 (配置 A: 上/右側開啟)
           │
         Step 8 (+5,200 mm) ── 柱心第 1 層：全區柱心總跨 (A~H / 1~8 軸) [TABC-DIM_*/ S 2.5-柱心-上右]
           │
         Step 7 (+4,550 mm) ── 柱心第 2 層：各柱間距連續串接標註
           │
         Step 6 (+3,900 mm) ── ⬜ 【刻意空一格 650mm 視覺留白分隔帶】
           │
         Step 5 (+3,250 mm) ── 🟩 牆心第 1 層：實體外牆整體總長 [TABC-DIM_dot 牆心] (🌟 四向等距同心)
           │
         Step 4 (+2,600 mm) ── 🟩 牆心第 2 層：綠線截面──居室主要大開間 15CM 主隔間牆心
           │
         Step 3 (+1,950 mm) ── 🟪 牆心第 3 層：紫線截面──走廊/浴廁/梯間/機能 15CM 細部牆心
           │
[最內側] Step 0 (    0 mm) ── 🔴 建築物實體外牆紅線 (Physical Envelope)
```

---

## 🧭 2. 四向排布與同心鏡射規範 (Configuration A & Mirroring)

### (1) 軸號氣泡 (Grid Bubble) 配置
* **上方 (North) & 右側 (East)**：開啟氣泡圓標，承載最外側雙層柱心標註（Step 7~8）。
* **下方 (South) & 左側 (West)**：隱藏氣泡圓標，由 Step 5（外牆總長）向內側 Step 3 靠攏鏡射放置，**消除半空懸掛感**。

### (2) 四向標註規格表

| 方向 / 側邊 | 柱心標註 (Step 7~8) | 視覺留白 (Step 6) | 牆心第 1 層 (Step 5) | 牆心第 2 層 (Step 4) | 牆心第 3 層 (Step 3) |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **上方 (North)** | ⭕ 雙層柱心 (上右型式) | ⬜ 空白 650mm | **北外牆總長** | 居室主隔間牆心 (綠線) | 走廊/浴廁機能牆心 (紫線) |
| **右側 (East)** | ⭕ 雙層柱心 (上右型式) | ⬜ 空白 650mm | **東外牆總長** | 東翼居室主隔間 (綠線) | 走廊/服務核機能牆心 (紫線) |
| **下方 (South)** | ❌ 無 (留白) | ─ | **南翼實體外牆總長** | 南翼居室主隔間 (綠線) | 南翼走廊/浴廁隔間 (紫線) |
| **左側 (West)** | ❌ 無 (留白) | ─ | **西側全區外牆總長** | 西側居室主隔間 (綠線) | 西側走廊/梯間隔間 (紫線) |

---

## 🔍 3. 牆體過濾與幾何計算三大原則

### 原則 1：嚴格過濾 $\ge 15\text{ cm}$ 主牆 (Wall Thickness Filter)
* **判斷條件**：`Wall.Thickness >= 140 mm`（包含 RC15cm、RC20cm、RC25cm、主隔間輕隔間牆）。
* **嚴格排除**：小於 140mm 的牆體，包括 **RC12cm 管道包板**、**矮牆**、**10mm 磁磚粉刷層** 與 **門斗薄牆**，避免產生細碎無意義跳點。

### 原則 2：外牆總長（Layer 1）對齊最靠近側實體端點
* Layer 1 尺寸線的兩端，必須對齊**「該立面/該分翼實際存在的實體外牆端點」**，不得跨越虛空或延伸至無建築本體之露台。

### 原則 3：中庭/露台內凹區採用「方案 C（外側構件外緣基準 ＋ 退雙間距階梯放樣）」
* 當建築具有 L 型或 U 型中庭內凹時：
  * **柱心標註**：維持在全區最外側（上方 North 與右側 East）。
  * **內凹外牆（中庭開闊區放樣）**：
    * **Step 0 基準面**：一律以最外側之實體構件外緣（包含外牆面、結構柱外皮、雨遮/陽台）作為 Step 0 基準線。
    * **視覺留白（退兩個間距）**：為避免尺寸線壓在走廊牆面、凸出柱或陽台斜牆上，向中庭中空開闊區預留 **2 個模矩間距（$2 \times 650\text{ mm} = 1,300\text{ mm}$）** 作為視覺留白。
    * **三層階梯放樣**：
      * **Layer 3（紫線 - 走廊/梯間/浴廁 15cm 隔間）**：距實體外緣 **Step 3 ($+1,950\text{ mm}$)**。
      * **Layer 2（綠線 - 居室主要 15cm 主隔間）**：距實體外緣 **Step 4 ($+2,600\text{ mm}$)**。
      * **Layer 1（紅線 - 向中庭實體外牆整體總長）**：距實體外緣 **Step 5 ($+3,250\text{ mm}$)**。
    * **端點收齊**：尺寸線起訖端點一律收齊於外牆轉角與外緣邊界，嚴禁跨越中空區或往室內斜牆延伸。

---

## 🎨 4. 標註型式 (Dimension Type) 標準對照

| 標註類別 | 端點標記 (Tick Mark) | 專屬標註型式名稱 | 說明 |
| :--- | :---: | :--- | :--- |
| **柱心尺寸** | 斜線 (Slash) | `TABC-DIM_*/ S 2.5-柱心-上右` | 虛擬結構軸網基準 |
| **牆心尺寸** | 實心圓點 (Dot) | `TABC-DIM_dot 牆心` (ID: `2251126`) | 實體建築牆心基準 |

---

## 💻 5. 標準批次執行工作流 (Node.js Reference)

```javascript
import { RevitSocketClient } from './socket.js';

<<<<<<< HEAD
export async function runStandardPlanDimension(viewId) {
  const client = new RevitMcpClient();
  
  // 0. 動態解析標註型式
  const typesRes = await client.sendCommand('query_elements', { category: 'DimensionTypes' });
  const dimTypes = typesRes.data?.DimensionTypes || typesRes.data?.Elements || [];
  const typeUpRight = dimTypes.find(t => t.DimensionTypeName?.includes('柱心-上右') || t.Name?.includes('柱心-上右'));
  const typeIdUpRight = typeUpRight?.DimensionTypeId || typeUpRight?.Id || dimTypes[0]?.DimensionTypeId || dimTypes[0]?.Id;

  // 1. 取得視圖資訊與 Scale
  const viewRes = await client.sendCommand('get_active_view', {});
  const scale = viewRes.data.Scale || 100; // 例如 100
  
  // 2. 取得全區外框實體包絡
  const envelope = await client.sendCommand('get_floor_envelope', { 
    viewId: viewId, 
    includeBalconies: true, 
    includeRoofs: true 
  });
  const { minX, maxX, minY, maxY } = envelope.data;

  // 3. 換算 40mm / 35mm / 30mm / 25mm 偏移量 (單位: mm)
  const offset40 = 40 * scale;
  const offset35 = 35 * scale;
  const offset30 = 30 * scale;
  const offset25 = 25 * scale;

  // 4. 取得並排序軸線
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids' });
  // 分為 verticalGrids (依 X 排序) 與 horizontalGrids (依 Y 排序)
  
  // 5. 建立上方雙層標註 (North)
  // 第 1 層 (總長 Y = maxY + offset35)
  const dim1 = await client.sendCommand('create_dimension', {
=======
export async function executeStandardPlanDimensions(viewId) {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();

  // 1. 軸線齊頭整列 (9 間距 5,850mm，配置 A)
  const alignRes = await client.sendCommand('align_plan_grids', {
>>>>>>> feature/grid-dimension-step-wip
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

<<<<<<< HEAD
  // 第 2 層 (柱間距 Y = maxY + offset30)
  const dim2 = await client.sendCommand('create_dimension', {
    viewId: viewId,
    gridIds: allVGridIdsSorted,
    startX: maxX, startY: maxY + offset30,
    endX: minX, endY: maxY + offset30
  });

  // 套用型式
  if (typeIdUpRight) {
    await client.sendCommand('change_element_type', {
      elementIds: [dim1.data.DimensionId, dim2.data.DimensionId],
      typeId: typeIdUpRight
    });
  }
=======
  // 2. 上方與右側雙層柱心標註 (Type: TABC-DIM_*/ S 2.5-柱心-上右)
  // ...

  // 3. 四向三層牆心標註 (Type: TABC-DIM_dot 牆心, Thickness >= 140mm)
  // 西側 (全跨)、南側 (南翼)、東側 (東翼)、北側 (北翼)
  // ...

  // 4. 中庭內凹區 (方案 C: 緊貼內側實體外牆階梯放樣)
  // ...

  await client.disconnect();
>>>>>>> feature/grid-dimension-step-wip
}
```

