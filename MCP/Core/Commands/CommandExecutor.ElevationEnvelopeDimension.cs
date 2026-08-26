using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Newtonsoft.Json.Linq;

#if REVIT2024_OR_GREATER
using IdType = System.Int64;
#else
using IdType = System.Int32;
#endif

namespace RevitMCP.Core
{
    public partial class CommandExecutor
    {
        /// <summary>
        /// 革命性升級：基於【視圖專屬真實實體幾何投影法 (View-Specific Solid Face Projection)】
        /// 1. 直接讀取視圖中所有看得見的建築實體 (Walls, Roofs, Floors, StructuralColumns)
        /// 2. 調用 get_Geometry(Options { View = view }) 提取精確 3D Solid 表面頂點 (Vertices)
        /// 3. 嚴格過濾地上層 (Z >= GL)，精確投影至立面視圖 2D 平面 (u, v)
        /// 4. 求出純實體外輪廓極值 (uMin 左外牆皮, uMax 右外牆皮, vMax 最高女兒牆/屋頂面, vMin GL地盤線)
        /// 5. 外推 5 個等距階梯 (Step 5 藍線: Step 0 ± 5 * 6.5mm * view.Scale)
        /// 6. 自動鎖定 Step 4 與 Step 3 雙向雙層標準標註
        /// </summary>
        private object AutoAlignElevationEnvelopeAndDimension(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            if (viewId == 0 && _uiApp.ActiveUIDocument.ActiveView != null)
            {
                viewId = _uiApp.ActiveUIDocument.ActiveView.Id.GetIdValue();
            }

            View view = doc.GetElement(new ElementId(viewId)) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            if (view.ViewType != ViewType.Elevation && view.ViewType != ViewType.Section)
                throw new Exception($"視圖 {view.Name} 不是立面圖或剖面圖 (ViewType: {view.ViewType})");

            bool drawGuideLines = parameters["drawGuideLines"]?.Value<bool>() ?? true;
            bool cleanExisting = parameters["cleanExisting"]?.Value<bool>() ?? true;
            int stepModules = parameters["stepModules"]?.Value<int>() ?? 5; // 預設 5 個間距

            XYZ vRight = view.RightDirection.Normalize();
            XYZ vUp = view.UpDirection.Normalize();
            XYZ origin = view.Origin;

            // 比例與階距換算 (圖紙 6.5mm)
            double scale = view.Scale;
            const double MM_TO_FEET = 1.0 / 304.8;
            double stepSizeFeet = (6.5 * MM_TO_FEET) * scale;
            double step5Feet = stepModules * stepSizeFeet;

            // 1. 取得 GL 樓層高程基準
            var levels = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Level))
                .WhereElementIsNotElementType()
                .Cast<Level>()
                .OrderBy(l => l.Elevation)
                .ToList();

            if (levels.Count < 2)
                throw new Exception("視圖中可見的樓層線數量不足 2 個");

            Level glLevel = levels.FirstOrDefault(l => l.Name.Equals("GL", StringComparison.OrdinalIgnoreCase))
                         ?? levels.FirstOrDefault(l => l.Elevation >= -1e-4)
                         ?? levels.First();

            double glElevation = glLevel.Elevation;
            double vGlProj = (new XYZ(origin.X, origin.Y, glElevation) - origin).DotProduct(vUp);

            // 2. 收集當前視圖內所有可見實體建築構件 (Walls, Roofs, Floors, Columns, StructuralFraming)
            var categoriesToScan = new List<BuiltInCategory>
            {
                BuiltInCategory.OST_Walls,
                BuiltInCategory.OST_StackedWalls,
                BuiltInCategory.OST_Roofs,
                BuiltInCategory.OST_Floors,
                BuiltInCategory.OST_StructuralColumns,
                BuiltInCategory.OST_StructuralFraming,
                BuiltInCategory.OST_Fascia
            };

            var elementFilter = new ElementMulticategoryFilter(categoriesToScan);
            var visiblePhysicalElements = new FilteredElementCollector(doc, view.Id)
                .WherePasses(elementFilter)
                .WhereElementIsNotElementType()
                .ToList();

            Options geomOptions = new Options
            {
                View = view,
                ComputeReferences = true,
                IncludeNonVisibleObjects = false,
                DetailLevel = ViewDetailLevel.Fine
            };

            double uMin = double.MaxValue;
            double uMax = double.MinValue;
            double vMax = double.MinValue;
            double vMinSection = double.MaxValue;
            int vertexCount = 0;

