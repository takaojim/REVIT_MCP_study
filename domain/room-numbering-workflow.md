---
name: room-numbering-workflow
description: "Revit 房間重新排序編號 SOP。規範如何依樓層取得 Room、依動線拓撲主從關係（或純幾何坐標）建立空間順序、從使用者指定起始號碼批次寫入房間編號，並全面使用 SilentFailuresPreprocessor 避免重複編號警示彈窗。"
metadata:
  version: "1.2"
  updated: "2026-08-20"
  created: "2026-04-02"
  contributors:
    - "Codex"
    - "Antigravity"
  references: []
  related:
    - lessons.md
    - session-context-guard.md
  referenced_by:
    - "room-numbering"
  tags: [room-numbering, renumber, rooms, Revit, batch, dry-run, topology, suite-hierarchy, 房間編號, 重新排序, 動線主從]
---

# 房間重新排序編號工作流 SOP

## 1. 目的

將指定樓層之 Revit Rooms 依建築動線主從邏輯（或平面圖坐標位置）重新排序，並批次指派連續房間編號。
適用於：
- 「將 2FL 房間依動線主從關係重新編號，從 F201 開始」
- 「把 3FL 房間重新編號」
- 「room numbering / renumber rooms」
- 「先 dry-run 看順序，再正式寫入」

---

## 2. 雙模式架構

### 2.1 模式一：【動線拓撲主從模式】（預設模式）
- **空間從屬原則**：
  凡經由特定房間才能進入之內部空間（如：主寢室內的專屬衛浴、女浴前室內之女浴室、辦公室內之檔案庫），判定為該單元之子空間。
- **編號連號原則**：
  父空間（主）與子空間（從）必須**連續成組編號**（例如：`F239 女浴前室 ➔ F240 女浴室`），嚴禁被其他橫排空間拆散跳號。
- **動線判定鏈**：
  1. **門拓撲（Door Adjacency）**：分析門的 `FromRoom` 與 `ToRoom` 建立連通樹（Corridor Depth 0 $\rightarrow$ Parent Depth 1 $\rightarrow$ Child Depth 2）。
  2. **開間包絡（Bay Envelope Fallback）**：若門無 Room 關聯，以同一個垂直/水平結構開間為單位，由進門外側往內側連號。

### 2.2 模式二：【純幾何坐標模式】（手動指定）
- 依平面圖幾何坐標 $X, Y$ 進行機械式橫向或縱向掃描。僅在使用者明確指定「純幾何」或「不考慮動線」時啟用。

---

## 3. 輸入參數

| 參數 | 來源 | 說明 |
| :--- | :--- | :--- |
| `level` | 使用者指定或工具查詢 | 目標樓層（如 `2FL`、`B1F`） |
| `startNumber` | 使用者指定 | 起始房號（必須以數字結尾，如 `F201`、`B101`） |
| `mode` | 使用者指定或預設 | `"topology"`（動線主從，預設）或 `"geometric"`（純幾何） |
| `dryRun` | Agent 控制 | 預設先 `true` 預覽，確認後再 `false` 寫入 |
| `includeUnnamed` | 使用者指定或預設 | 是否包含未命名但已放置之房間（預設 `true`） |

---

## 4. 標準作業步驟

### 4.1 狀態錨定（Re-anchor）
執行任何寫入前，先呼叫 `get_active_view()` 確認目前模型連線與目標樓層。

### 4.2 未放置房間編號釋放（Conflict Isolation）
若專案中存在未放置（Unplaced / `Area = 0`）且已佔用目標號碼區間之房間，先將其房號改為暫存格式（如 `_UNP_F201_...`），避免與已放置房間產生重複編號衝突。

### 4.3 安全預覽（Dry-Run）
呼叫 `renumber_rooms_by_level({ level, startNumber, dryRun: true })` 產出預覽清單，檢查：
- 樓層與已放置房間數量
- 起始與結束號碼
- 主從單元是否連號（如前室與內室相鄰）

### 4.4 正式寫入（Batch Write）
確認無誤後執行寫入：
- 使用 `TransactionHelper.Begin(doc, "批次房間重新編號")`。
- 內部註冊 `SilentFailuresPreprocessor`，自動過濾並吸收 Warning 提示框。
- 採單一 Transaction 或兩階段暫存唯一號碼，確保 100% 靜默且若失敗即自動 Rollback。

### 4.5 驗證（Verify）
呼叫 `get_rooms_by_level({ level })` 驗證全樓層房間編號清單與筆數一致性。

---

## 5. 相關規範

- `domain/lessons.md`
- `domain/session-context-guard.md`
