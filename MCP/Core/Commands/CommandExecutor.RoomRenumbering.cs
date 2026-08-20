using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Newtonsoft.Json.Linq;

// Revit 2025+ ElementId: int → long
#if REVIT2025_OR_GREATER
using IdType = System.Int64;
#else
using IdType = System.Int32;
#endif

namespace RevitMCP.Core
{
    public partial class CommandExecutor
    {
        /// <summary>
        /// 批次依空間座標由上到下、由左到右重新排序並編號房間
        /// </summary>
        private object RenumberRoomsByLevel(JObject parameters)
        {
            string levelName = parameters["level"]?.Value<string>();
            string startNumber = parameters["startNumber"]?.Value<string>();
            bool dryRun = parameters["dryRun"]?.Value<bool?>() ?? false;
            double yToleranceMm = parameters["yToleranceMm"]?.Value<double?>() ?? 3000.0;
            bool includeUnnamed = parameters["includeUnnamed"]?.Value<bool?>() ?? true;
            bool allowExistingConflicts = parameters["allowExistingNumberConflicts"]?.Value<bool?>() ?? false;

            if (string.IsNullOrEmpty(levelName))
                throw new Exception("請指定樓層名稱 (level)");
            if (string.IsNullOrEmpty(startNumber))
                throw new Exception("請指定起始房號 (startNumber)");

            // 解析起始房號的前綴與數字結尾，例如 "F201" -> prefix "F2", digits "01", width 2
            // 或 "B134" -> prefix "B", digits "134", width 3
            var match = Regex.Match(startNumber.Trim(), @"^(.*?)(\d+)$");
            if (!match.Success)
                throw new Exception($"起始房號 '{startNumber}' 必須以數字結尾 (例如 F201, B134)");

            string prefix = match.Groups[1].Value;
            string numDigitsStr = match.Groups[2].Value;
            int currentNum = int.Parse(numDigitsStr);
            int digitWidth = numDigitsStr.Length;

            Document doc = _uiApp.ActiveUIDocument.Document;
            Level level = FindLevel(doc, levelName, false);
            if (level == null)
                throw new Exception($"找不到樓層: {levelName}");

            // 收集該樓層所有已放置房間
            var allRoomsOnLevel = new FilteredElementCollector(doc)
                .OfCategory(BuiltInCategory.OST_Rooms)
                .WhereElementIsNotElementType()
                .Cast<Room>()
                .Where(r => r.LevelId == level.Id && r.Area > 0.0001)
                .ToList();

            if (allRoomsOnLevel.Count == 0)
                throw new Exception($"樓層 '{level.Name}' 找不到任何已放置的有效房間");

            var roomItems = new List<RoomSortItem>();
            foreach (var r in allRoomsOnLevel)
            {
                if (!includeUnnamed && string.IsNullOrWhiteSpace(r.Name))
                    continue;

                XYZ center = null;
                if (r.Location is LocationPoint lp)
                {
                    center = lp.Point;
                }
                else
                {
                    var bbox = r.get_BoundingBox(null);
                    if (bbox != null)
                        center = (bbox.Min + bbox.Max) * 0.5;
                }

                if (center == null)
                    continue;

                roomItems.Add(new RoomSortItem
                {
                    Room = r,
                    ElementId = r.Id.GetIdValue(),
                    Name = r.Name,
                    OldNumber = r.Number,
                    Area = Math.Round(r.Area * 0.09290304, 2),
                    CenterX = center.X * 304.8, // mm
                    CenterY = center.Y * 304.8, // mm
                });
            }

            // 排序邏輯：Y 由大到小（由上到下），以 yToleranceMm 分排；每排內 X 由小到大（由左到右）
            roomItems.Sort((a, b) => b.CenterY.CompareTo(a.CenterY));
            var rows = new List<List<RoomSortItem>>();

            foreach (var item in roomItems)
            {
                bool placed = false;
                foreach (var row in rows)
                {
                    double avgY = row.Average(r => r.CenterY);
                    if (Math.Abs(item.CenterY - avgY) <= yToleranceMm)
                    {
                        row.Add(item);
                        placed = true;
                        break;
                    }
                }
                if (!placed)
                    rows.Add(new List<RoomSortItem> { item });
            }

            // 排列各 row：由上到下
            rows.Sort((a, b) => b.Average(r => r.CenterY).CompareTo(a.Average(r => r.CenterY)));

            // 各 row 內：由左到右
            foreach (var row in rows)
            {
                row.Sort((a, b) => a.CenterX.CompareTo(b.CenterX));
            }

            var sortedItems = rows.SelectMany(r => r).ToList();

            // 指派新編號
            var plan = new List<object>();
            int seq = currentNum;
            foreach (var item in sortedItems)
            {
                string formattedNum = seq.ToString().PadLeft(digitWidth, '0');
                item.NewNumber = $"{prefix}{formattedNum}";
                plan.Add(new
                {
                    ElementId = item.ElementId,
                    Name = item.Name,
                    OldNumber = item.OldNumber,
                    NewNumber = item.NewNumber,
                    CenterX = Math.Round(item.CenterX),
                    CenterY = Math.Round(item.CenterY),
                    Area = item.Area
                });
                seq++;
            }

            if (dryRun)
            {
                return new
                {
                    Success = true,
                    DryRun = true,
                    Level = level.Name,
                    Count = sortedItems.Count,
                    StartNumber = sortedItems.FirstOrDefault()?.NewNumber,
                    EndNumber = sortedItems.LastOrDefault()?.NewNumber,
                    Rooms = plan,
                    Message = $"[Dry-Run 預覽] 樓層 '{level.Name}' 共有 {sortedItems.Count} 間房間，編號規劃：{sortedItems.FirstOrDefault()?.NewNumber} ~ {sortedItems.LastOrDefault()?.NewNumber}"
                };
            }

            // 正式寫入：使用 TransactionHelper (已註冊 SilentFailuresPreprocessor 自動吞掉重複編號警告)
            using (Transaction trans = TransactionHelper.Begin(doc, "批次房間重新編號"))
            {
                trans.Start();

                // 階段一：寫入唯一臨時編號避免中途衝突
                foreach (var item in sortedItems)
                {
                    string tempNum = $"_TMP_REN_{item.ElementId}";
                    item.Room.Number = tempNum;
                }

                // 階段二：依序寫入新編號
                foreach (var item in sortedItems)
                {
                    item.Room.Number = item.NewNumber;
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                DryRun = false,
                Level = level.Name,
                Count = sortedItems.Count,
                StartNumber = sortedItems.FirstOrDefault()?.NewNumber,
                EndNumber = sortedItems.LastOrDefault()?.NewNumber,
                Rooms = plan,
                Message = $"[成功寫入] 樓層 '{level.Name}' 共 {sortedItems.Count} 間房間已重新編號（{sortedItems.FirstOrDefault()?.NewNumber} ~ {sortedItems.LastOrDefault()?.NewNumber}）。警告已自動過濾。"
            };
        }

        private class RoomSortItem
        {
            public Room Room { get; set; }
            public IdType ElementId { get; set; }
            public string Name { get; set; }
            public string OldNumber { get; set; }
            public string NewNumber { get; set; }
            public double Area { get; set; }
            public double CenterX { get; set; }
            public double CenterY { get; set; }
        }
    }
}