            Action<Solid> extractSolidVertices = (solid) =>
            {
                if (solid == null || solid.Volume <= 1e-6 || solid.Faces.Size == 0) return;

                foreach (Face face in solid.Faces)
                {
                    foreach (EdgeArray loop in face.EdgeLoops)
                    {
                        foreach (Edge edge in loop)
                        {
                            IList<XYZ> pts = edge.Tessellate();
                            if (pts == null) continue;

                            foreach (XYZ pt in pts)
                            {
                                vertexCount++;
                                XYZ diff = pt - origin;
                                double u = diff.DotProduct(vRight);
                                double v = diff.DotProduct(vUp);

                                if (view.ViewType == ViewType.Elevation)
                                {
                                    // 立面圖：只考慮地上層 (Z >= GL - 50mm)，排除地底基礎干擾
                                    if (pt.Z >= glElevation - (50.0 * MM_TO_FEET))
                                    {
                                        if (u < uMin) uMin = u;
                                        if (u > uMax) uMax = u;
                                        if (v > vMax) vMax = v;
                                    }
                                }
                                else
                                {
                                    // 剖面圖：納入地下筏基全範圍
                                    if (u < uMin) uMin = u;
                                    if (u > uMax) uMax = u;
                                    if (v > vMax) vMax = v;
                                    if (v < vMinSection) vMinSection = v;
                                }
                            }
                        }
                    }
                }
            };

            foreach (var elem in visiblePhysicalElements)
            {
                GeometryElement geomElem = null;
                try { geomElem = elem.get_Geometry(geomOptions); } catch { }
                if (geomElem == null) continue;

                foreach (GeometryObject geomObj in geomElem)
                {
                    if (geomObj is Solid solid)
                    {
                        extractSolidVertices(solid);
                    }
                    else if (geomObj is GeometryInstance geomInst)
                    {
                        GeometryElement instGeom = geomInst.GetInstanceGeometry();
                        if (instGeom != null)
                        {
                            foreach (GeometryObject instObj in instGeom)
                            {
                                if (instObj is Solid instSolid)
                                    extractSolidVertices(instSolid);
                            }
                        }
                    }
                }
            }

            // 底部基準判定 (Step 0 底線)
            double vBottomStep0 = (view.ViewType == ViewType.Section) ? vMinSection : vGlProj;
            double vTopStep0 = vMax;

            // 防呆處理
            if (uMin == double.MaxValue || uMax == double.MinValue || vMax == double.MinValue)
            {
                throw new Exception($"未能從視圖 {view.Name} 提取到足夠的可見實體幾何頂點 (掃描構件數: {visiblePhysicalElements.Count})");
            }

            // 3. 計算 Step 5 藍線邊界 (5 個間距)
            double uLeftBlue = uMin - step5Feet;
            double uRightBlue = uMax + step5Feet;
            double vTopBlue = vTopStep0 + step5Feet;
            double vBottomBlue = vBottomStep0 - step5Feet;

            // 4. 收集視圖中可見的軸線 (Grids) 與 樓層線 (Levels)
            var grids = new FilteredElementCollector(doc, view.Id)
                .OfCategory(BuiltInCategory.OST_Grids)
                .WhereElementIsNotElementType()
                .Cast<Grid>()
                .ToList();

            var gridInfos = new List<(Grid grid, double u, Curve curve)>();
            foreach (var g in grids)
            {
                IList<Curve> crvs = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                if (crvs == null || crvs.Count == 0) continue;
                Curve c = crvs[0];
                XYZ ep0 = c.GetEndPoint(0);
                XYZ ep1 = c.GetEndPoint(1);
                double u0 = (ep0 - origin).DotProduct(vRight);
                double u1 = (ep1 - origin).DotProduct(vRight);
                double uAvg = (u0 + u1) / 2.0;
                gridInfos.Add((g, uAvg, c));
            }
            gridInfos.Sort((a, b) => a.u.CompareTo(b.u)); // 由左至右

            // 樓層過濾 (立面圖以 GL 為底，剖面圖包含地下層)
            List<Level> levelsToDim = (view.ViewType == ViewType.Section)
                ? levels.ToList()
                : levels.Where(l => l.Elevation >= glElevation - 1e-4).ToList();

