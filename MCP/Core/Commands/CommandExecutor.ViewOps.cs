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

                        Transform viewTrans = GetViewTransform(view);
                        Transform invTrans = viewTrans.Inverse;

                        // 找出視圖內所有實體建築構件（牆、樓板、結構柱、結構梁、屋頂）的邊界
                        var modelElements = new FilteredElementCollector(doc, view.Id)
                            .WhereElementIsNotElementType()
                            .WherePasses(new ElementMulticategoryFilter(new List<BuiltInCategory>
                            {
                                BuiltInCategory.OST_Walls,
                                BuiltInCategory.OST_Floors,
                                BuiltInCategory.OST_Roofs,
                                BuiltInCategory.OST_StructuralColumns,
                                BuiltInCategory.OST_StructuralFraming
                            }))
                            .ToList();

                        double minX_building = double.MaxValue;
                        double maxX_building = double.MinValue;
                        double minY_building = double.MaxValue;
                        double maxY_building = double.MinValue;

                        foreach (var modelElem in modelElements)
                        {
                            BoundingBoxXYZ bbox = modelElem.get_BoundingBox(view);
                            if (bbox == null) continue;
                            XYZ pMin = invTrans.OfPoint(bbox.Min);
                            XYZ pMax = invTrans.OfPoint(bbox.Max);
                            minX_building = Math.Min(minX_building, Math.Min(pMin.X, pMax.X));
                            maxX_building = Math.Max(maxX_building, Math.Max(pMin.X, pMax.X));
                            minY_building = Math.Min(minY_building, Math.Min(pMin.Y, pMax.Y));
                            maxY_building = Math.Max(maxY_building, Math.Max(pMin.Y, pMax.Y));
                        }

                        // 備援：若無實體幾何，以網格線與樓層線為基準
                        if (minX_building == double.MaxValue)
                        {
                            var allGrids = new FilteredElementCollector(doc, view.Id).OfClass(typeof(Grid)).Cast<Grid>().ToList();
                            if (allGrids.Count > 0)
                            {
                                minX_building = allGrids.Min(g => Math.Min(invTrans.OfPoint(g.Curve.GetEndPoint(0)).X, invTrans.OfPoint(g.Curve.GetEndPoint(1)).X));
                                maxX_building = allGrids.Max(g => Math.Max(invTrans.OfPoint(g.Curve.GetEndPoint(0)).X, invTrans.OfPoint(g.Curve.GetEndPoint(1)).X));
                            }
                            else
                            {
                                minX_building = cropBox.Min.X;
                                maxX_building = cropBox.Max.X;
                            }
                            minY_building = cropBox.Min.Y;
                            maxY_building = cropBox.Max.Y;
                        }

                        // 偏移量：樓層線左側 1000mm（有氣泡側）、右側 500mm（無氣泡側）；柱軸線頂端 500mm（有氣泡側）、底端 500mm（無氣泡側）
                        double levelLeftOffsetFt = 1000.0 / 304.8;
                        double levelRightOffsetFt = 500.0 / 304.8;
                        double gridTopOffsetFt = 500.0 / 304.8;
                        double gridBottomOffsetFt = 500.0 / 304.8;

                        double leftXFt = minX_building - levelLeftOffsetFt;
                        double rightXFt = maxX_building + levelRightOffsetFt;
                        double topYFt = maxY_building + gridTopOffsetFt;
                        double bottomYFt = minY_building - gridBottomOffsetFt;

                        // 里程碑 3：調整網格線 (Grids) 的 2D 範圍與氣泡（頂端 500mm 齊頭顯示氣泡，底端隱藏氣泡）
                        AdjustGridsInView(doc, view, bottomYFt, topYFt, viewTrans);

                        // 里程碑 4：調整樓層線 (Levels) 的 2D 範圍與氣泡（左側 1000mm 顯示氣泡，右側 500mm 隱藏氣泡）
                        AdjustLevelsInView(doc, view, leftXFt, rightXFt, viewTrans);

                        // 里程碑 5：更新 CropBox 完美包覆且上下左右預留 200mm 緩衝
                        double padFt = 200.0 / 304.8;
                        BoundingBoxXYZ newCropBox = new BoundingBoxXYZ
                        {
                            Min = new XYZ(leftXFt - padFt, bottomYFt - padFt, cropBox.Min.Z),
                            Max = new XYZ(rightXFt + padFt, topYFt + padFt, cropBox.Max.Z),
                            Transform = cropBox.Transform
                        };
                        view.CropBox = newCropBox;

                        processedViews.Add($"{view.Name} (Building X: {minX_building * 304.8:F0} ~ {maxX_building * 304.8:F0} mm, Y: {minY_building * 304.8:F0} ~ {maxY_building * 304.8:F0} mm)");
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
        private void AdjustGridsInView(Document doc, View view, double bottomYFt, double topYFt, Transform transform)
        {
            var grids = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Grid))
                .Cast<Grid>()
                .ToList();

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

                    double xLocal = (gP0_local.X + gP1_local.X) / 2.0;

                    // 上下端點垂直對齊: 底端 bottomYFt, 頂端 topYFt
                    XYZ newBottom_local = new XYZ(xLocal, bottomYFt, gP0_local.Z);
                    XYZ newTop_local = new XYZ(xLocal, topYFt, gP0_local.Z);

                    XYZ newBottom_world = transform.OfPoint(newBottom_local);
                    XYZ newTop_world = transform.OfPoint(newTop_local);

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
        /// 調整剖面視圖內 Levels 的 2D 範圍與氣泡顯示
        /// </summary>
        private void AdjustLevelsInView(Document doc, View view, double leftXFt, double rightXFt, Transform transform)
        {
            var levels = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .ToList();

            Transform invTrans = transform.Inverse;

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

                    XYZ lP0_local = invTrans.OfPoint(lP0_world);
                    XYZ lP1_local = invTrans.OfPoint(lP1_world);

                    double yLocal = (lP0_local.Y + lP1_local.Y) / 2.0;

                    // 左右端點水平對齊: 左端 leftXFt, 右端 rightXFt
                    XYZ newLeft_local = new XYZ(leftXFt, yLocal, lP0_local.Z);
                    XYZ newRight_local = new XYZ(rightXFt, yLocal, lP0_local.Z);

                    XYZ newLeft_world = transform.OfPoint(newLeft_local);
                    XYZ newRight_world = transform.OfPoint(newRight_local);

                    // 重新指派 2D 線段，起點設為左側，終點設為右側
                    Line newCurve = Line.CreateBound(newLeft_world, newRight_world);
                    level.SetCurveInView(DatumExtentType.ViewSpecific, view, newCurve);

                    // 左側（起點 End0）顯示氣泡，右側（終點 End1）強制隱藏氣泡！
                    level.ShowBubbleInView(DatumEnds.End0, view);
                    level.HideBubbleInView(DatumEnds.End1, view);
                }
                catch (Exception)
                {
                    // 容錯，不干擾其他 Level 的處理
                }
            }
        }
    }
}
