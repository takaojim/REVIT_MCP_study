using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Clipper2Lib;
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
        private const double CLIPPER_SCALE = 100.0; // 1 unit = 0.01 mm

        private static readonly BuiltInCategory[] DefaultEnvelopeCategories = new[]
        {
            BuiltInCategory.OST_Walls,
            BuiltInCategory.OST_Roofs,
            BuiltInCategory.OST_Floors,
            BuiltInCategory.OST_StructuralColumns,
            BuiltInCategory.OST_Columns,
            BuiltInCategory.OST_StructuralFraming,
            BuiltInCategory.OST_GenericModel,
            BuiltInCategory.OST_CurtainWallPanels,
            BuiltInCategory.OST_Stairs,
            BuiltInCategory.OST_Ramps,
            BuiltInCategory.OST_Fascia,
            BuiltInCategory.OST_Gutter,
            BuiltInCategory.OST_EdgeSlab
        };

        /// <summary>
        /// 取得立面/剖面視圖之建築外輪廓 Silhouette (Clipper2 Polygon Union)
        /// </summary>
        private object GetElevationOuterContour(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewIdParam = parameters["viewId"]?.Value<IdType>() ?? 0;
            View view = viewIdParam == 0
                ? doc.ActiveView
                : doc.GetElement(viewIdParam.ToElementId()) as View;

            if (view == null)
                throw new Exception($"找不到視圖 ID={viewIdParam}");

            double toleranceMm = parameters["tolerance_mm"]?.Value<double>() ?? 10.0;
            bool drawContour = parameters["draw_contour"]?.Value<bool>() ?? false;
            string lineStyleName = parameters["line_style"]?.Value<string>();

            // 1. 取得 View 2D 投影基準
            XYZ origin = view.Origin;
            XYZ right = view.RightDirection.Normalize();
            XYZ up = view.UpDirection.Normalize();

            // 2. 收集指定 Category 的可見建築元素
            var categories = new HashSet<BuiltInCategory>(DefaultEnvelopeCategories);
            var includeCats = parameters["includeCategories"]?.ToObject<List<string>>();
            if (includeCats != null && includeCats.Count > 0)
            {
                categories.Clear();
                foreach (var catName in includeCats)
                {
                    if (Enum.TryParse<BuiltInCategory>("OST_" + catName, true, out var bic) ||
                        Enum.TryParse<BuiltInCategory>(catName, true, out bic))
                    {
                        categories.Add(bic);
                    }
                }
            }

            var excludeCats = parameters["excludeCategories"]?.ToObject<List<string>>();
            if (excludeCats != null && excludeCats.Count > 0)
            {
                foreach (var catName in excludeCats)
                {
                    if (Enum.TryParse<BuiltInCategory>("OST_" + catName, true, out var bic) ||
                        Enum.TryParse<BuiltInCategory>(catName, true, out bic))
                    {
                        categories.Remove(bic);
                    }
                }
            }

            // 3. 取得所有目標 Element 並萃取 3D 幾何 Triangle
            var catFilters = categories.Select(c => new ElementMulticategoryFilter(new List<BuiltInCategory> { c })).Cast<ElementFilter>().ToList();
            var multiFilter = new LogicalOrFilter(catFilters);

            var collector = new FilteredElementCollector(doc, view.Id)
                .WherePasses(multiFilter)
                .WhereElementIsNotElementType();

            var elements = collector.ToElements();
            var trianglePaths = new List<Path64>();
            var sourceElementIds = new List<long>();

            var geomOptions = new Options
            {
                View = view,
                ComputeReferences = false,
                IncludeNonVisibleObjects = false
            };

            foreach (var elem in elements)
            {
                GeometryElement geomElem = null;
                try
                {
                    geomElem = elem.get_Geometry(geomOptions);
                }
                catch
                {
                    continue;
                }

                if (geomElem == null) continue;

                int initialCount = trianglePaths.Count;
                ExtractTrianglesFromGeometry(geomElem, null, trianglePaths, origin, right, up);

                if (trianglePaths.Count > initialCount)
                {
                    sourceElementIds.Add(elem.Id.GetIdValue());
                }
            }

            if (trianglePaths.Count == 0)
            {
                return new
                {
                    viewId = view.Id.GetIdValue(),
                    viewName = view.Name,
                    viewType = view.ViewType.ToString(),
                    sourceElementCount = 0,
                    projectedTriangleCount = 0,
                    primaryContour = new List<object>(),
                    componentsCount = 0,
                    message = "在當前視圖未偵測到任何有效的建築幾何三角形。"
                };
            }

            // 4. 執行 Clipper2 Polygon Union
            Paths64 pathsToUnion = new Paths64(trianglePaths);
            Paths64 unioned = Clipper.Union(pathsToUnion, FillRule.NonZero);

            // 5. 簡化微小毛邊
            if (toleranceMm > 0)
            {
                double epsScaled = toleranceMm * CLIPPER_SCALE;
                unioned = Clipper.SimplifyPaths(unioned, epsScaled);
            }

            // 6. 分離外輪廓 (Exterior Rings) 與內洞 (Interior Holes)
            var exteriorRings = new List<Path64>();
            var interiorHoles = new List<Path64>();

            foreach (var poly in unioned)
            {
                if (poly.Count < 3) continue;
                double area = Clipper.Area(poly);
                if (area > 0)
                {
                    exteriorRings.Add(poly);
                }
                else if (area < 0)
                {
                    interiorHoles.Add(poly);
                }
            }

            exteriorRings = exteriorRings.OrderByDescending(p => Math.Abs(Clipper.Area(p))).ToList();

            // 7. 轉換為輸出格式 (mm)
            var allComponents = new List<List<object>>();
            double minU = double.MaxValue, maxU = double.MinValue;
            double minV = double.MaxValue, maxV = double.MinValue;

            foreach (var ring in exteriorRings)
            {
                var pointList = new List<object>();
                foreach (var pt in ring)
                {
                    double uMm = pt.X / CLIPPER_SCALE;
                    double vMm = pt.Y / CLIPPER_SCALE;

                    if (uMm < minU) minU = uMm;
                    if (uMm > maxU) maxU = uMm;
                    if (vMm < minV) minV = vMm;
                    if (vMm > maxV) maxV = vMm;

                    pointList.Add(new { x = Math.Round(uMm, 2), y = Math.Round(vMm, 2) });
                }
                allComponents.Add(pointList);
            }

            var primaryContour = allComponents.Count > 0 ? allComponents[0] : new List<object>();
            double widthMm = (maxU > minU) ? Math.Round(maxU - minU, 2) : 0.0;
            double heightMm = (maxV > minV) ? Math.Round(maxV - minV, 2) : 0.0;

            // 8. 若要求繪製，建立 DetailLines 回寫 Revit
            int drawnLineCount = 0;
            if (drawContour && exteriorRings.Count > 0)
            {
                using (Transaction trans = new Transaction(doc, "Draw Elevation Outer Contour"))
                {
                    trans.Start();

                    GraphicsStyle lineStyle = null;
                    if (!string.IsNullOrEmpty(lineStyleName))
                    {
                        lineStyle = FindLineStyle(doc, lineStyleName);
                    }

                    foreach (var ring in exteriorRings)
                    {
                        for (int i = 0; i < ring.Count; i++)
                        {
                            var p0 = ring[i];
                            var p1 = ring[(i + 1) % ring.Count];

                            double u0Ft = (p0.X / CLIPPER_SCALE) / 304.8;
                            double v0Ft = (p0.Y / CLIPPER_SCALE) / 304.8;
                            double u1Ft = (p1.X / CLIPPER_SCALE) / 304.8;
                            double v1Ft = (p1.Y / CLIPPER_SCALE) / 304.8;

                            XYZ xyz0 = origin + right * u0Ft + up * v0Ft;
                            XYZ xyz1 = origin + right * u1Ft + up * v1Ft;

                            if (xyz0.DistanceTo(xyz1) < 0.001) continue;

                            try
                            {
                                Line line = Line.CreateBound(xyz0, xyz1);
                                DetailCurve dc = doc.Create.NewDetailCurve(view, line);
                                if (lineStyle != null)
                                {
                                    dc.LineStyle = lineStyle;
                                }
                                drawnLineCount++;
                            }
                            catch
                            {
                                // 忽略微小線段異常
                            }
                        }
                    }

                    trans.Commit();
                }
            }

            return new
            {
                viewId = view.Id.GetIdValue(),
                viewName = view.Name,
                viewType = view.ViewType.ToString(),
                sourceElementCount = sourceElementIds.Count,
                projectedTriangleCount = trianglePaths.Count,
                widthMm = widthMm,
                heightMm = heightMm,
                boundsMm = new
                {
                    minU = Math.Round(minU, 2),
                    maxU = Math.Round(maxU, 2),
                    minV = Math.Round(minV, 2),
                    maxV = Math.Round(maxV, 2)
                },
                componentsCount = exteriorRings.Count,
                primaryContour = primaryContour,
                allExteriorContours = allComponents,
                drawnLineCount = drawnLineCount,
                sourceElements = sourceElementIds
            };
        }

        /// <summary>
        /// 繪製外輪廓線至指定視圖
        /// </summary>
        private object DrawElevationOuterContour(JObject parameters)
        {
            parameters["draw_contour"] = true;
            return GetElevationOuterContour(parameters);
        }

        /// <summary>
        /// 繪製立面視圖 Step 0 實體外圍方形紅線 與 Step 5 齊頭藍線，並對齊軸線/樓層線
        /// </summary>
        private object DrawElevationEnvelopeBoxes(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewIdParam = parameters["viewId"]?.Value<IdType>() ?? 0;
            View view = viewIdParam == 0
                ? doc.ActiveView
                : doc.GetElement(viewIdParam.ToElementId()) as View;

            if (view == null)
                throw new Exception($"找不到視圖 ID={viewIdParam}");

            int stepModules = parameters["stepModules"]?.Value<int>() ?? 5;
            double spacingMm = parameters["spacingMm"]?.Value<double>() ?? 650.0;
            double totalOffsetMm = stepModules * spacingMm;
            bool cleanExisting = parameters["cleanExisting"]?.Value<bool>() ?? true;
            bool alignDatum = parameters["alignDatum"]?.Value<bool>() ?? true;

            XYZ origin = view.Origin;
            XYZ right = view.RightDirection.Normalize();
            XYZ up = view.UpDirection.Normalize();

            // 1. 先透過 Contour 幾何獲取準確外框極值 (uMin, uMax, vMax)
            var contourData = GetElevationOuterContour(new JObject { ["viewId"] = view.Id.GetIdValue(), ["draw_contour"] = false });
            var jContour = JObject.FromObject(contourData);
            var bounds = jContour["boundsMm"];

            if (bounds == null)
                throw new Exception("無法計算當前立面的建築幾何輪廓");

            double minU = bounds["minU"].Value<double>();
            double maxU = bounds["maxU"].Value<double>();
            double maxV = bounds["maxV"].Value<double>();

            // 2. 獲取 GL Level 的真實幾何投影高度 (vGL)
            var glLevel = new FilteredElementCollector(doc)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .FirstOrDefault(l => l.Name.Equals("GL", StringComparison.OrdinalIgnoreCase))
                ?? new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>().FirstOrDefault(l => Math.Abs(l.Elevation) < 1e-3);

            double glElevationFt = glLevel != null ? glLevel.Elevation : 0.0;
            XYZ glSamplePt = new XYZ(origin.X, origin.Y, glElevationFt);
            double vGlFt = (glSamplePt - origin).DotProduct(up); // 真實 GL 在視圖中的 V 座標 (英呎)

            // Step 0 紅色方形 (GL 至 屋突最高頂點)
            double uMinFt = minU / 304.8;
            double uMaxFt = maxU / 304.8;
            double vBottomRedFt = vGlFt;
            double vTopRedFt = maxV / 304.8;

            // Step 5 藍色齊頭線 (四向外擴 5 個間隔 = 3,250 mm)
            double totalOffsetFt = (totalOffsetMm / 304.8);
            double uLeftBlueFt = uMinFt - totalOffsetFt;
            double uRightBlueFt = uMaxFt + totalOffsetFt;
            double vTopBlueFt = vTopRedFt + totalOffsetFt;
            double vBottomBlueFt = vGlFt - totalOffsetFt; // 真正從 GL 往下延伸 5 個間隔！

            int linesDrawn = 0;

            using (Transaction trans = new Transaction(doc, "Draw Elevation Red and Blue Boxes & Align Datum"))
            {
                trans.Start();

                // (A) 清除舊的 DetailLines 與 Dimensions
                if (cleanExisting)
                {
                    var oldCurves = new FilteredElementCollector(doc, view.Id)
                        .OfClass(typeof(CurveElement))
                        .WhereElementIsNotElementType()
                        .ToElementIds();

                    foreach (var cid in oldCurves)
                    {
                        try { doc.Delete(cid); } catch { }
                    }

                    var oldDims = new FilteredElementCollector(doc, view.Id)
                        .OfClass(typeof(Dimension))
                        .WhereElementIsNotElementType()
                        .ToElementIds();

                    foreach (var did in oldDims)
                    {
                        try { doc.Delete(did); } catch { }
                    }
                }

                // (B) 確保專屬鮮明紅色與藍色線條樣式
                GraphicsStyle redStyle = EnsureLineStyle(doc, "Step0-外牆輪廓紅線", new Color(230, 30, 30), 4);
                GraphicsStyle blueStyle = EnsureLineStyle(doc, "Step5-齊頭藍線", new Color(30, 100, 240), 2);

                // (C) 繪製 Step 0 紅色外框 (4 段: GL地面、兩側外牆、最高屋突女兒牆)
                XYZ r0 = origin + right * uMinFt + up * vBottomRedFt;
                XYZ r1 = origin + right * uMaxFt + up * vBottomRedFt;
                XYZ r2 = origin + right * uMaxFt + up * vTopRedFt;
                XYZ r3 = origin + right * uMinFt + up * vTopRedFt;

                DrawSegment(doc, view, r0, r1, redStyle);
                DrawSegment(doc, view, r1, r2, redStyle);
                DrawSegment(doc, view, r2, r3, redStyle);
                DrawSegment(doc, view, r3, r0, redStyle);
                linesDrawn += 4;

                // (D) 繪製 Step 5 藍色齊頭框 (4 段: 四向外擴 5 個間隔)
                XYZ b0 = origin + right * uLeftBlueFt + up * vBottomBlueFt;
                XYZ b1 = origin + right * uRightBlueFt + up * vBottomBlueFt;
                XYZ b2 = origin + right * uRightBlueFt + up * vTopBlueFt;
                XYZ b3 = origin + right * uLeftBlueFt + up * vTopBlueFt;

                DrawSegment(doc, view, b0, b1, blueStyle);
                DrawSegment(doc, view, b1, b2, blueStyle);
                DrawSegment(doc, view, b2, b3, blueStyle);
                DrawSegment(doc, view, b3, b0, blueStyle);
                linesDrawn += 4;

                // (E) 軸線與樓層線齊頭整列 (Datum Alignment)
                if (alignDatum)
                {
                    // 1. 軸線 Grids 垂直線：頂端貼齊 vTopBlueFt，底端貼齊 vBottomBlueFt
                    var grids = new FilteredElementCollector(doc, view.Id)
                        .OfCategory(BuiltInCategory.OST_Grids)
                        .WhereElementIsNotElementType()
                        .Cast<Grid>()
                        .ToList();

                    foreach (var g in grids)
                    {
                        try
                        {
                            g.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                            g.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                            IList<Curve> curves = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                            if (curves == null || curves.Count == 0) continue;

                            Curve c = curves[0];
                            XYZ ep0 = c.GetEndPoint(0);
                            XYZ ep1 = c.GetEndPoint(1);

                            double uGrid = ((ep0 - origin).DotProduct(right) + (ep1 - origin).DotProduct(right)) / 2.0;

                            XYZ newBot = origin + right * uGrid + up * vBottomBlueFt;
                            XYZ newTop = origin + right * uGrid + up * vTopBlueFt;

                            Line newGridCurve = Line.CreateBound(newBot, newTop);
                            g.SetCurveInView(DatumExtentType.ViewSpecific, view, newGridCurve);

                            g.HideBubbleInView(DatumEnds.End0, view); // 下方隱藏氣泡
                            g.ShowBubbleInView(DatumEnds.End1, view); // 上方顯示氣泡
                        }
                        catch { }
                    }

                    // 2. 樓層線 Levels 水平線：左端貼齊 uLeftBlueFt，右端貼齊 uRightBlueFt
                    var levels = new FilteredElementCollector(doc, view.Id)
                        .OfClass(typeof(Level))
                        .WhereElementIsNotElementType()
                        .Cast<Level>()
                        .ToList();

                    foreach (var l in levels)
                    {
                        try
                        {
                            l.SetDatumExtentType(DatumEnds.End0, view, DatumExtentType.ViewSpecific);
                            l.SetDatumExtentType(DatumEnds.End1, view, DatumExtentType.ViewSpecific);

                            IList<Curve> curves = l.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                            if (curves == null || curves.Count == 0) continue;

                            Curve c = curves[0];
                            XYZ ep0 = c.GetEndPoint(0);
                            XYZ ep1 = c.GetEndPoint(1);

                            double vLevel = ((ep0 - origin).DotProduct(up) + (ep1 - origin).DotProduct(up)) / 2.0;

                            XYZ newLeft = origin + right * uLeftBlueFt + up * vLevel;
                            XYZ newRight = origin + right * uRightBlueFt + up * vLevel;

                            Line newLevelCurve = Line.CreateBound(newLeft, newRight);
                            l.SetCurveInView(DatumExtentType.ViewSpecific, view, newLevelCurve);

                            l.ShowBubbleInView(DatumEnds.End0, view); // 左側顯示氣泡
                            l.HideBubbleInView(DatumEnds.End1, view); // 右側隱藏氣泡
                        }
                        catch { }
                    }
                }

                trans.Commit();
            }

            return new
            {
                viewId = view.Id.GetIdValue(),
                viewName = view.Name,
                redBox = new
                {
                    minU = Math.Round(minU, 2),
                    maxU = Math.Round(maxU, 2),
                    vGL = Math.Round(vGlFt * 304.8, 2),
                    vRoof = Math.Round(maxV, 2),
                    widthMm = Math.Round(maxU - minU, 2),
                    heightMm = Math.Round(maxV - (vGlFt * 304.8), 2)
                },
                blueBox = new
                {
                    uLeft = Math.Round((uMinFt - totalOffsetFt) * 304.8, 2),
                    uRight = Math.Round((uMaxFt + totalOffsetFt) * 304.8, 2),
                    vTop = Math.Round((vTopRedFt + totalOffsetFt) * 304.8, 2),
                    vBottom = Math.Round((vGlFt - totalOffsetFt) * 304.8, 2)
                },
                linesDrawn = linesDrawn
            };
        }

        private GraphicsStyle EnsureLineStyle(Document doc, string name, Color color, int weight)
        {
            var categories = doc.Settings.Categories;
            Category lineCat = categories.get_Item(BuiltInCategory.OST_Lines);
            if (lineCat != null && lineCat.SubCategories != null)
            {
                foreach (Category sub in lineCat.SubCategories)
                {
                    if (sub.Name == name)
                    {
                        sub.LineColor = color;
                        sub.SetLineWeight(weight, GraphicsStyleType.Projection);
                        return sub.GetGraphicsStyle(GraphicsStyleType.Projection);
                    }
                }

                try
                {
                    Category newSub = categories.NewSubcategory(lineCat, name);
                    newSub.LineColor = color;
                    newSub.SetLineWeight(weight, GraphicsStyleType.Projection);
                    return newSub.GetGraphicsStyle(GraphicsStyleType.Projection);
                }
                catch
                {
                    // ignored
                }
            }
            return null;
        }

        private void DrawSegment(Document doc, View view, XYZ p0, XYZ p1, GraphicsStyle style)
        {
            if (p0.DistanceTo(p1) < 0.001) return;
            try
            {
                Line line = Line.CreateBound(p0, p1);
                DetailCurve dc = doc.Create.NewDetailCurve(view, line);
                if (style != null) dc.LineStyle = style;
            }
            catch { }
        }

        private void ExtractTrianglesFromGeometry(
            GeometryObject geomObj,
            Transform parentTransform,
            List<Path64> trianglePaths,
            XYZ origin,
            XYZ right,
            XYZ up)
        {
            if (geomObj == null) return;

            if (geomObj is Solid solid)
            {
                if (solid.Volume <= 0 || solid.Faces.IsEmpty) return;

                foreach (Face face in solid.Faces)
                {
                    Mesh mesh = null;
                    try
                    {
                        mesh = face.Triangulate();
                    }
                    catch
                    {
                        continue;
                    }

                    if (mesh == null) continue;

                    for (int i = 0; i < mesh.NumTriangles; i++)
                    {
                        MeshTriangle tri = mesh.get_Triangle(i);
                        XYZ p0 = tri.get_Vertex(0);
                        XYZ p1 = tri.get_Vertex(1);
                        XYZ p2 = tri.get_Vertex(2);

                        if (parentTransform != null)
                        {
                            p0 = parentTransform.OfPoint(p0);
                            p1 = parentTransform.OfPoint(p1);
                            p2 = parentTransform.OfPoint(p2);
                        }

                        AddProjectedTriangle(p0, p1, p2, trianglePaths, origin, right, up);
                    }
                }
            }
            else if (geomObj is Mesh directMesh)
            {
                for (int i = 0; i < directMesh.NumTriangles; i++)
                {
                    MeshTriangle tri = directMesh.get_Triangle(i);
                    XYZ p0 = tri.get_Vertex(0);
                    XYZ p1 = tri.get_Vertex(1);
                    XYZ p2 = tri.get_Vertex(2);

                    if (parentTransform != null)
                    {
                        p0 = parentTransform.OfPoint(p0);
                        p1 = parentTransform.OfPoint(p1);
                        p2 = parentTransform.OfPoint(p2);
                    }

                    AddProjectedTriangle(p0, p1, p2, trianglePaths, origin, right, up);
                }
            }
            else if (geomObj is GeometryInstance inst)
            {
                GeometryElement instGeom = null;
                try
                {
                    instGeom = inst.GetInstanceGeometry();
                }
                catch
                {
                    // ignored
                }

                if (instGeom != null)
                {
                    foreach (GeometryObject child in instGeom)
                    {
                        ExtractTrianglesFromGeometry(child, parentTransform, trianglePaths, origin, right, up);
                    }
                }
                else
                {
                    GeometryElement symbolGeom = inst.GetSymbolGeometry();
                    if (symbolGeom != null)
                    {
                        Transform combined = parentTransform != null ? parentTransform.Multiply(inst.Transform) : inst.Transform;
                        foreach (GeometryObject child in symbolGeom)
                        {
                            ExtractTrianglesFromGeometry(child, combined, trianglePaths, origin, right, up);
                        }
                    }
                }
            }
            else if (geomObj is GeometryElement elemGeom)
            {
                foreach (GeometryObject child in elemGeom)
                {
                    ExtractTrianglesFromGeometry(child, parentTransform, trianglePaths, origin, right, up);
                }
            }
        }

        private void AddProjectedTriangle(
            XYZ p0,
            XYZ p1,
            XYZ p2,
            List<Path64> trianglePaths,
            XYZ origin,
            XYZ right,
            XYZ up)
        {
            XYZ d0 = p0 - origin;
            XYZ d1 = p1 - origin;
            XYZ d2 = p2 - origin;

            double u0 = d0.DotProduct(right) * 304.8;
            double v0 = d0.DotProduct(up) * 304.8;

            double u1 = d1.DotProduct(right) * 304.8;
            double v1 = d1.DotProduct(up) * 304.8;

            double u2 = d2.DotProduct(right) * 304.8;
            double v2 = d2.DotProduct(up) * 304.8;

            long x0 = (long)Math.Round(u0 * CLIPPER_SCALE);
            long y0 = (long)Math.Round(v0 * CLIPPER_SCALE);
            long x1 = (long)Math.Round(u1 * CLIPPER_SCALE);
            long y1 = (long)Math.Round(v1 * CLIPPER_SCALE);
            long x2 = (long)Math.Round(u2 * CLIPPER_SCALE);
            long y2 = (long)Math.Round(v2 * CLIPPER_SCALE);

            var path = new Path64 { new Point64(x0, y0), new Point64(x1, y1), new Point64(x2, y2) };
            double area = Clipper.Area(path);
            if (Math.Abs(area) < 1.0) return; // 忽略視線垂直或退化的三角形

            if (area < 0)
            {
                path.Reverse();
            }

            trianglePaths.Add(path);
        }

        private GraphicsStyle FindLineStyle(Document doc, string name)
        {
            var categories = doc.Settings.Categories;
            Category lineCat = categories.get_Item(BuiltInCategory.OST_Lines);
            if (lineCat != null && lineCat.SubCategories != null)
            {
                foreach (Category sub in lineCat.SubCategories)
                {
                    if (sub.Name.Equals(name, StringComparison.OrdinalIgnoreCase) ||
                        sub.Name.Contains(name))
                    {
                        return sub.GetGraphicsStyle(GraphicsStyleType.Projection);
                    }
                }
            }
            return null;
        }
    }
}
