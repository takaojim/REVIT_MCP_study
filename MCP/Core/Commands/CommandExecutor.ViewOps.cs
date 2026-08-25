using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;

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
        /// 重新命名視圖（包含剖面圖、平面圖等）
        /// </summary>
        private object RenameView(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            string newName = parameters["newName"]?.Value<string>();

            if (string.IsNullOrEmpty(newName))
                throw new Exception("請指定新的視圖名稱");

            Element elem = doc.GetElement(new ElementId(viewId));
            if (elem == null)
                throw new Exception($"找不到元素 ID: {viewId}");

            View view = elem as View;
            if (view == null)
            {
                // 如果選取的元素是剖面標記等非 View 物件，利用其與視圖同名的特性，在模型中尋找同名的 View 物件
                string viewName = elem.Name;
                view = new FilteredElementCollector(doc)
                    .OfClass(typeof(View))
                    .Cast<View>()
                    .FirstOrDefault(v => v.Name == viewName);
            }

            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}，且無法對應到同名的視圖物件");

            using (Transaction trans = new Transaction(doc, "重新命名視圖"))
            {
                trans.Start();
                view.Name = newName;
                trans.Commit();
            }

            return new
            {
                ViewId = viewId,
                NewName = newName,
                Message = $"成功將視圖重新命名為: {newName}"
            };
        }

        /// <summary>
        /// 調整剖面視圖的網格線 (Grids) 與樓層線 (Levels) 2D 範圍與顯示
        /// </summary>
        private object AdjustSectionDatums(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            // 讀取傳入的視圖 ID 陣列
            JArray viewIdsArray = parameters["viewIds"] as JArray;
            if (viewIdsArray == null || viewIdsArray.Count == 0)
            {
                return new { Success = false, Message = "未提供有效的 viewIds 參數。" };
            }

            var processedViews = new List<string>();
            var errors = new List<string>();

            using (Transaction trans = new Transaction(doc, "自動調整剖面基準線"))
            {
                trans.Start();

                foreach (var token in viewIdsArray)
                {
                    try
                    {
                        IdType val = token.Value<IdType>();
                        ElementId id = new ElementId(val);
                        Element elem = doc.GetElement(id);
                        if (elem == null) continue;

                        // 嘗試尋找/轉為視圖
                        View view = elem as View;
                        if (view == null)
                        {
                            // 容錯：若傳入的是剖面標記，利用名稱尋找同名視圖
                            string name = elem.Name;
                            view = new FilteredElementCollector(doc)
                                .OfClass(typeof(View))
                                .Cast<View>()
                                .FirstOrDefault(v => v.Name == name && v.ViewType == ViewType.Section);
                        }

                        if (view == null)
                        {
                            errors.Add($"Element ID {val} 無法對應至剖面視圖。");
                            continue;
                        }

                        // 里程碑 2：自動判定並啟用裁剪框，取得邊界幾何
                        BoundingBoxXYZ cropBox = EnsureAndGetCropBox(view);
                        if (cropBox == null)
                        {
                            errors.Add($"視圖 {view.Name} 無法取得 CropBox 邊界資訊。");
                            continue;
                        }

                        double minX = cropBox.Min.X * 304.8;
                        double maxX = cropBox.Max.X * 304.8;
                        double minY = cropBox.Min.Y * 304.8;
                        double maxY = cropBox.Max.Y * 304.8;

                        // 里程碑 3：調整網格線 (Grids) 的 2D 範圍與氣泡
                        AdjustGridsInView(doc, view, cropBox, GetViewTransform(view));

                        // 里程碑 4：調整樓層線 (Levels) 的 2D 範圍（動態長度適應）與氣泡
                        AdjustLevelsInView(doc, view, cropBox, GetViewTransform(view));

                        processedViews.Add($"{view.Name} (Crop Box X: {minX:F0} ~ {maxX:F0}, Y: {minY:F0} ~ {maxY:F0} mm)");
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"處理視圖時發生錯誤: {ex.Message}");
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = errors.Count == 0,
                ProcessedCount = processedViews.Count,
                ProcessedViews = processedViews,
                Errors = errors
            };
        }

        /// <summary>
        /// 取得視圖在世界座標中的 Transform (適用各版本 Revit)
        /// </summary>
        private Transform GetViewTransform(View view)
        {
            Transform transform = Transform.Identity;
            transform.BasisX = view.RightDirection;
            transform.BasisY = view.UpDirection;
            transform.BasisZ = view.ViewDirection;
            transform.Origin = view.Origin;
            return transform;
        }

        /// <summary>
        /// 確保視圖啟用裁剪框，並回傳 CropBox XYZ
        /// </summary>
        private BoundingBoxXYZ EnsureAndGetCropBox(View view)
        {
            if (view == null) return null;

            if (!view.CropBoxActive)
            {
                view.CropBoxActive = true;
                view.CropBoxVisible = true; // 同意自動啟用，並設為可見以方便除錯與出圖確認
            }

            return view.CropBox;
        }

        /// <summary>
        /// 調整剖面視圖內 Grids 的 2D 範圍與氣泡顯示
        /// </summary>
        private void AdjustGridsInView(Document doc, View view, BoundingBoxXYZ cropBox, Transform transform)
        {
            var grids = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Grid))
                .Cast<Grid>()
                .ToList();

            double offsetFeet = 150.0 / 304.8; // 150 mm 轉為英尺
            Transform invTrans = transform.Inverse;

            foreach (var grid in grids)
            {
                try
                {
                    // 確保將端點切換成視圖特有的 2D 範圍
                    grid.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                    grid.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                    IList<Curve> curves = grid.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                    if (curves == null || curves.Count == 0) continue;

                    Curve curve = curves[0];
                    XYZ gP0_world = curve.GetEndPoint(0);
                    XYZ gP1_world = curve.GetEndPoint(1);

                    // 轉為視圖局部座標進行上下判定
                    XYZ gP0_local = invTrans.OfPoint(gP0_world);
                    XYZ gP1_local = invTrans.OfPoint(gP1_world);

                    bool p0IsTop = gP0_local.Y > gP1_local.Y;
                    XYZ top_local = p0IsTop ? gP0_local : gP1_local;
                    XYZ bottom_local = p0IsTop ? gP1_local : gP0_local;

                    // 上下端點垂直對齊 Crop Box 並延伸 150mm
                    XYZ newTop_local = new XYZ(top_local.X, cropBox.Max.Y + offsetFeet, top_local.Z);
                    XYZ newBottom_local = new XYZ(bottom_local.X, cropBox.Min.Y - offsetFeet, bottom_local.Z);

                    XYZ newTop_world = transform.OfPoint(newTop_local);
                    XYZ newBottom_world = transform.OfPoint(newBottom_local);

                    // 重新指派 2D 線段，起點設為下方，終點設為上方
                    Line newCurve = Line.CreateBound(newBottom_world, newTop_world);
                    grid.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);

                    // 設定氣泡顯示：下方隱藏，上方顯示
                    grid.HideBubbleInView(DatumEnds.End0, view);
                    grid.ShowBubbleInView(DatumEnds.End1, view);
                }
                catch (Exception)
                {
                    // 容錯，不干擾其他 Grid 的處理
                }
            }
        }

        /// <summary>
        /// 調整剖面視圖內 Levels 的 2D 範圍（基於字串長度動態適應）與氣泡顯示
        /// </summary>
        private void AdjustLevelsInView(Document doc, View view, BoundingBoxXYZ cropBox, Transform transform)
        {
            var levels = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .ToList();

            Transform invTrans = transform.Inverse;
            double viewScale = view.Scale;

            // 基礎字元長度估算參數（公釐）
            double basePaperWidth = 10.0; // 氣泡本身的基本物理寬度
            double charPaperWidth = 2.2;  // 每個字元的平均估估物理寬度

            foreach (var level in levels)
            {
                try
                {
                    // 確保將端點切換成視圖特有的 2D 範圍
                    level.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                    level.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                    IList<Curve> curves = level.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                    if (curves == null || curves.Count == 0) continue;

                    Curve curve = curves[0];
                    XYZ lP0_world = curve.GetEndPoint(0);
                    XYZ lP1_world = curve.GetEndPoint(1);

                    // 轉為視圖局部座標進行左右判定
                    XYZ lP0_local = invTrans.OfPoint(lP0_world);
                    XYZ lP1_local = invTrans.OfPoint(lP1_world);

                    bool p0IsLeft = lP0_local.X < lP1_local.X;
                    XYZ left_local = p0IsLeft ? lP0_local : lP1_local;
                    XYZ right_local = p0IsLeft ? lP1_local : lP0_local;

                    // 依樓層名稱長度動態計算模型偏移量（英尺）
                    string levelName = level.Name ?? "";
                    // 估算此樓層名稱與高度文字加總長度（Revit 預設可能顯示: 名稱 + 高度值）
                    // 這裡取 levelName 長度，並多給予安全緩衝
                    double paperWidth = basePaperWidth + (levelName.Length * charPaperWidth);
                    double offsetFeet = (paperWidth * viewScale) / 304.8;

                    // 左右端點水平對齊 Crop Box 並向外延伸動態計算後的 offset
                    XYZ newLeft_local = new XYZ(cropBox.Min.X - offsetFeet, left_local.Y, left_local.Z);
                    XYZ newRight_local = new XYZ(cropBox.Max.X + offsetFeet, right_local.Y, right_local.Z);

                    XYZ newLeft_world = transform.OfPoint(newLeft_local);
                    XYZ newRight_world = transform.OfPoint(newRight_local);

                    // 重新指派 2D 線段，起點設為左側，終點設為右側
                    Line newCurve = Line.CreateBound(newLeft_world, newRight_world);
                    level.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);

                    // 雙側均顯示氣泡
                    level.ShowBubbleInView(DatumEnds.End0, view);
                    level.ShowBubbleInView(DatumEnds.End1, view);
                }
                catch (Exception)
                {
                    // 容錯，不干擾其他 Level 的處理
                }
            }
        }

        /// <summary>
        /// 平面視圖軸線四向齊頭整列 (Plan Grid Alignment) - 支援實體模型包絡 (外牆/陽台/雨遮/柱/欄杆)
        /// </summary>
        private object AlignPlanGrids(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewIdParam = parameters["viewId"]?.Value<IdType>() ?? 0;
            View view = viewIdParam == 0
                ? doc.ActiveView
                : doc.GetElement(viewIdParam.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewIdParam}");

            double stepCount = parameters["stepCount"]?.Value<double>() ?? 9.0;
            double stepMm = parameters["stepMm"]?.Value<double>() ?? 650.0;
            double scaleRatio = view.Scale > 0 ? (view.Scale / 100.0) : 1.0;
            double defaultOffsetMm = stepCount * stepMm * scaleRatio;

            double offsetMm = parameters["offsetMm"]?.Value<double>() ?? defaultOffsetMm;
            bool showAllBubbles = parameters["showAllBubbles"]?.Value<bool>() ?? false;
            bool usePhysicalEnvelope = parameters["usePhysicalEnvelope"]?.Value<bool>() ?? true;

            var grids = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Grid))
                .Cast<Grid>()
                .ToList();

            if (grids.Count < 2)
            {
                grids = new FilteredElementCollector(doc)
                    .OfClass(typeof(Grid))
                    .Cast<Grid>()
                    .ToList();
            }

            if (grids.Count < 2)
                throw new Exception($"視圖 {view.Name} 中的軸線數量不足");

            Transform transform = view.CropBox?.Transform;
            if (transform == null)
            {
                transform = Transform.Identity;
                transform.BasisX = view.RightDirection.Normalize();
                transform.BasisY = view.UpDirection.Normalize();
                transform.BasisZ = view.ViewDirection.Normalize();
                transform.Origin = view.Origin;
            }
            Transform invTrans = transform.Inverse;

            var vertGrids = new List<(Grid grid, double uProj)>();
            var horizGrids = new List<(Grid grid, double vProj)>();

            foreach (var g in grids)
            {
                Curve c = g.Curve;
                XYZ ep0 = invTrans.OfPoint(c.GetEndPoint(0));
                XYZ ep1 = invTrans.OfPoint(c.GetEndPoint(1));
                XYZ dir = (ep1 - ep0).Normalize();

                double dotUp = Math.Abs(dir.Y);
                double dotRight = Math.Abs(dir.X);

                if (dotUp >= dotRight)
                {
                    double u = (ep0.X + ep1.X) / 2.0;
                    vertGrids.Add((g, u));
                }
                else
                {
                    double v = (ep0.Y + ep1.Y) / 2.0;
                    horizGrids.Add((g, v));
                }
            }

            if (vertGrids.Count == 0 || horizGrids.Count == 0)
                throw new Exception($"視圖 {view.Name} 需同時具備垂直與水平軸線");

            vertGrids.Sort((a, b) => a.uProj.CompareTo(b.uProj));
            horizGrids.Sort((a, b) => b.vProj.CompareTo(a.vProj));

            double minGridX = vertGrids.First().uProj;
            double maxGridX = vertGrids.Last().uProj;
            double minGridY = horizGrids.Last().vProj;
            double maxGridY = horizGrids.First().vProj;

            IdType? refViewIdVal = parameters["referenceViewId"]?.Value<IdType>();
            View envelopeSourceView = view;
            if (refViewIdVal.HasValue && refViewIdVal.Value != 0)
            {
                var customRef = doc.GetElement(refViewIdVal.Value.ToElementId()) as View;
                if (customRef != null)
                {
                    envelopeSourceView = customRef;
                }
            }

            // 計算實體模型外框包絡 (外牆、陽台、雨遮、結構柱、結構梁、欄杆、屋頂等)
            double envMinX = double.MaxValue, envMaxX = double.MinValue;
            double envMinY = double.MaxValue, envMaxY = double.MinValue;
            bool foundPhysical = false;
            int physicalElementCount = 0;

            if (parameters["customEnvelope"] is JObject customEnv)
            {
                double? cMinX = customEnv["minX"]?.Value<double>();
                double? cMaxX = customEnv["maxX"]?.Value<double>();
                double? cMinY = customEnv["minY"]?.Value<double>();
                double? cMaxY = customEnv["maxY"]?.Value<double>();
                if (cMinX.HasValue && cMaxX.HasValue && cMinY.HasValue && cMaxY.HasValue)
                {
                    envMinX = cMinX.Value / 304.8;
                    envMaxX = cMaxX.Value / 304.8;
                    envMinY = cMinY.Value / 304.8;
                    envMaxY = cMaxY.Value / 304.8;
                    foundPhysical = true;
                }
            }
            else if (usePhysicalEnvelope)
            {
                var modelCategories = new BuiltInCategory[]
                {
                    BuiltInCategory.OST_Walls,
                    BuiltInCategory.OST_Floors,
                    BuiltInCategory.OST_Roofs,
                    BuiltInCategory.OST_StructuralColumns,
                    BuiltInCategory.OST_StructuralFraming,
                    BuiltInCategory.OST_Columns,
                    BuiltInCategory.OST_GenericModel,
                    BuiltInCategory.OST_Stairs,
                    BuiltInCategory.OST_Railings,
                    BuiltInCategory.OST_CurtainWallPanels,
                    BuiltInCategory.OST_CurtainWallMullions,
                    BuiltInCategory.OST_Fascia,
                    BuiltInCategory.OST_EdgeSlab
                };

                var catFilter = new ElementMulticategoryFilter(modelCategories);
                var modelElements = new FilteredElementCollector(doc, envelopeSourceView.Id)
                    .WherePasses(catFilter)
                    .WhereElementIsNotElementType()
                    .ToElements();

                foreach (var elem in modelElements)
                {
                    BoundingBoxXYZ bbox = elem.get_BoundingBox(envelopeSourceView);
                    if (bbox == null)
                    {
                        bbox = elem.get_BoundingBox(null);
                    }
                    if (bbox == null || bbox.Min == null || bbox.Max == null) continue;

                    XYZ[] corners = new XYZ[]
                    {
                        new XYZ(bbox.Min.X, bbox.Min.Y, bbox.Min.Z),
                        new XYZ(bbox.Min.X, bbox.Max.Y, bbox.Min.Z),
                        new XYZ(bbox.Max.X, bbox.Min.Y, bbox.Min.Z),
                        new XYZ(bbox.Max.X, bbox.Max.Y, bbox.Min.Z),
                        new XYZ(bbox.Min.X, bbox.Min.Y, bbox.Max.Z),
                        new XYZ(bbox.Min.X, bbox.Max.Y, bbox.Max.Z),
                        new XYZ(bbox.Max.X, bbox.Min.Y, bbox.Max.Z),
                        new XYZ(bbox.Max.X, bbox.Max.Y, bbox.Max.Z)
                    };

                    bool elemValid = false;
                    foreach (var pt in corners)
                    {
                        XYZ localPt = invTrans.OfPoint(pt);

                        // 排除異常極端座標 (如超過 1000m)
                        if (Math.Abs(localPt.X) < 32808 && Math.Abs(localPt.Y) < 32808)
                        {
                            envMinX = Math.Min(envMinX, localPt.X);
                            envMaxX = Math.Max(envMaxX, localPt.X);
                            envMinY = Math.Min(envMinY, localPt.Y);
                            envMaxY = Math.Max(envMaxY, localPt.Y);
                            elemValid = true;
                            foundPhysical = true;
                        }
                    }
                    if (elemValid) physicalElementCount++;
                }
            }

            // 若有實體包絡，以實體包絡為基準；否則以軸線範圍為基準
            double baseMinX = foundPhysical ? envMinX : minGridX;
            double baseMaxX = foundPhysical ? envMaxX : maxGridX;
            double baseMinY = foundPhysical ? envMinY : minGridY;
            double baseMaxY = foundPhysical ? envMaxY : maxGridY;

            double offsetFeet = offsetMm / 304.8;
            double alignTop = baseMaxY + offsetFeet;
            double alignBottom = baseMinY - offsetFeet;
            double alignLeft = baseMinX - offsetFeet;
            double alignRight = baseMaxX + offsetFeet;

            var errors = new List<string>();
            int alignedCount = 0;

            using (Transaction trans = TransactionHelper.Begin(doc, "平面軸線四向齊頭整列"))
            {
                trans.Start();

                // 調整垂直軸線 (南北向)
                foreach (var item in vertGrids)
                {
                    var g = item.grid;
                    try
                    {
                        g.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                        g.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                        IList<Curve> curves = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                        Curve c = (curves != null && curves.Count > 0) ? curves[0] : g.Curve;

                        XYZ p0_local = invTrans.OfPoint(c.GetEndPoint(0));
                        XYZ p1_local = invTrans.OfPoint(c.GetEndPoint(1));

                        bool p0IsBot = p0_local.Y < p1_local.Y;
                        XYZ bot_local = p0IsBot ? p0_local : p1_local;
                        XYZ top_local = p0IsBot ? p1_local : p0_local;

                        XYZ newBot_local = new XYZ(bot_local.X, alignBottom, bot_local.Z);
                        XYZ newTop_local = new XYZ(top_local.X, alignTop, top_local.Z);

                        XYZ newBot_world = transform.OfPoint(newBot_local);
                        XYZ newTop_world = transform.OfPoint(newTop_local);

                        if (p0IsBot)
                        {
                            Line newCurve = Line.CreateBound(newBot_world, newTop_world);
                            g.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);
                            g.ShowBubbleInView(DatumEnds.End1, view);
                            if (showAllBubbles) g.ShowBubbleInView(DatumEnds.End0, view);
                            else g.HideBubbleInView(DatumEnds.End0, view);
                        }
                        else
                        {
                            Line newCurve = Line.CreateBound(newTop_world, newBot_world);
                            g.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);
                            g.ShowBubbleInView(DatumEnds.End0, view);
                            if (showAllBubbles) g.ShowBubbleInView(DatumEnds.End1, view);
                            else g.HideBubbleInView(DatumEnds.End1, view);
                        }

                        alignedCount++;
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"Vert Grid {g.Name}: {ex.Message}");
                    }
                }

                // 調整水平軸線 (東西向)
                foreach (var item in horizGrids)
                {
                    var g = item.grid;
                    try
                    {
                        g.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                        g.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                        IList<Curve> curves = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                        Curve c = (curves != null && curves.Count > 0) ? curves[0] : g.Curve;

                        XYZ p0_local = invTrans.OfPoint(c.GetEndPoint(0));
                        XYZ p1_local = invTrans.OfPoint(c.GetEndPoint(1));

                        bool p0IsLeft = p0_local.X < p1_local.X;
                        XYZ left_local = p0IsLeft ? p0_local : p1_local;
                        XYZ right_local = p0IsLeft ? p1_local : p0_local;

                        XYZ newLeft_local = new XYZ(alignLeft, left_local.Y, left_local.Z);
                        XYZ newRight_local = new XYZ(alignRight, right_local.Y, right_local.Z);

                        XYZ newLeft_world = transform.OfPoint(newLeft_local);
                        XYZ newRight_world = transform.OfPoint(newRight_local);

                        if (p0IsLeft)
                        {
                            Line newCurve = Line.CreateBound(newLeft_world, newRight_world);
                            g.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);
                            g.ShowBubbleInView(DatumEnds.End1, view);
                            if (showAllBubbles) g.ShowBubbleInView(DatumEnds.End0, view);
                            else g.HideBubbleInView(DatumEnds.End0, view);
                        }
                        else
                        {
                            Line newCurve = Line.CreateBound(newRight_world, newLeft_world);
                            g.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);
                            g.ShowBubbleInView(DatumEnds.End0, view);
                            if (showAllBubbles) g.ShowBubbleInView(DatumEnds.End1, view);
                            else g.HideBubbleInView(DatumEnds.End1, view);
                        }

                        alignedCount++;
                    }
                    catch (Exception ex)
                    {
                        errors.Add($"Horiz Grid {g.Name}: {ex.Message}");
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = view.Id.GetIdValue(),
                ViewName = view.Name,
                ReferenceViewId = envelopeSourceView.Id.GetIdValue(),
                ReferenceViewName = envelopeSourceView.Name,
                AlignedGridsCount = alignedCount,
                StepCount = stepCount,
                StepMm = stepMm,
                OffsetMm = offsetMm,
                UsePhysicalEnvelope = foundPhysical,
                PhysicalElementsEvaluated = physicalElementCount,
                PhysicalEnvelopeMm = foundPhysical ? new
                {
                    MinX = envMinX * 304.8,
                    MaxX = envMaxX * 304.8,
                    MinY = envMinY * 304.8,
                    MaxY = envMaxY * 304.8,
                    Width = (envMaxX - envMinX) * 304.8,
                    Depth = (envMaxY - envMinY) * 304.8
                } : null,
                AlignmentBoundsMm = new
                {
                    TopY = alignTop * 304.8,
                    BottomY = alignBottom * 304.8,
                    LeftX = alignLeft * 304.8,
                    RightX = alignRight * 304.8
                },
                Errors = errors,
                Message = $"成功將視圖 {view.Name} 內的 {alignedCount} 條軸線四向齊頭整列（{(foundPhysical ? "依實體外框" : "依軸線外框")} 延伸 {stepCount} 個間距 = {offsetMm:F1} mm）"
            };
        }
    }
}