            // 5. 標註型式解析
            var allDimTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(DimensionType))
                .Cast<DimensionType>()
                .ToList();

            DimensionType typeUpRight = allDimTypes.FirstOrDefault(t => t.Name.Contains("柱心-上右") || t.Name.Contains("上右"))
                                     ?? allDimTypes.FirstOrDefault(t => t.Name.Contains("柱心") || t.Name.Contains("對齊") || t.Name.Contains("Linear"));
            DimensionType typeDownRight = allDimTypes.FirstOrDefault(t => t.Name.Contains("柱心-下右") || t.Name.Contains("下右"))
                                       ?? typeUpRight;

            Dimension dimGridTotal = null;
            Dimension dimGridCont = null;
            Dimension dimLevelTotal = null;
            Dimension dimLevelCont = null;
            int linesCreated = 0;

            using (Transaction trans = TransactionHelper.Begin(doc, "視圖實體幾何投影-立面外輪廓標註"))
            {
                trans.Start();

                // A. 清理舊尺寸與舊線條
                if (cleanExisting)
                {
                    var oldDims = new FilteredElementCollector(doc, view.Id)
                        .OfClass(typeof(Dimension))
                        .WhereElementIsNotElementType()
                        .Select(e => e.Id)
                        .ToList();
                    foreach (var id in oldDims) { try { doc.Delete(id); } catch { } }

                    var oldLines = new FilteredElementCollector(doc, view.Id)
                        .OfClass(typeof(CurveElement))
                        .Where(e => e is DetailCurve)
                        .Select(e => e.Id)
                        .ToList();
                    foreach (var id in oldLines) { try { doc.Delete(id); } catch { } }
                }

                // B. 主動整列軸線 (Grids) 頂端至頂部藍線 (Step 5)
                foreach (var gInfo in gridInfos)
                {
                    try
                    {
                        XYZ startPt = origin + vRight * gInfo.u + vUp * (vBottomStep0 - stepSizeFeet);
                        XYZ endPt = origin + vRight * gInfo.u + vUp * vTopBlue;
                        Line newGridCurve = Line.CreateBound(startPt, endPt);
                        gInfo.grid.SetCurveInView(DatumExtentType.ViewSpecific, view, newGridCurve);
                        gInfo.grid.ShowBubbleInView(DatumEnds.End1, view);
                        gInfo.grid.HideBubbleInView(DatumEnds.End0, view);
                    }
                    catch { }
                }

                // C. 主動整列樓層線 (Levels) 左端至左側藍線 (Step 5)
                foreach (var lv in levelsToDim)
                {
                    try
                    {
                        IList<Curve> lCrvs = lv.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                        if (lCrvs != null && lCrvs.Count > 0)
                        {
                            double vLv = (new XYZ(origin.X, origin.Y, lv.Elevation) - origin).DotProduct(vUp);
                            XYZ startPt = origin + vRight * uLeftBlue + vUp * vLv;
                            XYZ endPt = origin + vRight * (uMax + stepSizeFeet) + vUp * vLv;
                            Line newLevelCurve = Line.CreateBound(startPt, endPt);
                            lv.SetCurveInView(DatumExtentType.ViewSpecific, view, newLevelCurve);
                            lv.ShowBubbleInView(DatumEnds.End0, view);
                            lv.HideBubbleInView(DatumEnds.End1, view);
                        }
                    }
                    catch { }
                }

                // D. 頂部柱心雙層標註 (Step 4 總跨, Step 3 連續) - 向量由右至左
                if (gridInfos.Count >= 2)
                {
                    double vTier1 = vTopStep0 + 4 * stepSizeFeet; // Step 4
                    double vTier2 = vTopStep0 + 3 * stepSizeFeet; // Step 3

                    XYZ pTop1_start = origin + vRight * gridInfos.Last().u + vUp * vTier1;
                    XYZ pTop1_end = origin + vRight * gridInfos.First().u + vUp * vTier1;
                    Line lineTop1 = Line.CreateBound(pTop1_start, pTop1_end);

                    XYZ pTop2_start = origin + vRight * gridInfos.Last().u + vUp * vTier2;
                    XYZ pTop2_end = origin + vRight * gridInfos.First().u + vUp * vTier2;
                    Line lineTop2 = Line.CreateBound(pTop2_start, pTop2_end);

                    ReferenceArray refOverall = new ReferenceArray();
                    refOverall.Append(new Reference(gridInfos.Last().grid));
                    refOverall.Append(new Reference(gridInfos.First().grid));

                    ReferenceArray refContinuous = new ReferenceArray();
                    for (int i = gridInfos.Count - 1; i >= 0; i--)
                    {
                        refContinuous.Append(new Reference(gridInfos[i].grid));
                    }

                    dimGridTotal = doc.Create.NewDimension(view, lineTop1, refOverall);
                    dimGridCont = doc.Create.NewDimension(view, lineTop2, refContinuous);

                    if (typeUpRight != null)
                    {
                        if (dimGridTotal != null) dimGridTotal.ChangeTypeId(typeUpRight.Id);
                        if (dimGridCont != null) dimGridCont.ChangeTypeId(typeUpRight.Id);
                    }
                }

                // E. 左側樓層雙層標註 (Step 4 總高, Step 3 連續) - 向量由頂至底
                if (levelsToDim.Count >= 2)
                {
                    double uTier1 = uMin - 4 * stepSizeFeet; // Step 4
                    double uTier2 = uMin - 3 * stepSizeFeet; // Step 3

                    double vTopLv = (new XYZ(origin.X, origin.Y, levelsToDim.Last().Elevation) - origin).DotProduct(vUp);
                    double vBotLv = (new XYZ(origin.X, origin.Y, levelsToDim.First().Elevation) - origin).DotProduct(vUp);

                    XYZ pLevel1_start = origin + vRight * uTier1 + vUp * vTopLv;
                    XYZ pLevel1_end = origin + vRight * uTier1 + vUp * vBotLv;
                    Line lineLevel1 = Line.CreateBound(pLevel1_start, pLevel1_end);

                    XYZ pLevel2_start = origin + vRight * uTier2 + vUp * vTopLv;
                    XYZ pLevel2_end = origin + vRight * uTier2 + vUp * vBotLv;
                    Line lineLevel2 = Line.CreateBound(pLevel2_start, pLevel2_end);

                    ReferenceArray refLevelTotal = new ReferenceArray();
                    refLevelTotal.Append(levelsToDim.Last().GetPlaneReference());
                    refLevelTotal.Append(levelsToDim.First().GetPlaneReference());

                    ReferenceArray refLevelCont = new ReferenceArray();
                    for (int i = levelsToDim.Count - 1; i >= 0; i--)
                    {
                        refLevelCont.Append(levelsToDim[i].GetPlaneReference());
                    }

                    dimLevelTotal = doc.Create.NewDimension(view, lineLevel1, refLevelTotal);
                    dimLevelCont = doc.Create.NewDimension(view, lineLevel2, refLevelCont);

                    if (typeDownRight != null)
                    {
                        if (dimLevelTotal != null) dimLevelTotal.ChangeTypeId(typeDownRight.Id);
                        if (dimLevelCont != null) dimLevelCont.ChangeTypeId(typeDownRight.Id);
                    }
                }

                // F. 繪製 Step 0 紅線與 Step 5 藍線 (在視圖投影平面上直接繪製，0 誤差)
                if (drawGuideLines)
                {
                    // 🔴 紅線 (Step 0)
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * (uMin - 2.0) + vUp * vBottomStep0, origin + vRight * (uMax + 2.0) + vUp * vBottomStep0));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * (uMin - 2.0) + vUp * vTopStep0, origin + vRight * (uMax + 2.0) + vUp * vTopStep0));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * uMin + vUp * (vBottomStep0 - 2.0), origin + vRight * uMin + vUp * (vTopStep0 + 2.0)));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * uMax + vUp * (vBottomStep0 - 2.0), origin + vRight * uMax + vUp * (vTopStep0 + 2.0)));

                    // 🔵 藍線 (Step 5)
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * (uLeftBlue - 3.0) + vUp * vTopBlue, origin + vRight * (uRightBlue + 3.0) + vUp * vTopBlue));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * uLeftBlue + vUp * (vBottomBlue - 3.0), origin + vRight * uLeftBlue + vUp * (vTopBlue + 3.0)));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * (uLeftBlue - 3.0) + vUp * vBottomBlue, origin + vRight * (uRightBlue + 3.0) + vUp * vBottomBlue));
                    doc.Create.NewDetailCurve(view, Line.CreateBound(origin + vRight * uRightBlue + vUp * (vBottomBlue - 3.0), origin + vRight * uRightBlue + vUp * (vTopBlue + 3.0)));

                    linesCreated = 8;
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                ViewType = view.ViewType.ToString(),
                Scale = view.Scale,
                ScannedElementsCount = visiblePhysicalElements.Count,
                VerticesProjected = vertexCount,
                StepSizeMm = Math.Round(stepSizeFeet / MM_TO_FEET, 1),
                EnvelopeStep0 = new
                {
                    LeftMm = Math.Round(uMin / MM_TO_FEET, 1),
                    RightMm = Math.Round(uMax / MM_TO_FEET, 1),
                    BottomMm = Math.Round(vBottomStep0 / MM_TO_FEET, 1),
                    TopMm = Math.Round(vTopStep0 / MM_TO_FEET, 1)
                },
                BlueFrameStep5 = new
                {
                    LeftMm = Math.Round(uLeftBlue / MM_TO_FEET, 1),
                    RightMm = Math.Round(uRightBlue / MM_TO_FEET, 1),
                    BottomMm = Math.Round(vBottomBlue / MM_TO_FEET, 1),
                    TopMm = Math.Round(vTopBlue / MM_TO_FEET, 1)
                },
                GridDimensions = new
                {
                    TotalDimensionId = dimGridTotal?.Id.GetIdValue(),
                    ContinuousDimensionId = dimGridCont?.Id.GetIdValue(),
                    Grids = gridInfos.Select(g => g.grid.Name).ToList()
                },
                LevelDimensions = new
                {
                    TotalDimensionId = dimLevelTotal?.Id.GetIdValue(),
                    ContinuousDimensionId = dimLevelCont?.Id.GetIdValue(),
                    Levels = levelsToDim.Select(l => l.Name).ToList()
                },
                GuideLinesCreated = linesCreated
            };
        }
    }
}
