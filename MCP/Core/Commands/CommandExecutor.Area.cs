using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
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
        /// 自動抓取牆體中心線，經過壓平、合併去重與間隙縫合後，在面積平面圖中建立區域邊界線 (Area Boundary Lines)
        /// </summary>
        private object GenerateAreaBoundaries(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
            {
                view = doc.ActiveView;
            }

            if (!(view is ViewPlan viewPlan) || viewPlan.ViewType != ViewType.AreaPlan)
            {
                throw new Exception($"視圖 '{view.Name}' 不是「面積平面圖 (Area Plan)」。區域邊界線只能建立在面積平面圖中。");
            }

            // 參數解析
            double minThicknessMm = parameters["minThicknessMm"]?.Value<double>() ?? 45.0; // 預設 45mm 兼容 5cm 庫板
            bool includePanels = parameters["includePanels"]?.Value<bool>() ?? true;
            bool includeRailings = parameters["includeRailings"]?.Value<bool>() ?? true; // 支援陽台/露台欄杆
            bool snapToSlabEdge = parameters["snapToSlabEdge"]?.Value<bool>() ?? true; // 依建築技術規則第1條第3款及第162條，陽台無外牆以樓板外緣計算
            string viewTemplateName = parameters["viewTemplate"]?.Value<string>() ?? "計入容積"; // 自動律定視圖樣板
            bool clearExisting = parameters["clearExisting"]?.Value<bool>() ?? false;
            double mergeToleranceMm = parameters["mergeToleranceMm"]?.Value<double>() ?? 2.5;
            double snapGapToleranceMm = parameters["snapGapToleranceMm"]?.Value<double>() ?? 5.0;

            JArray wallIdsParam = parameters["wallIds"] as JArray;
            List<Wall> walls = new List<Wall>();

            if (wallIdsParam != null && wallIdsParam.Count > 0)
            {
                foreach (var token in wallIdsParam)
                {
                    IdType wId = token.Value<IdType>();
                    if (doc.GetElement(wId.ToElementId()) is Wall w)
                    {
                        walls.Add(w);
                    }
                }
            }
            else
            {
                walls = new FilteredElementCollector(doc, view.Id)
                    .OfClass(typeof(Wall))
                    .Cast<Wall>()
                    .Where(w => !w.ViewSpecific)
                    .ToList();
            }

            double targetZ = viewPlan.GenLevel != null ? viewPlan.GenLevel.Elevation : viewPlan.Origin.Z;
            double mergeToleranceFt = mergeToleranceMm / 304.8;
            double snapGapToleranceFt = snapGapToleranceMm / 304.8;

            // 1. 篩選合格牆體並提取直線/曲線
            List<Curve> rawCurves = new List<Curve>();
            int skippedWallsCount = 0;

            foreach (var w in walls)
            {
                if (!(w.Location is LocationCurve locCurve) || locCurve.Curve == null)
                {
                    skippedWallsCount++;
                    continue;
                }

                double thicknessMm = w.Width * 304.8;
                string typeName = w.Name ?? "";
                string typeUpper = typeName.ToUpper();

                // 黑名單排除
                if (typeUpper.Contains("粉刷") || typeUpper.Contains("磁磚") || typeUpper.Contains("FINISH") || typeUpper.Contains("TILE"))
                {
                    skippedWallsCount++;
                    continue;
                }

                // 長度過短排除
                if (locCurve.Curve.Length * 304.8 < 300.0)
                {
                    skippedWallsCount++;
                    continue;
                }

                // 白名單：若含庫板、Panel、隔間，即使小於 minThickness 仍強制保留
                bool isPanel = includePanels && (typeUpper.Contains("庫板") || typeUpper.Contains("PANEL") || typeUpper.Contains("SANDWICH") || typeUpper.Contains("隔間"));

                if (!isPanel && thicknessMm < minThicknessMm)
                {
                    skippedWallsCount++;
                    continue;
                }

                // 將曲線投影壓平至目標 Z 高度
                Curve flat = FlattenCurveToZ(locCurve.Curve, targetZ);
                if (flat != null && flat.Length > 0.001)
                {
                    rawCurves.Add(flat);
                }
            }

            // 2. 提取陽台/露台/走廊欄杆 (Railings) 作為區域邊界（依建築技術規則自動替換為樓板外緣）
            int railingCurvesCount = 0;
            if (includeRailings)
            {
                // 若開啟陽台樓板外緣計算，預先提取該樓層所有樓板頂面輪廓線
                List<Curve> allSlabEdges = new List<Curve>();
                if (snapToSlabEdge && viewPlan.GenLevel != null)
                {
                    var floorList = new FilteredElementCollector(doc)
                        .OfClass(typeof(Floor))
                        .WherePasses(new ElementLevelFilter(viewPlan.GenLevel.Id))
                        .WhereElementIsNotElementType()
                        .Cast<Floor>()
                        .ToList();

                    foreach (var fl in floorList)
                    {
                        allSlabEdges.AddRange(ExtractFloorTopFacePerimeter(fl, targetZ));
                    }
                }

                var railingFilter = new ElementMulticategoryFilter(new List<BuiltInCategory>
                {
                    BuiltInCategory.OST_StairsRailing,
                    BuiltInCategory.OST_Railings
                });

                var railingElements = new FilteredElementCollector(doc, view.Id)
                    .WherePasses(railingFilter)
                    .WhereElementIsNotElementType()
                    .ToList();

                if (railingElements.Count == 0 && viewPlan.GenLevel != null)
                {
                    railingElements = new FilteredElementCollector(doc)
                        .WherePasses(railingFilter)
                        .WherePasses(new ElementLevelFilter(viewPlan.GenLevel.Id))
                        .WhereElementIsNotElementType()
                        .ToList();
                }

                foreach (var elem in railingElements)
                {
                    // 排除樓梯扶手欄杆：
                    // 1. 宿主防呆：若主體為樓梯 (Stairs 或 OST_Stairs)，排除！
                    if (elem is Railing railing)
                    {
                        if (railing.HostId != ElementId.InvalidElementId)
                        {
                            Element hostElem = doc.GetElement(railing.HostId);
                            if (hostElem is Stairs || (hostElem?.Category != null && hostElem.Category.Id.GetIdValue() == (long)BuiltInCategory.OST_Stairs))
                            {
                                continue;
                            }
                        }

                        // 2. 樓層防呆：若欄杆之基準樓層與當前面積平面視圖不同，排除！
                        if (viewPlan.GenLevel != null && railing.LevelId != ElementId.InvalidElementId && railing.LevelId != viewPlan.GenLevel.Id)
                        {
                            continue;
                        }
                    }

                    // 3. 關鍵字防呆：若名稱包含「樓梯」、「STAIR」且無陽台/露台字樣，排除！
                    string rName = elem.Name ?? "";
                    string rTypeName = (doc.GetElement(elem.GetTypeId())?.Name) ?? "";
                    string rFull = (rName + " " + rTypeName).ToUpper();
                    if ((rFull.Contains("樓梯") || rFull.Contains("STAIR")) && !rFull.Contains("陽台") && !rFull.Contains("露台") && !rFull.Contains("BALCONY"))
                    {
                        continue;
                    }

                    IList<Curve> pathCurves = null;
                    if (elem is Railing rInst)
                    {
                        try { pathCurves = rInst.GetPath(); } catch { }
                    }
                    else if (elem.Location is LocationCurve lc)
                    {
                        pathCurves = new List<Curve> { lc.Curve };
                    }

                    if (pathCurves != null)
                    {
                        foreach (var c in pathCurves)
                        {
                            if (c != null && c.Length * 304.8 >= 300.0)
                            {
                                // 4. 坡度防呆：樓梯扶手隨階梯爬升 (高低差 ΔZ > 15cm)，陽台欄杆為水平面，排除斜坡線！
                                XYZ pStart = c.GetEndPoint(0);
                                XYZ pEnd = c.GetEndPoint(1);
                                if (Math.Abs(pEnd.Z - pStart.Z) * 304.8 > 150.0)
                                {
                                    continue;
                                }

                                Curve flat = FlattenCurveToZ(c, targetZ);
                                if (flat != null && flat.Length > 0.001)
                                {
                                    // 依建築技術規則第1條第3款與第162條：尋找外側相鄰且平行的樓板外緣線，以樓板外緣代替欄杆中心線
                                    Curve effectiveCurve = flat;
                                    if (snapToSlabEdge && allSlabEdges.Count > 0)
                                    {
                                        effectiveCurve = FindMatchingSlabOuterEdge(flat, allSlabEdges);
                                    }

                                    rawCurves.Add(effectiveCurve);
                                    railingCurvesCount++;
                                }
                            }
                        }
                    }
                }
            }

            if (rawCurves.Count == 0)
            {
                throw new Exception("在當前視圖中沒有找到符合厚度或關鍵字條件的有效直線牆心或欄杆。");
            }

            // 3. 幾何演算法：平行重疊線合併與端點吸附縫合
            List<Curve> cleanCurves = OptimizeCurves(rawCurves, targetZ, mergeToleranceFt, snapGapToleranceFt);

            int deletedExistingCount = 0;
            int createdLinesCount = 0;
            List<IdType> createdLineIds = new List<IdType>();

            using (Transaction trans = new Transaction(doc, "自動建立區域邊界線"))
            {
                trans.Start();

                // 確保 SketchPlane
                SketchPlane sketchPlane = viewPlan.SketchPlane;
                if (sketchPlane == null)
                {
                    Level level = viewPlan.GenLevel;
                    XYZ origin = level != null ? new XYZ(0, 0, level.Elevation) : new XYZ(0, 0, targetZ);
                    Plane plane = Plane.CreateByNormalAndOrigin(XYZ.BasisZ, origin);
                    sketchPlane = SketchPlane.Create(doc, plane);
                    viewPlan.SketchPlane = sketchPlane;
                }

                // 自動律定視圖樣板為「計入容積」
                if (!string.IsNullOrEmpty(viewTemplateName))
                {
                    EnsureViewTemplate(doc, viewPlan, viewTemplateName);
                }

                // 若指定清理既有區域邊界線
                if (clearExisting)
                {
                    var existingBoundaryLines = new FilteredElementCollector(doc, view.Id)
                        .OfCategory(BuiltInCategory.OST_AreaSchemeLines)
                        .WhereElementIsNotElementType()
                        .ToElementIds();

                    foreach (var id in existingBoundaryLines)
                    {
                        try
                        {
                            doc.Delete(id);
                            deletedExistingCount++;
                        }
                        catch { }
                    }
                }

                // 批次建立邊界線
                foreach (var curve in cleanCurves)
                {
                    try
                    {
                        ModelCurve boundaryLine = doc.Create.NewAreaBoundaryLine(sketchPlane, curve, viewPlan);
                        if (boundaryLine != null)
                        {
                            createdLineIds.Add(boundaryLine.Id.GetIdValue());
                            createdLinesCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        // 忽略重疊或無法建立之單一微小線段
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = viewPlan.Id.GetIdValue(),
                ViewName = viewPlan.Name,
                TotalWallsScanned = walls.Count,
                RailingCurvesExtracted = railingCurvesCount,
                ValidCurvesExtracted = rawCurves.Count,
                CleanCurvesOptimized = cleanCurves.Count,
                CreatedBoundaryLinesCount = createdLinesCount,
                CreatedLineIds = createdLineIds,
                DeletedExistingCount = deletedExistingCount,
                Message = $"成功在視圖 '{viewPlan.Name}' 中建立 {createdLinesCount} 條區域邊界線 (含牆心與 {railingCurvesCount} 段欄杆邊界，已消除/合併重疊與微小間隙)。"
            };
        }

        /// <summary>
        /// 在面積平面圖中自動或依指定座標放置「面積 (Area)」標籤物件（支援純幾何拓撲多邊形掃描與房間關聯）
        /// </summary>
        private object PlaceAreasInView(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null) view = doc.ActiveView;

            if (!(view is ViewPlan viewPlan) || viewPlan.ViewType != ViewType.AreaPlan)
            {
                throw new Exception($"視圖 '{view.Name}' 不是「面積平面圖 (Area Plan)」。");
            }

            string defaultName = parameters["defaultName"]?.Value<string>() ?? "居室";
            string defaultUsage = parameters["defaultUsage"]?.Value<string>() ?? "";
            bool countInGross = parameters["countInGross"]?.Value<bool>() ?? true; // C計入面積
            bool countInFloorArea = parameters["countInFloorArea"]?.Value<bool>() ?? true; // C計入容積
            bool useTopology = parameters["useTopology"]?.Value<bool>() ?? true; // 純幾何拓撲自動偵測封閉面
            string viewTemplateName = parameters["viewTemplate"]?.Value<string>() ?? "計入容積"; // 自動律定視圖樣板

            // 取得或推導放置種子清單
            var pointsToken = parameters["points"] as JArray;
            List<AreaCandidateSeed> candidates = new List<AreaCandidateSeed>();

            if (pointsToken != null && pointsToken.Count > 0)
            {
                foreach (var pt in pointsToken)
                {
                    double x = (pt["x"] ?? pt[0])?.Value<double>() ?? 0;
                    double y = (pt["y"] ?? pt[1])?.Value<double>() ?? 0;
                    candidates.Add(new AreaCandidateSeed
                    {
                        Point = new UV(x / 304.8, y / 304.8),
                        Name = defaultName
                    });
                }
            }
            else
            {
                Level viewLevel = viewPlan.GenLevel;
                List<Room> levelRooms = new List<Room>();
                if (viewLevel != null)
                {
                    levelRooms = new FilteredElementCollector(doc)
                        .OfClass(typeof(SpatialElement))
                        .WherePasses(new ElementMulticategoryFilter(new List<BuiltInCategory> { BuiltInCategory.OST_Rooms }))
                        .Cast<Room>()
                        .Where(r => r.LevelId == viewLevel.Id)
                        .ToList();
                }

                // 1. 純幾何拓撲多邊形掃描 (Method B)
                if (useTopology)
                {
                    var planarFaces = ExtractPlanarFacesFromBoundaries(doc, viewPlan);
                    foreach (var face in planarFaces)
                    {
                        string matchedName = defaultName;
                        // 檢查是否有房間落在此封閉面內（包含 Area 為 0 之未閉合房間，只要其座標在內即可關聯）
                        foreach (var r in levelRooms)
                        {
                            if (r.Location is LocationPoint lp)
                            {
                                if (IsPointInPolygon(lp.Point.X, lp.Point.Y, face.Polygon))
                                {
                                    if (!string.IsNullOrEmpty(r.Name))
                                    {
                                        matchedName = r.Name;
                                        break;
                                    }
                                }
                            }
                        }

                        candidates.Add(new AreaCandidateSeed
                        {
                            Point = face.SeedPoint,
                            Name = matchedName,
                            Polygon = face.Polygon
                        });
                    }
                }

                // 2. 雙重保險：檢查未被拓撲面覆蓋的既有房間中心
                foreach (var r in levelRooms)
                {
                    if (r.Location is LocationPoint lp)
                    {
                        bool covered = candidates.Any(c => c.Polygon != null && IsPointInPolygon(lp.Point.X, lp.Point.Y, c.Polygon));
                        if (!covered)
                        {
                            candidates.Add(new AreaCandidateSeed
                            {
                                Point = new UV(lp.Point.X, lp.Point.Y),
                                Name = !string.IsNullOrEmpty(r.Name) ? r.Name : defaultName
                            });
                        }
                    }
                }
            }

            if (candidates.Count == 0)
            {
                throw new Exception("在當前視圖中未找到任何封閉區域邊界線或可用之房間中心點作為放置種子。");
            }

            bool clearExisting = parameters["clearExisting"]?.Value<bool>() ?? false;

            // 取得視圖中現有的有效 Area 邊界多邊形，避免重複放置
            var existingAreas = new FilteredElementCollector(doc, viewPlan.Id)
                .OfCategory(BuiltInCategory.OST_Areas)
                .WhereElementIsNotElementType()
                .Cast<Area>()
                .Where(a => a.Area > 0.001)
                .ToList();

            List<List<XYZ>> occupiedPolygons = new List<List<XYZ>>();
            SpatialElementBoundaryOptions bOpt = new SpatialElementBoundaryOptions();
            if (!clearExisting)
            {
                foreach (var ea in existingAreas)
                {
                    try
                    {
                        var segs = ea.GetBoundarySegments(bOpt);
                        if (segs != null && segs.Count > 0)
                        {
                            var poly = segs[0].Select(s => s.GetCurve().GetEndPoint(0)).ToList();
                            if (poly.Count >= 3) occupiedPolygons.Add(poly);
                        }
                    }
                    catch { }
                }
            }

            var createdAreas = new List<object>();
            var debugLogs = new List<string>();
            int skippedCount = 0;
            int deletedExistingAreasCount = 0;
            int existingTaggedCount = 0;

            using (Transaction trans = new Transaction(doc, "自動放置區域面積與標籤"))
            {
                trans.Start();

                // 自動律定視圖樣板為「計入容積」
                if (!string.IsNullOrEmpty(viewTemplateName))
                {
                    EnsureViewTemplate(doc, viewPlan, viewTemplateName);
                }

                // 若指定清除既有 Area，徹底重做該視圖
                if (clearExisting)
                {
                    var existingAreasInView = new FilteredElementCollector(doc, viewPlan.Id)
                        .OfCategory(BuiltInCategory.OST_Areas)
                        .WhereElementIsNotElementType()
                        .Cast<Area>()
                        .ToList();

                    foreach (var ea in existingAreasInView)
                    {
                        try
                        {
                            doc.Delete(ea.Id);
                            deletedExistingAreasCount++;
                        }
                        catch { }
                    }
                    occupiedPolygons.Clear();
                }

                foreach (var cand in candidates)
                {
                    // 檢查是否落在既有 Area 多邊形內部
                    if (occupiedPolygons.Any(poly => IsPointInPolygon(cand.Point.U, cand.Point.V, poly)))
                    {
                        skippedCount++;
                        debugLogs.Add($"Cand ({cand.Point.U * 304.8:F1}, {cand.Point.V * 304.8:F1}) skipped by occupied polygon.");
                        continue;
                    }

                    try
                    {
                        Area area = doc.Create.NewArea(viewPlan, cand.Point);
                        if (area != null)
                        {
                            doc.Regenerate(); // 關鍵：強制計算邊界幾何與面積數值

                            double rawArea = area.Area;
                            debugLogs.Add($"Cand ({cand.Point.U * 304.8:F1}, {cand.Point.V * 304.8:F1}) -> AreaId: {area.Id.GetIdValue()}, RawArea: {rawArea}");

                            if (rawArea > 0.001)
                            {
                                if (!string.IsNullOrEmpty(cand.Name))
                                {
                                    area.Name = cand.Name;
                                }

                                SetParameterValue(area, "用途", defaultUsage);
                                if (countInGross) SetParameterValue(area, "C計入面積", 1);
                                if (countInFloorArea) SetParameterValue(area, "C計入容積", 1);

                                double areaM2 = Math.Round(rawArea * 0.09290304, 2);

                                // 產出區域面積標籤 (AreaTag)
                                IdType tagId = 0;
                                try
                                {
                                    AreaTag tag = doc.Create.NewAreaTag(viewPlan, area, cand.Point);
                                    if (tag != null)
                                    {
                                        try { tag.HasLeader = false; } catch { }
                                        try
                                        {
                                            XYZ centerPt = (area.Location is LocationPoint alp) ? alp.Point : new XYZ(cand.Point.U, cand.Point.V, viewPlan.GenLevel != null ? viewPlan.GenLevel.Elevation : 0);
                                            tag.TagHeadPosition = centerPt;
                                        }
                                        catch { }

                                        tagId = tag.Id.GetIdValue();
                                        debugLogs.Add($"Placed AreaTag: {tagId} (HasLeader=false)");
                                    }
                                }
                                catch (Exception tagEx)
                                {
                                    debugLogs.Add($"NewAreaTag direct error: {tagEx.Message}");
                                    try
                                    {
                                        if (area.Location is LocationPoint lp)
                                        {
                                            AreaTag tag = doc.Create.NewAreaTag(viewPlan, area, new UV(lp.Point.X, lp.Point.Y));
                                            if (tag != null)
                                            {
                                                try { tag.HasLeader = false; } catch { }
                                                try { tag.TagHeadPosition = lp.Point; } catch { }
                                                tagId = tag.Id.GetIdValue();
                                                debugLogs.Add($"Placed AreaTag fallback: {tagId} (HasLeader=false)");
                                            }
                                        }
                                    }
                                    catch (Exception tagEx2)
                                    {
                                        debugLogs.Add($"NewAreaTag fallback error: {tagEx2.Message}");
                                    }
                                }

                                try
                                {
                                    var segs = area.GetBoundarySegments(bOpt);
                                    if (segs != null && segs.Count > 0)
                                    {
                                        var poly = segs[0].Select(s => s.GetCurve().GetEndPoint(0)).ToList();
                                        if (poly.Count >= 3) occupiedPolygons.Add(poly);
                                    }
                                }
                                catch { }

                                createdAreas.Add(new
                                {
                                    AreaId = area.Id.GetIdValue(),
                                    TagId = tagId,
                                    Name = area.Name,
                                    Number = area.Number,
                                    AreaM2 = areaM2,
                                    LocationX = Math.Round(cand.Point.U * 304.8, 1),
                                    LocationY = Math.Round(cand.Point.V * 304.8, 1)
                                });
                            }
                            else
                            {
                                // 未閉合區域（面積為 0），立即刪除清理
                                debugLogs.Add($"Cand ({cand.Point.U * 304.8:F1}, {cand.Point.V * 304.8:F1}) rawArea <= 0.001, deleting unclosed Area.");
                                doc.Delete(area.Id);
                            }
                        }
                        else
                        {
                            debugLogs.Add($"NewArea returned null for point ({cand.Point.U * 304.8:F1}, {cand.Point.V * 304.8:F1})");
                        }
                    }
                    catch (Exception ex)
                    {
                        debugLogs.Add($"Exception on point ({cand.Point.U * 304.8:F1}, {cand.Point.V * 304.8:F1}): {ex.Message}");
                    }
                }

                // 針對未清除但尚無標籤之既有 Area 補上標籤
                if (!clearExisting)
                {
                    var existingAreasInView = new FilteredElementCollector(doc, viewPlan.Id)
                        .OfCategory(BuiltInCategory.OST_Areas)
                        .WhereElementIsNotElementType()
                        .Cast<Area>()
                        .Where(a => a.Area > 0.001)
                        .ToList();

                    var existingTaggedAreaIds = new FilteredElementCollector(doc, viewPlan.Id)
                        .OfCategory(BuiltInCategory.OST_AreaTags)
                        .WhereElementIsNotElementType()
                        .Cast<AreaTag>()
                        .Select(t => t.Area?.Id)
                        .Where(id => id != null)
                        .ToHashSet();

                    foreach (var ea in existingAreasInView)
                    {
                        if (!existingTaggedAreaIds.Contains(ea.Id))
                        {
                            try
                            {
                                if (ea.Location is LocationPoint lp)
                                {
                                    AreaTag tag = doc.Create.NewAreaTag(viewPlan, ea, new UV(lp.Point.X, lp.Point.Y));
                                    if (tag != null)
                                    {
                                        try { tag.HasLeader = false; } catch { }
                                        try { tag.TagHeadPosition = lp.Point; } catch { }
                                        existingTaggedCount++;
                                    }
                                }
                            }
                            catch { }
                        }
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = viewPlan.Id.GetIdValue(),
                ViewName = viewPlan.Name,
                TotalCandidatePoints = candidates.Count,
                CreatedAreasCount = createdAreas.Count,
                DeletedExistingAreasCount = deletedExistingAreasCount,
                ExistingTaggedCount = existingTaggedCount,
                SkippedExistingCount = skippedCount,
                Areas = createdAreas,
                DebugLogs = debugLogs,
                Message = $"成功在視圖 '{viewPlan.Name}' 中放置 {createdAreas.Count} 個區域面積與標籤（刪除舊面積 {deletedExistingAreasCount} 個，補上既有標籤 {existingTaggedCount} 個，略過 {skippedCount} 個）。"
            };
        }

        /// <summary>
        /// 將面積平面圖中的所有區域標籤去除引線並居中於空間中心
        /// </summary>
        private object CenterAreaTags(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;

            List<ViewPlan> views = new List<ViewPlan>();
            if (viewId != 0)
            {
                if (doc.GetElement(viewId.ToElementId()) is ViewPlan vp && vp.ViewType == ViewType.AreaPlan)
                {
                    views.Add(vp);
                }
            }
            else
            {
                views = new FilteredElementCollector(doc)
                    .OfClass(typeof(ViewPlan))
                    .Cast<ViewPlan>()
                    .Where(vp => vp.ViewType == ViewType.AreaPlan)
                    .ToList();
            }

            int modifiedTagsCount = 0;
            using (Transaction trans = new Transaction(doc, "居中面積標籤並去除引線"))
            {
                trans.Start();
                foreach (var v in views)
                {
                    var tags = new FilteredElementCollector(doc, v.Id)
                        .OfCategory(BuiltInCategory.OST_AreaTags)
                        .WhereElementIsNotElementType()
                        .Cast<AreaTag>()
                        .ToList();

                    foreach (var tag in tags)
                    {
                        try
                        {
                            tag.HasLeader = false;
                            if (tag.Area != null && tag.Area.Location is LocationPoint lp)
                            {
                                tag.TagHeadPosition = lp.Point;
                            }
                            modifiedTagsCount++;
                        }
                        catch
                        {
                            try { tag.HasLeader = false; } catch { }
                        }
                    }
                }
                trans.Commit();
            }

            return new
            {
                Success = true,
                ModifiedTagsCount = modifiedTagsCount,
                Message = $"成功將 {modifiedTagsCount} 個區域面積標籤去除引線並居中於空間範圍中心。"
            };
        }

        #region 輔助幾何運算

        private Curve FlattenCurveToZ(Curve curve, double zVal)
        {
            try
            {
                if (curve is Line line)
                {
                    XYZ p1 = line.GetEndPoint(0);
                    XYZ p2 = line.GetEndPoint(1);
                    return Line.CreateBound(new XYZ(p1.X, p1.Y, zVal), new XYZ(p2.X, p2.Y, zVal));
                }
                else if (curve is Arc arc)
                {
                    XYZ p1 = arc.GetEndPoint(0);
                    XYZ p2 = arc.GetEndPoint(1);
                    XYZ pm = arc.Evaluate(0.5, true);
                    return Arc.Create(new XYZ(p1.X, p1.Y, zVal), new XYZ(p2.X, p2.Y, zVal), new XYZ(pm.X, pm.Y, zVal));
                }
                else
                {
                    XYZ p0 = curve.GetEndPoint(0);
                    Transform tr = Transform.CreateTranslation(new XYZ(0, 0, zVal - p0.Z));
                    return curve.CreateTransformed(tr);
                }
            }
            catch
            {
                return null;
            }
        }

        private List<Curve> OptimizeCurves(List<Curve> curves, double zVal, double mergeTolFt, double snapGapTolFt)
        {
            var lines = new List<Line>();
            var otherCurves = new List<Curve>();

            foreach (var c in curves)
            {
                if (c is Line l && l.Length > 0.005)
                {
                    lines.Add(l);
                }
                else if (c != null && c.Length > 0.005)
                {
                    otherCurves.Add(c);
                }
            }

            // 1. 直線平行聚類與投影重疊合併 (Dynamo Area-範圍線輕量化 演算法)
            var groups = new List<(double A, double B, double C, List<Line> Lines)>();

            foreach (var l in lines)
            {
                XYZ p1 = l.GetEndPoint(0);
                XYZ p2 = l.GetEndPoint(1);
                double dx = p2.X - p1.X;
                double dy = p2.Y - p1.Y;
                double len = Math.Sqrt(dx * dx + dy * dy);
                if (len < 1e-6) continue;

                double A = (p2.Y - p1.Y) / len;
                double B = (p1.X - p2.X) / len;
                double C = (p2.X * p1.Y - p1.X * p2.Y) / len;

                // 統一法向量方向
                if (A < 0 || (Math.Abs(A) < 1e-6 && B < 0))
                {
                    A = -A; B = -B; C = -C;
                }

                bool matched = false;
                for (int i = 0; i < groups.Count; i++)
                {
                    var grp = groups[i];
                    double dot = A * grp.A + B * grp.B;
                    if (Math.Abs(dot - 1.0) < 0.01) // 角度誤差小於 0.5 度
                    {
                        double d1 = Math.Abs(grp.A * p1.X + grp.B * p1.Y + grp.C);
                        double d2 = Math.Abs(grp.A * p2.X + grp.B * p2.Y + grp.C);
                        if (d1 < mergeTolFt && d2 < mergeTolFt)
                        {
                            grp.Lines.Add(l);
                            matched = true;
                            break;
                        }
                    }
                }

                if (!matched)
                {
                    groups.Add((A, B, C, new List<Line> { l }));
                }
            }

            var mergedLines = new List<Line>();

            foreach (var grp in groups)
            {
                if (grp.Lines.Count == 1)
                {
                    mergedLines.Add(grp.Lines[0]);
                    continue;
                }

                Line baseLine = grp.Lines[0];
                XYZ pBase = baseLine.GetEndPoint(0);
                XYZ pEnd = baseLine.GetEndPoint(1);
                double dirX = pEnd.X - pBase.X;
                double dirY = pEnd.Y - pBase.Y;
                double dirLen = Math.Sqrt(dirX * dirX + dirY * dirY);
                dirX /= dirLen;
                dirY /= dirLen;

                var intervals = new List<(double t1, double t2)>();
                foreach (var l in grp.Lines)
                {
                    XYZ ps = l.GetEndPoint(0);
                    XYZ pe = l.GetEndPoint(1);
                    double tA = (ps.X - pBase.X) * dirX + (ps.Y - pBase.Y) * dirY;
                    double tB = (pe.X - pBase.X) * dirX + (pe.Y - pBase.Y) * dirY;
                    intervals.Add((Math.Min(tA, tB), Math.Max(tA, tB)));
                }

                intervals = intervals.OrderBy(x => x.t1).ToList();

                double currStart = intervals[0].t1;
                double currEnd = intervals[0].t2;

                for (int i = 1; i < intervals.Count; i++)
                {
                    if (intervals[i].t1 <= currEnd + snapGapTolFt)
                    {
                        currEnd = Math.Max(currEnd, intervals[i].t2);
                    }
                    else
                    {
                        XYZ startPt = new XYZ(pBase.X + dirX * currStart, pBase.Y + dirY * currStart, zVal);
                        XYZ endPt = new XYZ(pBase.X + dirX * currEnd, pBase.Y + dirY * currEnd, zVal);
                        if (startPt.DistanceTo(endPt) > 0.005)
                        {
                            mergedLines.Add(Line.CreateBound(startPt, endPt));
                        }
                        currStart = intervals[i].t1;
                        currEnd = intervals[i].t2;
                    }
                }

                XYZ finalStart = new XYZ(pBase.X + dirX * currStart, pBase.Y + dirY * currStart, zVal);
                XYZ finalEnd = new XYZ(pBase.X + dirX * currEnd, pBase.Y + dirY * currEnd, zVal);
                if (finalStart.DistanceTo(finalEnd) > 0.005)
                {
                    mergedLines.Add(Line.CreateBound(finalStart, finalEnd));
                }
            }

            var result = new List<Curve>();
            result.AddRange(mergedLines);
            result.AddRange(otherCurves);
            return result;
        }

        private static void SetParameterValue(Element elem, string paramName, object value)
        {
            if (elem == null || string.IsNullOrEmpty(paramName) || value == null) return;
            Parameter p = elem.LookupParameter(paramName);
            if (p != null && !p.IsReadOnly)
            {
                if (value is string s) p.Set(s);
                else if (value is int i) p.Set(i);
                else if (value is double d) p.Set(d);
            }
        }

        /// <summary>
        /// 自動將面積平面視圖之「視圖樣板」律定為指定樣板（如：'計入容積'）
        /// </summary>
        private static void EnsureViewTemplate(Document doc, View view, string templateName = "計入容積")
        {
            if (view == null || string.IsNullOrEmpty(templateName)) return;

            if (view.ViewTemplateId != ElementId.InvalidElementId)
            {
                Element cur = doc.GetElement(view.ViewTemplateId);
                if (cur != null && cur.Name.Equals(templateName, StringComparison.OrdinalIgnoreCase))
                {
                    return; // 已經是目標樣板，無需重複套用
                }
            }

            View templateView = new FilteredElementCollector(doc)
                .OfClass(typeof(View))
                .Cast<View>()
                .FirstOrDefault(v => v.IsTemplate && v.Name.Equals(templateName, StringComparison.OrdinalIgnoreCase));

            if (templateView != null)
            {
                try
                {
                    view.ViewTemplateId = templateView.Id;
                }
                catch { }
            }
        }

        /// <summary>
        /// 提取樓板頂面之封閉外邊緣輪廓線（壓平至 targetZ）
        /// </summary>
        private List<Curve> ExtractFloorTopFacePerimeter(Floor floor, double targetZ)
        {
            var curves = new List<Curve>();
            if (floor == null) return curves;

            try
            {
                Options opt = new Options
                {
                    DetailLevel = ViewDetailLevel.Fine,
                    ComputeReferences = false,
                    IncludeNonVisibleObjects = false
                };

                GeometryElement geomElem = floor.get_Geometry(opt);
                if (geomElem == null) return curves;

                foreach (GeometryObject geomObj in geomElem)
                {
                    Solid solid = geomObj as Solid;
                    if (solid == null && geomObj is GeometryInstance gi)
                    {
                        solid = gi.GetInstanceGeometry()?.OfType<Solid>().FirstOrDefault(s => s.Volume > 0.001);
                    }

                    if (solid != null && solid.Volume > 0.001)
                    {
                        foreach (Face face in solid.Faces)
                        {
                            if (face is PlanarFace pf && pf.FaceNormal.Z > 0.9)
                            {
                                var curveLoops = pf.GetEdgesAsCurveLoops();
                                foreach (var loop in curveLoops)
                                {
                                    foreach (Curve c in loop)
                                    {
                                        Curve flat = FlattenCurveToZ(c, targetZ);
                                        if (flat != null && flat.Length > 0.01)
                                        {
                                            curves.Add(flat);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            return curves;
        }

        /// <summary>
        /// 依建築技術規則第1條第3款與第162條規定：陽台無外牆者以樓板外緣為界。
        /// 尋找與欄杆平行（夾角<3度）且相鄰（垂直距離 10mm~500mm）之樓板外緣線，以樓板外緣線代替欄杆中心線。
        /// </summary>
        private Curve FindMatchingSlabOuterEdge(Curve railCurve, List<Curve> allSlabEdges, double maxOffsetDistFt = 500.0 / 304.8)
        {
            if (!(railCurve is Line railLine) || allSlabEdges == null || allSlabEdges.Count == 0) return railCurve;

            XYZ r1 = railLine.GetEndPoint(0);
            XYZ r2 = railLine.GetEndPoint(1);
            XYZ rDir = (r2 - r1).Normalize();
            double rLen = r1.DistanceTo(r2);
            if (rLen < 0.01) return railCurve;

            XYZ rNormal = new XYZ(-rDir.Y, rDir.X, 0).Normalize();

            Curve bestSlabEdge = null;
            double bestDist = double.MaxValue;

            foreach (var sc in allSlabEdges)
            {
                if (!(sc is Line sLine)) continue;

                XYZ s1 = sLine.GetEndPoint(0);
                XYZ s2 = sLine.GetEndPoint(1);
                XYZ sDir = (s2 - s1).Normalize();
                double sLen = s1.DistanceTo(s2);
                if (sLen < 0.01) continue;

                // 1. 平行度檢查：方向夾角小於 3 度 (|dot| > 0.998)
                double dot = Math.Abs(rDir.X * sDir.X + rDir.Y * sDir.Y);
                if (dot < 0.998) continue;

                // 2. 垂直距離檢查 (10mm ~ 500mm)
                double perpDist1 = Math.Abs((s1.X - r1.X) * rNormal.X + (s1.Y - r1.Y) * rNormal.Y);
                double perpDist2 = Math.Abs((s2.X - r1.X) * rNormal.X + (s2.Y - r1.Y) * rNormal.Y);
                double avgPerpDist = (perpDist1 + perpDist2) * 0.5;

                if (avgPerpDist < 10.0 / 304.8 || avgPerpDist > maxOffsetDistFt) continue;

                // 3. 投影重疊度檢查 (沿欄杆方向)
                double t1 = (s1.X - r1.X) * rDir.X + (s1.Y - r1.Y) * rDir.Y;
                double t2 = (s2.X - r1.X) * rDir.X + (s2.Y - r1.Y) * rDir.Y;
                double sMin = Math.Min(t1, t2);
                double sMax = Math.Max(t1, t2);

                double overlapStart = Math.Max(0, sMin);
                double overlapEnd = Math.Min(rLen, sMax);
                double overlapLen = overlapEnd - overlapStart;

                if (overlapLen > 0.2 * rLen) // 重疊度超過 20%
                {
                    if (bestSlabEdge == null || avgPerpDist < bestDist)
                    {
                        bestDist = avgPerpDist;
                        bestSlabEdge = sLine;
                    }
                }
            }

            if (bestSlabEdge != null)
            {
                return bestSlabEdge;
            }

            return railCurve;
        }

        private class AreaCandidateSeed
        {
            public UV Point { get; set; }
            public string Name { get; set; }
            public List<XYZ> Polygon { get; set; }
        }

        private class PlanarFaceInfo
        {
            public List<XYZ> Polygon { get; set; } = new List<XYZ>();
            public UV SeedPoint { get; set; }
            public double AreaSqFt { get; set; }
        }

        private class DirectedHalfEdge
        {
            public int From { get; set; }
            public int To { get; set; }
            public double Angle { get; set; }
            public bool Visited { get; set; } = false;
        }

        /// <summary>
        /// 純幾何拓撲：從視圖中的區域邊界線中提取所有封閉多邊形面與中心種子點
        /// </summary>
        private List<PlanarFaceInfo> ExtractPlanarFacesFromBoundaries(Document doc, ViewPlan viewPlan)
        {
            var boundaryLines = new FilteredElementCollector(doc, viewPlan.Id)
                .OfCategory(BuiltInCategory.OST_AreaSchemeLines)
                .WhereElementIsNotElementType()
                .Cast<ModelCurve>()
                .Select(mc => mc.GeometryCurve)
                .Where(c => c != null)
                .ToList();

            if (boundaryLines.Count == 0) return new List<PlanarFaceInfo>();

            // 1. 離散化為 2D 線段
            var rawSegments = new List<(XYZ P1, XYZ P2)>();
            foreach (var c in boundaryLines)
            {
                if (c is Line l && l.Length > 0.005)
                {
                    rawSegments.Add((l.GetEndPoint(0), l.GetEndPoint(1)));
                }
                else
                {
                    var pts = c.Tessellate();
                    for (int i = 0; i < pts.Count - 1; i++)
                    {
                        if (pts[i].DistanceTo(pts[i + 1]) > 0.005)
                        {
                            rawSegments.Add((pts[i], pts[i + 1]));
                        }
                    }
                }
            }

            // 2. 兩兩求交點分割 T 字相交線段
            List<List<double>> splitParams = new List<List<double>>();
            for (int i = 0; i < rawSegments.Count; i++) splitParams.Add(new List<double>());

            for (int i = 0; i < rawSegments.Count; i++)
            {
                XYZ p1 = rawSegments[i].P1;
                XYZ p2 = rawSegments[i].P2;
                double dx1 = p2.X - p1.X;
                double dy1 = p2.Y - p1.Y;

                for (int j = i + 1; j < rawSegments.Count; j++)
                {
                    XYZ q1 = rawSegments[j].P1;
                    XYZ q2 = rawSegments[j].P2;
                    double dx2 = q2.X - q1.X;
                    double dy2 = q2.Y - q1.Y;

                    double det = dx1 * dy2 - dy1 * dx2;
                    if (Math.Abs(det) < 1e-7) continue;

                    double t1 = ((q1.X - p1.X) * dy2 - (q1.Y - p1.Y) * dx2) / det;
                    double t2 = ((q1.X - p1.X) * dy1 - (q1.Y - p1.Y) * dx1) / det;

                    if (t1 > 1e-3 && t1 < 1.0 - 1e-3 && t2 > -1e-3 && t2 < 1.0 + 1e-3)
                    {
                        splitParams[i].Add(t1);
                    }
                    if (t2 > 1e-3 && t2 < 1.0 - 1e-3 && t1 > -1e-3 && t1 < 1.0 + 1e-3)
                    {
                        splitParams[j].Add(t2);
                    }
                }
            }

            var subSegments = new List<(XYZ P1, XYZ P2)>();
            for (int i = 0; i < rawSegments.Count; i++)
            {
                var p1 = rawSegments[i].P1;
                var p2 = rawSegments[i].P2;
                var tList = splitParams[i].Distinct().OrderBy(t => t).ToList();

                double curT = 0.0;
                foreach (var t in tList)
                {
                    if (t - curT > 1e-3)
                    {
                        XYZ ptA = new XYZ(p1.X + (p2.X - p1.X) * curT, p1.Y + (p2.Y - p1.Y) * curT, 0);
                        XYZ ptB = new XYZ(p1.X + (p2.X - p1.X) * t, p1.Y + (p2.Y - p1.Y) * t, 0);
                        if (ptA.DistanceTo(ptB) > 0.005) subSegments.Add((ptA, ptB));
                    }
                    curT = t;
                }
                if (1.0 - curT > 1e-3)
                {
                    XYZ ptA = new XYZ(p1.X + (p2.X - p1.X) * curT, p1.Y + (p2.Y - p1.Y) * curT, 0);
                    XYZ ptB = new XYZ(p2.X, p2.Y, 0);
                    if (ptA.DistanceTo(ptB) > 0.005) subSegments.Add((ptA, ptB));
                }
            }

            // 3. 頂點吸附合併 (5mm 容差)
            double snapTol = 5.0 / 304.8;
            List<XYZ> vertices = new List<XYZ>();

            int GetOrCreateVertex(XYZ pt)
            {
                for (int idx = 0; idx < vertices.Count; idx++)
                {
                    double dx = vertices[idx].X - pt.X;
                    double dy = vertices[idx].Y - pt.Y;
                    if (Math.Sqrt(dx * dx + dy * dy) <= snapTol) return idx;
                }
                vertices.Add(new XYZ(pt.X, pt.Y, 0));
                return vertices.Count - 1;
            }

            var edges = new List<(int U, int V)>();
            foreach (var seg in subSegments)
            {
                int u = GetOrCreateVertex(seg.P1);
                int v = GetOrCreateVertex(seg.P2);
                if (u != v)
                {
                    if (!edges.Any(e => (e.U == u && e.V == v) || (e.U == v && e.V == u)))
                    {
                        edges.Add((u, v));
                    }
                }
            }

            // 4. 構建半邊鄰接表
            var adj = new Dictionary<int, List<DirectedHalfEdge>>();
            for (int i = 0; i < vertices.Count; i++) adj[i] = new List<DirectedHalfEdge>();

            foreach (var e in edges)
            {
                double angleUV = Math.Atan2(vertices[e.V].Y - vertices[e.U].Y, vertices[e.V].X - vertices[e.U].X);
                double angleVU = Math.Atan2(vertices[e.U].Y - vertices[e.V].Y, vertices[e.U].X - vertices[e.V].X);

                adj[e.U].Add(new DirectedHalfEdge { From = e.U, To = e.V, Angle = angleUV });
                adj[e.V].Add(new DirectedHalfEdge { From = e.V, To = e.U, Angle = angleVU });
            }

            foreach (var kvp in adj)
            {
                kvp.Value.Sort((a, b) => a.Angle.CompareTo(b.Angle));
            }

            // 5. 最小面巡歷
            var faces = new List<PlanarFaceInfo>();

            foreach (var kvp in adj)
            {
                foreach (var startEdge in kvp.Value)
                {
                    if (startEdge.Visited) continue;

                    var faceVerts = new List<int>();
                    var currEdge = startEdge;
                    bool isCycle = false;

                    while (!currEdge.Visited)
                    {
                        currEdge.Visited = true;
                        faceVerts.Add(currEdge.From);

                        int v = currEdge.To;
                        if (!adj.ContainsKey(v) || adj[v].Count == 0) break;
                        var outgoing = adj[v];

                        int backIdx = -1;
                        for (int k = 0; k < outgoing.Count; k++)
                        {
                            if (outgoing[k].To == currEdge.From)
                            {
                                backIdx = k;
                                break;
                            }
                        }

                        if (backIdx == -1) break;

                        int nextIdx = (backIdx - 1 + outgoing.Count) % outgoing.Count;
                        currEdge = outgoing[nextIdx];

                        if (currEdge.From == startEdge.From && currEdge.To == startEdge.To)
                        {
                            isCycle = true;
                            break;
                        }
                    }

                    if (isCycle && faceVerts.Count >= 3)
                    {
                        double signedArea = 0;
                        for (int k = 0; k < faceVerts.Count; k++)
                        {
                            int next = (k + 1) % faceVerts.Count;
                            signedArea += (vertices[faceVerts[k]].X * vertices[faceVerts[next]].Y - vertices[faceVerts[next]].X * vertices[faceVerts[k]].Y);
                        }
                        signedArea *= 0.5;

                        double absArea = Math.Abs(signedArea);
                        // 排除外部無界極大面與小於 0.2 平方公尺的無效碎屑面
                        if (absArea > 2.0 && absArea < 107639.0)
                        {
                            double cx = 0, cy = 0;
                            for (int k = 0; k < faceVerts.Count; k++)
                            {
                                int next = (k + 1) % faceVerts.Count;
                                double cross = (vertices[faceVerts[k]].X * vertices[faceVerts[next]].Y - vertices[faceVerts[next]].X * vertices[faceVerts[k]].Y);
                                cx += (vertices[faceVerts[k]].X + vertices[faceVerts[next]].X) * cross;
                                cy += (vertices[faceVerts[k]].Y + vertices[faceVerts[next]].Y) * cross;
                            }
                            cx /= (6.0 * signedArea);
                            cy /= (6.0 * signedArea);

                            var poly = faceVerts.Select(vi => vertices[vi]).ToList();
                            UV seedUV;
                            if (IsPointInPolygon(cx, cy, poly))
                            {
                                seedUV = new UV(cx, cy);
                            }
                            else
                            {
                                seedUV = FindInteriorPoint(poly, cx, cy);
                            }

                            faces.Add(new PlanarFaceInfo
                            {
                                Polygon = poly,
                                SeedPoint = seedUV,
                                AreaSqFt = signedArea
                            });
                        }
                    }
                }
            }

            return faces;
        }

        private static bool IsPointInPolygon(double x, double y, List<XYZ> poly)
        {
            if (poly == null || poly.Count < 3) return false;
            bool inside = false;
            int j = poly.Count - 1;
            for (int i = 0; i < poly.Count; j = i++)
            {
                if (((poly[i].Y > y) != (poly[j].Y > y)) &&
                    (x < (poly[j].X - poly[i].X) * (y - poly[i].Y) / (poly[j].Y - poly[i].Y + 1e-12) + poly[i].X))
                {
                    inside = !inside;
                }
            }
            return inside;
        }

        private static UV FindInteriorPoint(List<XYZ> poly, double fallbackX, double fallbackY)
        {
            if (poly == null || poly.Count < 3) return new UV(fallbackX, fallbackY);

            double minX = poly.Min(p => p.X);
            double maxX = poly.Max(p => p.X);
            double minY = poly.Min(p => p.Y);
            double maxY = poly.Max(p => p.Y);

            int steps = 12;
            double stepX = (maxX - minX) / steps;
            double stepY = (maxY - minY) / steps;

            for (int ix = 1; ix < steps; ix++)
            {
                for (int iy = 1; iy < steps; iy++)
                {
                    double tx = minX + ix * stepX;
                    double ty = minY + iy * stepY;
                    if (IsPointInPolygon(tx, ty, poly))
                    {
                        return new UV(tx, ty);
                    }
                }
            }
            return new UV(fallbackX, fallbackY);
        }

        #endregion
    }
}
