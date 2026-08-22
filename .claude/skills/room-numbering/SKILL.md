---
name: room-numbering
description: "房間重新排序編號與批次自動編號工作流。預設採用『動線拓撲主從模式』（走廊 → 主空間/前室 → 內室/附屬浴廁連續成組編號），亦支援『純幾何坐標模式』。觸發條件：使用者提到房間編號、房間重新排序、room numbering、renumber rooms、自動編號、動線主從、從 F201 開始、只排 B1F 等需求時使用。優先工具：renumber_rooms_by_level、get_active_view、get_rooms_by_level。"
---

# 房間重新排序編號

使用此 Skill 時，先讀 `domain/room-numbering-workflow.md`，並遵守該 SOP 的動線主從判定、dry-run 預覽、交易寫入與驗證規則。

## 核心模式與編排原則

### 1. 預設模式：【動線拓撲主從模式】（Topology-First Suite Hierarchy）
- **核心邏輯**：空間編號以「動線可及性」為核心，凡具備主從或前後室從屬關係之單元（例如：套房的主寢室與專用衛浴、女浴前室與女浴室、辦公室與內側檔案室），一律**單元成組連續編號**（父空間在先、子空間緊隨在後）。
- **判定機制**：
  - **門動線關聯（Door Topology）**：透過門的 `FromRoom` 與 `ToRoom` 判定空間深度（走廊 Depth 0 $\rightarrow$ 主居室 Depth 1 $\rightarrow$ 專用浴廁 Depth 2）。子空間強制緊鄰父空間連續編號。
  - **空間開間包絡（Bay Envelope）**：若門拓撲未定義，以同一個垂直/水平開間（Bay）為單元，由進門方向（外側 $\rightarrow$ 內側）依序連號。
- **觸發關鍵字**：預設採用；或使用者提及 `動線`、`主從`、`動線拓撲`、`套房連號`、`進門順序`、`單元成組`。

### 2. 備用模式：【純幾何坐標模式】（Pure Coordinate Scan）
- **核心邏輯**：不考慮門的進出動線，嚴格依平面圖 $X, Y$ 坐標進行橫向或縱向網格掃描。
- **觸發關鍵字**：使用者明確指定 `純幾何`、`坐標掃描`、`橫向掃描`、`不考慮動線`。

---

## 工具優先序

1. 先用 `get_active_view` 重新錨定目前 Revit 狀態，回報目前視圖與樓層。
2. 目標樓層與起始號碼確認後，優先使用 `renumber_rooms_by_level`（支援 `mode: "topology" | "geometric"` 與 `dryRun`）。
3. 查閱房間狀態使用 `get_rooms_by_level`。
4. 交易內全面註冊 `SilentFailuresPreprocessor`，自動吞掉重複編號警告對話框，確保 100% 靜默執行。

---

## 標準 4 步驟流程

1. **Re-anchor**：
   - 呼叫 `get_active_view()` 確認視圖與樓層。
2. **Dry-run（預覽）**：
   - 執行 `renumber_rooms_by_level({ level, startNumber, dryRun: true })`。
   - 檢查房間清單、主從連號（如 `F239 女浴前室 ➔ F240 女浴室`）、起始與結束號碼是否合理。
3. **正式寫入**：
   - 使用者確認後執行 `renumber_rooms_by_level({ level, startNumber, dryRun: false })`。
   - 採單一 Transaction 或兩階段唯一暫存號碼寫入，防止中途衝突中斷。
4. **驗證**：
   - 呼叫 `get_rooms_by_level({ level })` 驗證更新後的號碼清單與筆數。

---

## 精準性規則

- 起始號碼必須以數字結尾，例如 `F201`、`B101`、`101`；系統會自動保留文字前綴並連續遞增。
- 未放置房間（`Area = 0` 或無邊界之明細表空房間）會自動排除或預先釋放號碼，絕不佔用有效房號區間。
- 嚴禁跳出「元素有重複編號值」警告對話框；所有重複性提示必須在背景由 `SilentFailuresPreprocessor` 自動吸收。

---

## 參考

- `domain/room-numbering-workflow.md`
- `domain/lessons.md`

