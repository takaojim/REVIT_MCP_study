using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
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
        #region 尺寸標註

        /// <summary>
        /// 使用射線偵測建立尺寸標註
        /// </summary>
        private object CreateDimensionByRay(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            double originX = parameters["origin"]?["x"]?.Value<double>() ?? 0;
            double originY = parameters["origin"]?["y"]?.Value<double>() ?? 0;
            double originZ = parameters["origin"]?["z"]?.Value<double>() ?? 0;
            double dirX = parameters["direction"]?["x"]?.Value<double>() ?? 0;
            double dirY = parameters["direction"]?["y"]?.Value<double>() ?? 0;
            double dirZ = parameters["direction"]?["z"]?.Value<double>() ?? 0;
            double counterDirX = parameters["counterDirection"]?["x"]?.Value<double>() ?? -dirX;
            double counterDirY = parameters["counterDirection"]?["y"]?.Value<double>() ?? -dirY;
            double counterDirZ = parameters["counterDirection"]?["z"]?.Value<double>() ?? -dirZ;

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            List<View3D> available3DViews = new FilteredElementCollector(doc)
                .OfClass(typeof(View3D))
                .Cast<View3D>()
                .Where(v => !v.IsTemplate)
                .OrderBy(v => v.IsSectionBoxActive ? 1 : 0)
                .ToList();

            if (available3DViews.Count == 0)
                throw new Exception("專案中沒有可用的 3D 視圖");

            using (Transaction trans = TransactionHelper.Begin(doc, "建立射線標註"))
            {
                trans.Start();

                XYZ origin = new XYZ(originX / 304.8, originY / 304.8, originZ / 304.8);
                XYZ direction = new XYZ(dirX, dirY, dirZ).Normalize();
                XYZ counterDirection = new XYZ(counterDirX, counterDirY, counterDirZ).Normalize();

                Reference ref1 = null;
                Reference ref2 = null;

                foreach (View3D view3D in available3DViews)
                {
                    ElementFilter filter = new ElementMulticategoryFilter(new List<BuiltInCategory>
                    {
                        BuiltInCategory.OST_Walls,
                        BuiltInCategory.OST_StructuralColumns,
                        BuiltInCategory.OST_Columns
                    });
                    ReferenceIntersector iterator = new ReferenceIntersector(filter, FindReferenceTarget.Face, view3D);

                    ReferenceWithContext ref1Context = iterator.FindNearest(origin, direction);
                    ReferenceWithContext ref2Context = iterator.FindNearest(origin, counterDirection);

                    if (ref1Context != null && ref2Context != null)
                    {
                        ref1 = ref1Context.GetReference();
                        ref2 = ref2Context.GetReference();
                        break;
                    }
                }

                if (ref1 == null || ref2 == null)
                    throw new Exception("所有3D視圖都無法偵測到足夠的邊界，請確認房間周圍是否有完整的牆面");

                XYZ point1 = ref1.GlobalPoint;
                XYZ point2 = ref2.GlobalPoint;

                XYZ dimDir = direction.CrossProduct(XYZ.BasisZ);
                if (dimDir.IsZeroLength()) dimDir = XYZ.BasisX;

                double offset = 500 / 304.8;
                XYZ dimLineStart = point1.Add(dimDir.Multiply(offset));
                XYZ dimLineEnd = point2.Add(dimDir.Multiply(offset));
                Line dimLine = Line.CreateBound(dimLineStart, dimLineEnd);

                ReferenceArray refArray = new ReferenceArray();
                refArray.Append(ref1);
                refArray.Append(ref2);

                Dimension dim = doc.Create.NewDimension(view, dimLine, refArray);

                trans.Commit();

                double dimValue = dim.Value.HasValue ? dim.Value.Value * 304.8 : 0;

                return new
                {
                    DimensionId = dim.Id.GetIdValue(),
                    Value = Math.Round(dimValue, 2),
                    Unit = "mm"
                };
            }
        }

        /// <summary>
        /// 使用房間邊界框標註
        /// </summary>
        private object CreateDimensionByBoundingBox(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            IdType roomId = parameters["roomId"]?.Value<IdType>() ?? 0;
            string axis = parameters["axis"]?.Value<string>() ?? "X";
            double offset = parameters["offset"]?.Value<double>() ?? 500;

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            Room room = doc.GetElement(roomId.ToElementId()) as Room;
            if (room == null)
                throw new Exception($"找不到房間 ID: {roomId}");

            BoundingBoxXYZ bbox = room.get_BoundingBox(view);
            if (bbox == null)
                throw new Exception($"房間 {room.Name} 沒有邊界框");

            using (Transaction trans = TransactionHelper.Begin(doc, "建立邊界框標註"))
            {
                trans.Start();

                XYZ min = bbox.Min;
                XYZ max = bbox.Max;
                double offsetFeet = offset / 304.8;

                XYZ point1, point2, dimLineStart, dimLineEnd;

                if (axis.ToUpper() == "X")
                {
                    double centerY = (min.Y + max.Y) / 2;
                    point1 = new XYZ(min.X, centerY, min.Z);
                    point2 = new XYZ(max.X, centerY, min.Z);
                    dimLineStart = new XYZ(min.X, centerY + offsetFeet, min.Z);
                    dimLineEnd = new XYZ(max.X, centerY + offsetFeet, min.Z);
                }
                else
                {
                    double centerX = (min.X + max.X) / 2;
                    point1 = new XYZ(centerX, min.Y, min.Z);
                    point2 = new XYZ(centerX, max.Y, min.Z);
                    dimLineStart = new XYZ(centerX + offsetFeet, min.Y, min.Z);
                    dimLineEnd = new XYZ(centerX + offsetFeet, max.Y, min.Z);
                }

                Line dimLine = Line.CreateBound(dimLineStart, dimLineEnd);

                double lineLength = 1.0;
                XYZ perpDir = (axis.ToUpper() == "X") ? XYZ.BasisY : XYZ.BasisX;

                DetailCurve dc1 = doc.Create.NewDetailCurve(view, Line.CreateBound(
                    point1.Subtract(perpDir.Multiply(lineLength / 2)),
                    point1.Add(perpDir.Multiply(lineLength / 2))));
                DetailCurve dc2 = doc.Create.NewDetailCurve(view, Line.CreateBound(
                    point2.Subtract(perpDir.Multiply(lineLength / 2)),
                    point2.Add(perpDir.Multiply(lineLength / 2))));

                ReferenceArray refArray = new ReferenceArray();
                refArray.Append(dc1.GeometryCurve.Reference);
                refArray.Append(dc2.GeometryCurve.Reference);

                Dimension dim = doc.Create.NewDimension(view, dimLine, refArray);

                trans.Commit();

                double dimValue = dim.Value.HasValue ? dim.Value.Value * 304.8 : 0;

                return new
                {
                    DimensionId = dim.Id.GetIdValue(),
                    Value = Math.Round(dimValue, 2),
                    Unit = "mm",
                    Axis = axis,
                    RoomName = room.Name
                };
            }
        }

        /// <summary>
        /// 批次自動標註牆段尺寸。
        /// 三種模式：
        ///   per_wall      = 每道牆一個長度標註（垂直牆方向偏移）
        ///   chained       = 同列／同排共線牆串接成一條 string dimension
        ///   overall_bbox  = 兩條外圍標註（top 邊沿 X 軸串、right 邊沿 Y 軸串）
        /// 直接抓牆面 reference（exterior/interior side face 或 end cap face），
        /// 牆若被刪除 / 移動 Dimension 會自動更新或消失（與一般 Revit 標註行為一致）。
        /// </summary>
        private object AutoDimensionWalls(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            string mode = (parameters["mode"]?.Value<string>() ?? "overall_bbox").ToLowerInvariant();
            double offsetMm = parameters["offsetMm"]?.Value<double>() ?? 1500;

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");
            if (!(view is ViewPlan))
                throw new Exception($"視圖 {view.Name} 不是平面圖（auto_dimension_walls 只支援 ViewPlan）");

            // 1) 收集牆
            var walls = new List<Wall>();
            var idsParam = parameters["wallIds"] as JArray;
            if (idsParam != null && idsParam.Count > 0)
            {
                foreach (var idTok in idsParam)
                {
                    IdType wid = idTok.Value<IdType>();
                    if (doc.GetElement(wid.ToElementId()) is Wall w)
                        walls.Add(w);
                }
            }
            else
            {
                walls = new FilteredElementCollector(doc, view.Id)
                    .OfClass(typeof(Wall))
                    .Cast<Wall>().ToList();
            }
            if (walls.Count == 0)
                throw new Exception("找不到任何牆（請確認 wallIds 或 view 範圍）");

            var wallLines = new List<(Wall wall, Line line)>();
            int nonLinearSkipped = 0;
            foreach (var w in walls)
            {
                if (w.Location is LocationCurve lc && lc.Curve is Line ln)
                    wallLines.Add((w, ln));
                else
                    nonLinearSkipped++;
            }
            if (wallLines.Count == 0)
                throw new Exception("沒有直線牆可標註（曲線牆暫不支援）");

            double offsetFt = offsetMm / 304.8;
            var created = new List<object>();

            using (Transaction trans = TransactionHelper.Begin(doc, "auto dimension walls"))
            {
                trans.Start();

                switch (mode)
                {
                    case "per_wall":
                        foreach (var (wall, line) in wallLines)
                        {
                            var info = CreatePerWallDim(doc, view, wall, line, offsetFt);
                            if (info != null) created.Add(info);
                        }
                        break;
                    case "chained":
                        created.AddRange(CreateChainedWallDims(doc, view, wallLines, offsetFt));
                        break;
                    case "overall_bbox":
                    default:
                        created.AddRange(CreateOverallBboxDims(doc, view, wallLines, offsetFt));
                        if (mode != "overall_bbox" && mode != "per_wall" && mode != "chained")
                            mode = "overall_bbox(fallback)";
                        break;
                }

                trans.Commit();
            }

            return new
            {
                Mode = mode,
                ViewId = viewId,
                ViewName = view.Name,
                WallCount = wallLines.Count,
                NonLinearSkipped = nonLinearSkipped,
                DimensionCount = created.Count,
                Dimensions = created
            };
        }

        private object CreatePerWallDim(Document doc, View view, Wall wall, Line wallLine, double offsetFt)
        {
            XYZ p0 = wallLine.GetEndPoint(0);
            XYZ p1 = wallLine.GetEndPoint(1);
            XYZ dir = wallLine.Direction.Normalize();
            XYZ perp = new XYZ(-dir.Y, dir.X, 0);
            if (perp.IsZeroLength()) perp = XYZ.BasisY;
            else perp = perp.Normalize();

            // 抓牆兩端的 end-cap face references（normal 平行於牆方向）。
            // 牆移動時 dimension 會跟著走；牆刪掉 dimension 自動消失。
            Reference ref0 = GetWallEndFaceReference(wall, dir, p0);
            Reference ref1 = GetWallEndFaceReference(wall, dir, p1);
            if (ref0 == null || ref1 == null)
                return null; // 拿不到 face ref（罕見，可能牆 geometry 異常），略過此牆

            var refArr = new ReferenceArray();
            refArr.Append(ref0);
            refArr.Append(ref1);

            Line dimLine = Line.CreateBound(
                p0.Add(perp.Multiply(offsetFt)),
                p1.Add(perp.Multiply(offsetFt)));

            Dimension dim = doc.Create.NewDimension(view, dimLine, refArr);
            double mm = dim.Value.HasValue ? Math.Round(dim.Value.Value * 304.8, 0) : 0;

            return new
            {
                WallId = wall.Id.GetIdValue(),
                DimensionId = dim.Id.GetIdValue(),
                ValueMm = mm
            };
        }

        /// <summary>
        /// 取得牆某一端的 end-cap PlanarFace Reference（normal 平行於 wallDir）。
        /// 找不到時回傳 null（呼叫端負責處理）。
        /// </summary>
        private Reference GetWallEndFaceReference(Wall wall, XYZ wallDir, XYZ endPoint)
        {
            Options opt = new Options
            {
                ComputeReferences = true,
                IncludeNonVisibleObjects = false,
                DetailLevel = ViewDetailLevel.Fine
            };
            GeometryElement geomElem = wall.get_Geometry(opt);
            if (geomElem == null) return null;

            Reference best = null;
            double bestDist = double.MaxValue;

            foreach (GeometryObject go in geomElem)
            {
                Solid solid = go as Solid;
                if (solid == null || solid.Faces.Size == 0) continue;
                foreach (Face f in solid.Faces)
                {
                    PlanarFace pf = f as PlanarFace;
                    if (pf == null) continue;
                    XYZ n = pf.FaceNormal;
                    // 端面 normal 應平行於牆方向（dot product 接近 ±1）
                    double dot = Math.Abs(n.DotProduct(wallDir));
                    if (dot < 0.99) continue;
                    // 取面中心離 endPoint 最近者
                    XYZ c = pf.Origin;
                    double d = c.DistanceTo(endPoint);
                    if (d < bestDist && pf.Reference != null)
                    {
                        bestDist = d;
                        best = pf.Reference;
                    }
                }
            }
            return best;
        }

        /// <summary>
        /// 取得牆的 side face Reference（exterior 優先，沒有則 interior）。
        /// 用於 chained / overall_bbox 模式 — side face 的 normal 垂直於牆方向，
        /// 對沿座標軸串接的 dimension 是正確的 reference。
        /// </summary>
        private Reference GetWallSideFaceReference(Wall wall)
        {
            try
            {
                IList<Reference> ext = HostObjectUtils.GetSideFaces(wall, ShellLayerType.Exterior);
                if (ext != null && ext.Count > 0) return ext.First();
            }
            catch { }
            try
            {
                IList<Reference> intr = HostObjectUtils.GetSideFaces(wall, ShellLayerType.Interior);
                if (intr != null && intr.Count > 0) return intr.First();
            }
            catch { }
            return null;
        }

        private List<object> CreateOverallBboxDims(Document doc, View view, List<(Wall wall, Line line)> walls, double offsetFt)
        {
            var result = new List<object>();
            var allPts = new List<XYZ>();
            foreach (var (_, ln) in walls)
            {
                allPts.Add(ln.GetEndPoint(0));
                allPts.Add(ln.GetEndPoint(1));
            }
            double maxX = allPts.Max(p => p.X);
            double maxY = allPts.Max(p => p.Y);

            // X 軸總尺寸：把所有 wall face 投影到 X，去重後串接
            var xRefs = CollectAxisReferences(walls, axisIsX: true);
            if (xRefs.Count >= 2)
            {
                double dimY = maxY + offsetFt;
                Dimension dim = CreateDimFromRefs(doc, view, xRefs, dimY, axisIsX: true);
                if (dim != null)
                {
                    double totalMm = Math.Round((xRefs.Last().coord - xRefs.First().coord) * 304.8, 0);
                    result.Add(new
                    {
                        Axis = "X",
                        Side = "top",
                        Segments = xRefs.Count - 1,
                        DimensionId = dim.Id.GetIdValue(),
                        TotalMm = totalMm
                    });
                }
            }

            // Y 軸總尺寸
            var yRefs = CollectAxisReferences(walls, axisIsX: false);
            if (yRefs.Count >= 2)
            {
                double dimX = maxX + offsetFt;
                Dimension dim = CreateDimFromRefs(doc, view, yRefs, dimX, axisIsX: false);
                if (dim != null)
                {
                    double totalMm = Math.Round((yRefs.Last().coord - yRefs.First().coord) * 304.8, 0);
                    result.Add(new
                    {
                        Axis = "Y",
                        Side = "right",
                        Segments = yRefs.Count - 1,
                        DimensionId = dim.Id.GetIdValue(),
                        TotalMm = totalMm
                    });
                }
            }

            return result;
        }

        /// <summary>
        /// 收集所有 wall face references 投影到指定軸（X 或 Y），依 coord 排序去重（1mm 容差）。
        /// - 與 axis 平行的牆（沿軸延伸）：用兩端 end-cap face
        /// - 與 axis 垂直的牆：用 side face（exterior 優先）
        /// </summary>
        private List<(double coord, Reference reference)> CollectAxisReferences(
            List<(Wall wall, Line line)> walls, bool axisIsX)
        {
            var bag = new List<(double coord, Reference reference)>();

            foreach (var (wall, line) in walls)
            {
                XYZ dir = line.Direction.Normalize();
                bool wallAlongAxis = axisIsX
                    ? Math.Abs(dir.Y) < 0.01
                    : Math.Abs(dir.X) < 0.01;

                if (wallAlongAxis)
                {
                    XYZ p0 = line.GetEndPoint(0);
                    XYZ p1 = line.GetEndPoint(1);
                    Reference r0 = GetWallEndFaceReference(wall, dir, p0);
                    Reference r1 = GetWallEndFaceReference(wall, dir, p1);
                    if (r0 != null) bag.Add((axisIsX ? p0.X : p0.Y, r0));
                    if (r1 != null) bag.Add((axisIsX ? p1.X : p1.Y, r1));
                }
                else
                {
                    Reference sideRef = GetWallSideFaceReference(wall);
                    if (sideRef == null) continue;
                    double coord = axisIsX
                        ? (line.GetEndPoint(0).X + line.GetEndPoint(1).X) / 2
                        : (line.GetEndPoint(0).Y + line.GetEndPoint(1).Y) / 2;
                    bag.Add((coord, sideRef));
                }
            }

            var deduped = new List<(double coord, Reference reference)>();
            foreach (var item in bag.OrderBy(b => b.coord))
            {
                if (deduped.Any(d => Math.Abs(d.coord - item.coord) < 1.0 / 304.8)) continue;
                deduped.Add(item);
            }
            return deduped;
        }

        /// <summary>
        /// 用 reference 串建立 Dimension。dimLine 沿指定軸，offsetCoord 是垂直軸的位置。
        /// </summary>
        private Dimension CreateDimFromRefs(
            Document doc, View view,
            List<(double coord, Reference reference)> refs,
            double offsetCoord, bool axisIsX)
        {
            if (refs == null || refs.Count < 2) return null;
            var refArr = new ReferenceArray();
            foreach (var (_, r) in refs) refArr.Append(r);

            XYZ start = axisIsX ? new XYZ(refs.First().coord, offsetCoord, 0)
                                : new XYZ(offsetCoord, refs.First().coord, 0);
            XYZ end = axisIsX ? new XYZ(refs.Last().coord, offsetCoord, 0)
                              : new XYZ(offsetCoord, refs.Last().coord, 0);
            Line dimLine = Line.CreateBound(start, end);

            try { return doc.Create.NewDimension(view, dimLine, refArr); }
            catch { return null; }
        }

        private List<object> CreateChainedWallDims(Document doc, View view, List<(Wall wall, Line line)> walls, double offsetFt)
        {
            var result = new List<object>();

            // 分類：水平牆（dir.Y≈0）→ 沿 X 串接；垂直牆（dir.X≈0）→ 沿 Y 串接
            var horizontal = walls.Where(w => Math.Abs(w.line.Direction.Y) < 0.01).ToList();
            var vertical = walls.Where(w => Math.Abs(w.line.Direction.X) < 0.01).ToList();

            // 水平牆：依 Y 分組（同列）→ 每組用 end-cap face 串成 X 軸 dimension
            var hGroups = GroupWallsByCoord(horizontal, w => (w.line.GetEndPoint(0).Y + w.line.GetEndPoint(1).Y) / 2);
            foreach (var g in hGroups)
            {
                var refs = CollectAxisReferences(g, axisIsX: true);
                if (refs.Count < 2) continue;

                double avgY = g.Average(w => (w.line.GetEndPoint(0).Y + w.line.GetEndPoint(1).Y) / 2);
                double dimY = avgY + offsetFt;
                Dimension dim = CreateDimFromRefs(doc, view, refs, dimY, axisIsX: true);
                if (dim == null) continue;
                result.Add(new
                {
                    Axis = "X",
                    BaseYMm = Math.Round(avgY * 304.8, 0),
                    WallCount = g.Count,
                    Segments = refs.Count - 1,
                    DimensionId = dim.Id.GetIdValue()
                });
            }

            // 垂直牆：依 X 分組（同排）→ 每組用 end-cap face 串成 Y 軸 dimension
            var vGroups = GroupWallsByCoord(vertical, w => (w.line.GetEndPoint(0).X + w.line.GetEndPoint(1).X) / 2);
            foreach (var g in vGroups)
            {
                var refs = CollectAxisReferences(g, axisIsX: false);
                if (refs.Count < 2) continue;

                double avgX = g.Average(w => (w.line.GetEndPoint(0).X + w.line.GetEndPoint(1).X) / 2);
                double dimX = avgX + offsetFt;
                Dimension dim = CreateDimFromRefs(doc, view, refs, dimX, axisIsX: false);
                if (dim == null) continue;
                result.Add(new
                {
                    Axis = "Y",
                    BaseXMm = Math.Round(avgX * 304.8, 0),
                    WallCount = g.Count,
                    Segments = refs.Count - 1,
                    DimensionId = dim.Id.GetIdValue()
                });
            }

            return result;
        }

        private List<List<(Wall wall, Line line)>> GroupWallsByCoord(
            List<(Wall wall, Line line)> walls,
            Func<(Wall wall, Line line), double> coord)
        {
            const double tolFt = 100.0 / 304.8; // 100mm
            var groups = new List<(double Coord, List<(Wall wall, Line line)> Items)>();
            foreach (var w in walls)
            {
                double c = coord(w);
                int idx = groups.FindIndex(g => Math.Abs(g.Coord - c) < tolFt);
                if (idx >= 0)
                    groups[idx].Items.Add(w);
                else
                    groups.Add((c, new List<(Wall, Line)> { w }));
            }
            return groups.Select(g => g.Items).ToList();
        }

        /// <summary>
        /// 自動標註立面圖/剖面圖頂部柱列線尺寸（外圈總跨度 + 內圈連續柱間距細部標註）。
        /// 自適應讀取視圖中所有 Grid 的 GetCurvesInView 頂部端點極值，在軸號圓圈下方依圖紙比例退縮放置。
        /// </summary>
        private object AutoDimensionElevationGrids(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            IdType typeId = parameters["typeId"]?.Value<IdType>() ?? 0;
            double paperOffsetTier1Mm = parameters["offsetTier1Mm"]?.Value<double>() ?? 5.0; // 圖紙 5mm
            double paperOffsetTier2StepMm = parameters["stepTier2Mm"]?.Value<double>() ?? 6.5; // 內圈距離第1層圖紙 6.5mm

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            // 取得視圖中可見的 Grids
            var grids = new FilteredElementCollector(doc, view.Id)
                .OfCategory(BuiltInCategory.OST_Grids)
                .WhereElementIsNotElementType()
                .Cast<Grid>()
                .ToList();

            if (grids.Count < 2)
                throw new Exception($"視圖 {view.Name} 中的柱列線數量不足（至少需要 2 條）");

            // 收集每個 Grid 在該視圖的 Curve 端點
            var gridInfos = new List<(Grid grid, Curve curve, XYZ topPt, XYZ botPt, double uProj)>();
            XYZ vRight = view.RightDirection.Normalize();
            XYZ vUp = view.UpDirection.Normalize();

            foreach (var g in grids)
            {
                IList<Curve> curves = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                if (curves == null || curves.Count == 0) continue;

                Curve c = curves[0];
                XYZ ep0 = c.GetEndPoint(0);
                XYZ ep1 = c.GetEndPoint(1);

                // 以 view.UpDirection 投影判斷頂端與底端
                double dot0 = ep0.DotProduct(vUp);
                double dot1 = ep1.DotProduct(vUp);
                XYZ top = dot0 >= dot1 ? ep0 : ep1;
                XYZ bot = dot0 < dot1 ? ep0 : ep1;

                // 沿 view.RightDirection 的水平投影位置
                double u = top.DotProduct(vRight);

                gridInfos.Add((g, c, top, bot, u));
            }

            if (gridInfos.Count < 2)
                throw new Exception("無法從視圖取得足夠的軸線可見曲線端點");

            // 依照視圖水平方向（從左到右）排序 Grids
            gridInfos.Sort((a, b) => a.uProj.CompareTo(b.uProj));

            // 出圖比例換算（圖紙 mm -> 英呎）
            double scale = view.Scale;
            double spacingFt = (scale * 6.5) / 10.0 / 30.48; // 1 模矩 (6.5mm)

            // 優先以建築實體外輪廓頂界 (vMax) 為基準放樣，杜絕不受控的 CropBox/軸線端點漂移
            double targetUp1;
            double targetUp2;

            try
            {
                var contourData = GetElevationOuterContour(new JObject { ["viewId"] = view.Id.GetIdValue(), ["draw_contour"] = false });
                var jContour = JObject.FromObject(contourData);
                var bounds = jContour["boundsMm"];
                if (bounds != null)
                {
                    double vMaxFt = bounds["maxV"].Value<double>() / 304.8;
                    // Step 4 (Tier 1 總跨): vMax + 4 modules
                    // Step 3 (Tier 2 柱心): vMax + 3 modules
                    targetUp1 = vMaxFt + 4.0 * spacingFt;
                    targetUp2 = vMaxFt + 3.0 * spacingFt;
                }
                else
                {
                    double maxUpDot = gridInfos.Max(info => info.topPt.DotProduct(vUp));
                    double offset1Ft = (paperOffsetTier1Mm / 10.0 / 30.48) * scale;
                    double offset2Ft = offset1Ft + (paperOffsetTier2StepMm / 10.0 / 30.48) * scale;
                    targetUp1 = maxUpDot - offset1Ft;
                    targetUp2 = maxUpDot - offset2Ft;
                }
            }
            catch
            {
                double maxUpDot = gridInfos.Max(info => info.topPt.DotProduct(vUp));
                double offset1Ft = (paperOffsetTier1Mm / 10.0 / 30.48) * scale;
                double offset2Ft = offset1Ft + (paperOffsetTier2StepMm / 10.0 / 30.48) * scale;
                targetUp1 = maxUpDot - offset1Ft;
                targetUp2 = maxUpDot - offset2Ft;
            }

            // 基準線定位點
            var firstInfo = gridInfos[0];
            var lastInfo = gridInfos[gridInfos.Count - 1];

            double currentV_last = (lastInfo.topPt - view.Origin).DotProduct(vUp);
            double currentV_first = (firstInfo.topPt - view.Origin).DotProduct(vUp);

            // 改由右至左 (lastInfo -> firstInfo)，使 5mm 固定短輔助線一律向下（朝向建築物內側）
            XYZ p1_start = lastInfo.topPt.Add(vUp.Multiply(targetUp1 - currentV_last));
            XYZ p1_end = firstInfo.topPt.Add(vUp.Multiply(targetUp1 - currentV_first));

            XYZ p2_start = lastInfo.topPt.Add(vUp.Multiply(targetUp2 - currentV_last));
            XYZ p2_end = firstInfo.topPt.Add(vUp.Multiply(targetUp2 - currentV_first));

            Line dimLine1 = Line.CreateBound(p1_start, p1_end);
            Line dimLine2 = Line.CreateBound(p2_start, p2_end);

            // 建立 ReferenceArray (由右至左排序)
            ReferenceArray refOverall = new ReferenceArray();
            refOverall.Append(new Reference(lastInfo.grid));
            refOverall.Append(new Reference(firstInfo.grid));

            ReferenceArray refContinuous = new ReferenceArray();
            for (int i = gridInfos.Count - 1; i >= 0; i--)
            {
                refContinuous.Append(new Reference(gridInfos[i].grid));
            }

            Dimension dimTotal = null;
            Dimension dimContinuous = null;

            DimensionType targetDimType = null;
            if (typeId != 0)
            {
                targetDimType = doc.GetElement(typeId.ToElementId()) as DimensionType;
            }

            using (Transaction trans = TransactionHelper.Begin(doc, "立面圖頂部柱間距標註"))
            {
                trans.Start();

                dimTotal = doc.Create.NewDimension(view, dimLine1, refOverall);
                dimContinuous = doc.Create.NewDimension(view, dimLine2, refContinuous);

                if (targetDimType != null)
                {
                    if (dimTotal != null) dimTotal.ChangeTypeId(targetDimType.Id);
                    if (dimContinuous != null) dimContinuous.ChangeTypeId(targetDimType.Id);
                }

                trans.Commit();
            }

            double totalVal = dimTotal?.Value.HasValue == true ? Math.Round(dimTotal.Value.Value * 304.8, 2) : 0;

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                TotalDimensionId = dimTotal?.Id.GetIdValue(),
                TotalValueMm = totalVal,
                ContinuousDimensionId = dimContinuous?.Id.GetIdValue(),
                SegmentsCount = dimContinuous?.Segments.Size > 0 ? dimContinuous.Segments.Size : gridInfos.Count - 1,
                GridCount = gridInfos.Count,
                Grids = gridInfos.Select(g => g.grid.Name).ToList(),
                DimensionTypeName = targetDimType?.Name
            };
        }

        /// <summary>
        /// 自動標註立面圖/剖面圖樓層高程線尺寸（外層總高程 + 內層各樓層細部連續標註）。
        /// 自適應讀取視圖中可見的 Level 的 GetCurvesInView 端點與標示圈位置，在標示圈內側依圖紙比例退縮放置。
        /// </summary>
        private object AutoDimensionElevationLevels(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            IdType typeId = parameters["typeId"]?.Value<IdType>() ?? 0;
            double paperOffsetTier1Mm = parameters["offsetTier1Mm"]?.Value<double>() ?? 26.0; // 圖紙 26.0mm (4 模矩，置於 Step 3 避開樓層名稱標高文字)
            double paperOffsetTier2StepMm = parameters["stepTier2Mm"]?.Value<double>() ?? 6.5; // 圖紙 6.5mm (1 模矩，置於 Step 2 各樓層高)

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            // 收集視圖中可見的 Levels
            var levels = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Level))
                .WhereElementIsNotElementType()
                .Cast<Level>()
                .ToList();

            if (levels.Count < 2)
                throw new Exception($"視圖 {view.Name} 中的樓層數量不足（至少需要 2 個樓層）");

            // 依照 Elevation 高程由低到高排序
            levels.Sort((a, b) => a.Elevation.CompareTo(b.Elevation));

            // 支援過濾底層基準線（例如立面圖以 GL 為底，剖面圖包含地下層/筏基）
            string baseLevelName = parameters["baseLevelName"]?.Value<string>();
            bool? includeBasementParam = parameters["includeBasement"]?.Value<bool>();
            bool includeBasement = includeBasementParam.HasValue ? includeBasementParam.Value : (view.ViewType == ViewType.Section);

            if (!string.IsNullOrEmpty(baseLevelName))
            {
                var baseLv = levels.FirstOrDefault(l => l.Name.Equals(baseLevelName, StringComparison.OrdinalIgnoreCase));
                if (baseLv != null)
                {
                    levels = levels.Where(l => l.Elevation >= baseLv.Elevation - 1e-4).ToList();
                }
            }
            else if (!includeBasement && (view.ViewType == ViewType.Elevation || view.ViewType == ViewType.ThreeD))
            {
                // 立面圖預設以 GL 或 0 標高以上為基準紅線
                var glLevel = levels.FirstOrDefault(l => l.Name.Equals("GL", StringComparison.OrdinalIgnoreCase))
                           ?? levels.FirstOrDefault(l => l.Elevation >= -1e-4);
                if (glLevel != null)
                {
                    levels = levels.Where(l => l.Elevation >= glLevel.Elevation - 1e-4).ToList();
                }
            }

            if (levels.Count < 2)
                throw new Exception($"過濾後的樓層數量不足 2 個（無法建立尺寸標註）");

            // 以最底層判斷標示圈 (Bubble) 位置
            Level baseLevel = levels[0];
            IList<Curve> curves = baseLevel.GetCurvesInView(DatumExtentType.ViewSpecific, view);
            if (curves == null || curves.Count == 0)
                throw new Exception("無法取得樓層線在視圖中的可見曲線");

            Curve baseCurve = curves[0];
            XYZ ep0 = baseCurve.GetEndPoint(0);
            XYZ ep1 = baseCurve.GetEndPoint(1);

            bool hasBubble0 = baseLevel.IsBubbleVisibleInView(DatumEnds.End0, view);
            bool hasBubble1 = baseLevel.IsBubbleVisibleInView(DatumEnds.End1, view);

            XYZ bubblePt = null;
            XYZ otherPt = null;

            if (hasBubble0 && !hasBubble1)
            {
                bubblePt = ep0;
                otherPt = ep1;
            }
            else if (!hasBubble0 && hasBubble1)
            {
                bubblePt = ep1;
                otherPt = ep0;
            }
            else
            {
                // 若兩端都有或都沒有，預設取左側 (沿 RightDirection 較小者)
                XYZ vRight = view.RightDirection.Normalize();
                if (ep0.DotProduct(vRight) <= ep1.DotProduct(vRight))
                {
                    bubblePt = ep0;
                    otherPt = ep1;
                }
                else
                {
                    bubblePt = ep1;
                    otherPt = ep0;
                }
            }

            XYZ vRightDir = view.RightDirection.Normalize();
            XYZ vUpDir = view.UpDirection.Normalize();

            // 判斷氣泡在左側還是右側，計算朝向建築內側的方向
            bool isBubbleOnLeft = bubblePt.DotProduct(vRightDir) < otherPt.DotProduct(vRightDir);
            XYZ inwardDir = isBubbleOnLeft ? vRightDir : vRightDir.Negate();

            // 出圖比例換算（圖紙 mm -> 英呎）
            double scale = view.Scale;
            double spacingFt = (scale * 6.5) / 10.0 / 30.48; // 1 模矩 (6.5mm)

            // 基準垂直線起迄點 (由頂部貫穿到底部，確保固定長度輔助線一律朝向建築物內側)
            double baseElev = levels[0].Elevation;
            double topElev = levels[levels.Count - 1].Elevation;

            // 優先以建築實體外輪廓左界 (uMin) 為基準放樣，杜絕不受控的 CropBox/樓層線端點漂移
            XYZ p1_start, p1_end, p2_start, p2_end;

            try
            {
                var contourData = GetElevationOuterContour(new JObject { ["viewId"] = view.Id.GetIdValue(), ["draw_contour"] = false });
                var jContour = JObject.FromObject(contourData);
                var bounds = jContour["boundsMm"];
                if (bounds != null)
                {
                    double uMinFt = bounds["minU"].Value<double>() / 304.8;
                    // Step 4 (Tier 1 總高): uMin - 4 modules (距外牆 4 模矩)
                    // Step 3 (Tier 2 各層層高): uMin - 3 modules (距外牆 3 模矩，最內側尺寸線與外牆紅線剛好 2 格留白！)
                    double targetU1 = uMinFt - 4.0 * spacingFt;
                    double targetU2 = uMinFt - 3.0 * spacingFt;

                    XYZ origin = view.Origin;
                    XYZ p1_base = origin + vRightDir * targetU1;
                    p1_start = p1_base.Add(vUpDir.Multiply(topElev - p1_base.DotProduct(vUpDir)));
                    p1_end = p1_base.Add(vUpDir.Multiply(baseElev - p1_base.DotProduct(vUpDir)));

                    XYZ p2_base = origin + vRightDir * targetU2;
                    p2_start = p2_base.Add(vUpDir.Multiply(topElev - p2_base.DotProduct(vUpDir)));
                    p2_end = p2_base.Add(vUpDir.Multiply(baseElev - p2_base.DotProduct(vUpDir)));
                }
                else
                {
                    double offset1Ft = (paperOffsetTier1Mm / 10.0 / 30.48) * scale;
                    double offset2Ft = offset1Ft + (paperOffsetTier2StepMm / 10.0 / 30.48) * scale;
                    XYZ p1_base = bubblePt.Add(inwardDir.Multiply(offset1Ft));
                    p1_start = p1_base.Add(vUpDir.Multiply(topElev - p1_base.DotProduct(vUpDir)));
                    p1_end = p1_base.Add(vUpDir.Multiply(baseElev - p1_base.DotProduct(vUpDir)));
                    XYZ p2_base = bubblePt.Add(inwardDir.Multiply(offset2Ft));
                    p2_start = p2_base.Add(vUpDir.Multiply(topElev - p2_base.DotProduct(vUpDir)));
                    p2_end = p2_base.Add(vUpDir.Multiply(baseElev - p2_base.DotProduct(vUpDir)));
                }
            }
            catch
            {
                double offset1Ft = (paperOffsetTier1Mm / 10.0 / 30.48) * scale;
                double offset2Ft = offset1Ft + (paperOffsetTier2StepMm / 10.0 / 30.48) * scale;
                XYZ p1_base = bubblePt.Add(inwardDir.Multiply(offset1Ft));
                p1_start = p1_base.Add(vUpDir.Multiply(topElev - p1_base.DotProduct(vUpDir)));
                p1_end = p1_base.Add(vUpDir.Multiply(baseElev - p1_base.DotProduct(vUpDir)));
                XYZ p2_base = bubblePt.Add(inwardDir.Multiply(offset2Ft));
                p2_start = p2_base.Add(vUpDir.Multiply(topElev - p2_base.DotProduct(vUpDir)));
                p2_end = p2_base.Add(vUpDir.Multiply(baseElev - p2_base.DotProduct(vUpDir)));
            }

            Line dimLine1 = Line.CreateBound(p1_start, p1_end);
            Line dimLine2 = Line.CreateBound(p2_start, p2_end);

            // 建立 ReferenceArray (由頂至底排序，使用 l.GetPlaneReference())
            ReferenceArray refOverall = new ReferenceArray();
            refOverall.Append(levels[levels.Count - 1].GetPlaneReference());
            refOverall.Append(levels[0].GetPlaneReference());

            ReferenceArray refContinuous = new ReferenceArray();
            for (int i = levels.Count - 1; i >= 0; i--)
            {
                refContinuous.Append(levels[i].GetPlaneReference());
            }

            Dimension dimTotal = null;
            Dimension dimContinuous = null;

            DimensionType targetDimType = null;
            if (typeId != 0)
            {
                targetDimType = doc.GetElement(typeId.ToElementId()) as DimensionType;
            }

            using (Transaction trans = TransactionHelper.Begin(doc, "立面圖樓層高程雙層標註"))
            {
                trans.Start();

                dimTotal = doc.Create.NewDimension(view, dimLine1, refOverall);
                dimContinuous = doc.Create.NewDimension(view, dimLine2, refContinuous);

                if (targetDimType != null)
                {
                    if (dimTotal != null) dimTotal.ChangeTypeId(targetDimType.Id);
                    if (dimContinuous != null) dimContinuous.ChangeTypeId(targetDimType.Id);
                }

                trans.Commit();
            }

            double totalVal = dimTotal?.Value.HasValue == true ? Math.Round(dimTotal.Value.Value * 304.8, 2) : 0;

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                TotalDimensionId = dimTotal?.Id.GetIdValue(),
                TotalValueMm = totalVal,
                ContinuousDimensionId = dimContinuous?.Id.GetIdValue(),
                SegmentsCount = dimContinuous?.Segments.Size > 0 ? dimContinuous.Segments.Size : levels.Count - 1,
                LevelCount = levels.Count,
                Levels = levels.Select(l => l.Name).ToList(),
                DimensionTypeName = targetDimType?.Name
            };
        }

        /// <summary>
        /// 自動為平面視圖建立四向雙層柱心連續標註（自適應讀取視圖中所有 Grids 的真實幾何端點）
        /// </summary>
        private object AutoDimensionPlanGrids(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            double paperOffsetTier1Mm = parameters["offsetTier1Mm"]?.Value<double>() ?? 5.0; // 圖紙 5mm
            double paperOffsetTier2StepMm = parameters["stepTier2Mm"]?.Value<double>() ?? 6.5; // 圖紙 6.5mm (總計 11.5mm)

            View view = doc.GetElement(viewId.ToElementId()) as View;
            if (view == null)
                throw new Exception($"找不到視圖 ID: {viewId}");

            // 取得視圖中可見的 Grids
            var grids = new FilteredElementCollector(doc, view.Id)
                .OfCategory(BuiltInCategory.OST_Grids)
                .WhereElementIsNotElementType()
                .Cast<Grid>()
                .ToList();

            if (grids.Count < 2)
                throw new Exception($"視圖 {view.Name} 中的軸線數量不足（至少需要 2 條）");

            XYZ vRight = view.RightDirection.Normalize();
            XYZ vUp = view.UpDirection.Normalize();

            var vertGrids = new List<(Grid grid, Curve curve, XYZ topPt, XYZ botPt, double uProj)>();
            var horizGrids = new List<(Grid grid, Curve curve, XYZ leftPt, XYZ rightPt, double vProj)>();

            foreach (var g in grids)
            {
                IList<Curve> curves = g.GetCurvesInView(DatumExtentType.ViewSpecific, view);
                if (curves == null || curves.Count == 0) continue;

                Curve c = curves[0];
                XYZ ep0 = c.GetEndPoint(0);
                XYZ ep1 = c.GetEndPoint(1);
                XYZ dir = (ep1 - ep0).Normalize();

                double dotUp = Math.Abs(dir.DotProduct(vUp));
                double dotRight = Math.Abs(dir.DotProduct(vRight));

                if (dotUp >= dotRight)
                {
                    // 垂直軸線 (例如 1, 2, 3, 4)
                    XYZ top = ep0.DotProduct(vUp) >= ep1.DotProduct(vUp) ? ep0 : ep1;
                    XYZ bot = ep0.DotProduct(vUp) < ep1.DotProduct(vUp) ? ep0 : ep1;
                    double u = top.DotProduct(vRight);
                    vertGrids.Add((g, c, top, bot, u));
                }
                else
                {
                    // 水平軸線 (例如 A, B, C, D)
                    XYZ right = ep0.DotProduct(vRight) >= ep1.DotProduct(vRight) ? ep0 : ep1;
                    XYZ left = ep0.DotProduct(vRight) < ep1.DotProduct(vRight) ? ep0 : ep1;
                    double v = left.DotProduct(vUp);
                    horizGrids.Add((g, c, left, right, v));
                }
            }

            // 排序
            vertGrids.Sort((a, b) => a.uProj.CompareTo(b.uProj)); // 左到右
            horizGrids.Sort((a, b) => b.vProj.CompareTo(a.vProj)); // 頂到底 (上到下)

            double scale = view.Scale;
            double offset1Ft = (paperOffsetTier1Mm / 10.0 / 30.48) * scale;
            double offset2Ft = offset1Ft + (paperOffsetTier2StepMm / 10.0 / 30.48) * scale;

            // 尋找型式
            DimensionType typeUpRight = null;
            DimensionType typeDownRight = null;
            var allDimTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(DimensionType))
                .Cast<DimensionType>()
                .ToList();

            foreach (var dt in allDimTypes)
            {
                if (dt.Name.Contains("上右") || dt.Name.Contains("柱心-上右")) typeUpRight = dt;
                if (dt.Name.Contains("下右") || dt.Name.Contains("柱心-下右")) typeDownRight = dt;
            }
            if (typeUpRight == null) typeUpRight = allDimTypes.FirstOrDefault(dt => dt.Name.Contains("TABC-DIM") || dt.Name == "DIMing");
            if (typeDownRight == null) typeDownRight = typeUpRight;

            var createdDimIds = new List<long>();

            using (Transaction trans = TransactionHelper.Begin(doc, "自動建立平面四向雙層柱心標註"))
            {
                trans.Start();

                // 1. 北側 (頂部: 垂直軸線，由右至左建立使輔助線朝下指向建物)
                if (vertGrids.Count >= 2)
                {
                    double maxUp = vertGrids.Max(g => g.topPt.DotProduct(vUp));
                    XYZ rightTop = vertGrids.Last().topPt;
                    XYZ leftTop = vertGrids.First().topPt;

                    // Tier 1 (總跨度)
                    XYZ pStart1 = rightTop + vUp * (maxUp - rightTop.DotProduct(vUp) - offset1Ft);
                    XYZ pEnd1 = leftTop + vUp * (maxUp - leftTop.DotProduct(vUp) - offset1Ft);
                    Line line1 = Line.CreateBound(pStart1, pEnd1);
                    ReferenceArray ref1 = new ReferenceArray();
                    ref1.Append(new Reference(vertGrids.Last().grid));
                    ref1.Append(new Reference(vertGrids.First().grid));
                    var d1 = doc.Create.NewDimension(view, line1, ref1);
                    if (d1 != null) { if (typeUpRight != null) d1.ChangeTypeId(typeUpRight.Id); createdDimIds.Add(d1.Id.GetIdValue()); }

                    // Tier 2 (柱間距)
                    XYZ pStart2 = rightTop + vUp * (maxUp - rightTop.DotProduct(vUp) - offset2Ft);
                    XYZ pEnd2 = leftTop + vUp * (maxUp - leftTop.DotProduct(vUp) - offset2Ft);
                    Line line2 = Line.CreateBound(pStart2, pEnd2);
                    ReferenceArray ref2 = new ReferenceArray();
                    for (int i = vertGrids.Count - 1; i >= 0; i--) ref2.Append(new Reference(vertGrids[i].grid));
                    var d2 = doc.Create.NewDimension(view, line2, ref2);
                    if (d2 != null) { if (typeUpRight != null) d2.ChangeTypeId(typeUpRight.Id); createdDimIds.Add(d2.Id.GetIdValue()); }
                }

                // 2. 南側 (底部: 垂直軸線，由左至右建立使輔助線朝上指向建物)
                if (vertGrids.Count >= 2)
                {
                    double minUp = vertGrids.Min(g => g.botPt.DotProduct(vUp));
                    XYZ leftBot = vertGrids.First().botPt;
                    XYZ rightBot = vertGrids.Last().botPt;

                    // Tier 1 (總跨度)
                    XYZ pStart1 = leftBot + vUp * (minUp - leftBot.DotProduct(vUp) + offset1Ft);
                    XYZ pEnd1 = rightBot + vUp * (minUp - rightBot.DotProduct(vUp) + offset1Ft);
                    Line line1 = Line.CreateBound(pStart1, pEnd1);
                    ReferenceArray ref1 = new ReferenceArray();
                    ref1.Append(new Reference(vertGrids.First().grid));
                    ref1.Append(new Reference(vertGrids.Last().grid));
                    var d1 = doc.Create.NewDimension(view, line1, ref1);
                    if (d1 != null) { if (typeDownRight != null) d1.ChangeTypeId(typeDownRight.Id); createdDimIds.Add(d1.Id.GetIdValue()); }

                    // Tier 2 (柱間距)
                    XYZ pStart2 = leftBot + vUp * (minUp - leftBot.DotProduct(vUp) + offset2Ft);
                    XYZ pEnd2 = rightBot + vUp * (minUp - rightBot.DotProduct(vUp) + offset2Ft);
                    Line line2 = Line.CreateBound(pStart2, pEnd2);
                    ReferenceArray ref2 = new ReferenceArray();
                    for (int i = 0; i < vertGrids.Count; i++) ref2.Append(new Reference(vertGrids[i].grid));
                    var d2 = doc.Create.NewDimension(view, line2, ref2);
                    if (d2 != null) { if (typeDownRight != null) d2.ChangeTypeId(typeDownRight.Id); createdDimIds.Add(d2.Id.GetIdValue()); }
                }

                // 3. 西側 (左側: 水平軸線，由頂至底建立使輔助線朝右指向建物)
                if (horizGrids.Count >= 2)
                {
                    double minRight = horizGrids.Min(g => g.leftPt.DotProduct(vRight));
                    XYZ topHoriz = horizGrids.First().leftPt;
                    XYZ botHoriz = horizGrids.Last().leftPt;

                    // Tier 1 (總跨度)
                    XYZ pStart1 = topHoriz + vRight * (minRight - topHoriz.DotProduct(vRight) + offset1Ft);
                    XYZ pEnd1 = botHoriz + vRight * (minRight - botHoriz.DotProduct(vRight) + offset1Ft);
                    Line line1 = Line.CreateBound(pStart1, pEnd1);
                    ReferenceArray ref1 = new ReferenceArray();
                    ref1.Append(new Reference(horizGrids.First().grid));
                    ref1.Append(new Reference(horizGrids.Last().grid));
                    var d1 = doc.Create.NewDimension(view, line1, ref1);
                    if (d1 != null) { if (typeDownRight != null) d1.ChangeTypeId(typeDownRight.Id); createdDimIds.Add(d1.Id.GetIdValue()); }

                    // Tier 2 (柱間距)
                    XYZ pStart2 = topHoriz + vRight * (minRight - topHoriz.DotProduct(vRight) + offset2Ft);
                    XYZ pEnd2 = botHoriz + vRight * (minRight - botHoriz.DotProduct(vRight) + offset2Ft);
                    Line line2 = Line.CreateBound(pStart2, pEnd2);
                    ReferenceArray ref2 = new ReferenceArray();
                    for (int i = 0; i < horizGrids.Count; i++) ref2.Append(new Reference(horizGrids[i].grid));
                    var d2 = doc.Create.NewDimension(view, line2, ref2);
                    if (d2 != null) { if (typeDownRight != null) d2.ChangeTypeId(typeDownRight.Id); createdDimIds.Add(d2.Id.GetIdValue()); }
                }

                // 4. 東側 (右側: 水平軸線，由底至頂建立使輔助線朝左指向建物)
                if (horizGrids.Count >= 2)
                {
                    double maxRight = horizGrids.Max(g => g.rightPt.DotProduct(vRight));
                    XYZ botHoriz = horizGrids.Last().rightPt;
                    XYZ topHoriz = horizGrids.First().rightPt;

                    // Tier 1 (總跨度)
                    XYZ pStart1 = botHoriz + vRight * (maxRight - botHoriz.DotProduct(vRight) - offset1Ft);
                    XYZ pEnd1 = topHoriz + vRight * (maxRight - topHoriz.DotProduct(vRight) - offset1Ft);
                    Line line1 = Line.CreateBound(pStart1, pEnd1);
                    ReferenceArray ref1 = new ReferenceArray();
                    ref1.Append(new Reference(horizGrids.Last().grid));
                    ref1.Append(new Reference(horizGrids.First().grid));
                    var d1 = doc.Create.NewDimension(view, line1, ref1);
                    if (d1 != null) { if (typeUpRight != null) d1.ChangeTypeId(typeUpRight.Id); createdDimIds.Add(d1.Id.GetIdValue()); }

                    // Tier 2 (柱間距)
                    XYZ pStart2 = botHoriz + vRight * (maxRight - botHoriz.DotProduct(vRight) - offset2Ft);
                    XYZ pEnd2 = topHoriz + vRight * (maxRight - topHoriz.DotProduct(vRight) - offset2Ft);
                    Line line2 = Line.CreateBound(pStart2, pEnd2);
                    ReferenceArray ref2 = new ReferenceArray();
                    for (int i = horizGrids.Count - 1; i >= 0; i--) ref2.Append(new Reference(horizGrids[i].grid));
                    var d2 = doc.Create.NewDimension(view, line2, ref2);
                    if (d2 != null) { if (typeUpRight != null) d2.ChangeTypeId(typeUpRight.Id); createdDimIds.Add(d2.Id.GetIdValue()); }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                CreatedDimensionsCount = createdDimIds.Count,
                DimensionIds = createdDimIds,
                VerticalGrids = vertGrids.Select(g => g.grid.Name).ToList(),
                HorizontalGrids = horizGrids.Select(g => g.grid.Name).ToList()
            };
        }

        /// <summary>
        /// 全自動平面圖外牆/內牆中心線三層階梯標註（Layer 1 外牆總長 + Layer 2 居室主隔間牆心 + Layer 3 走廊/附屬空間細部牆心）。
        /// 支援右側 (East)、左側 (West)、下側 (South)、上側 (North) 之四向鏡射等距階梯放樣與空間拓撲割線分析。
        /// </summary>
        private (double minX, double maxX, double minY, double maxY) GetPhysicalEnvelope(Document doc, View view)
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
            var modelElements = new FilteredElementCollector(doc, view.Id)
                .WherePasses(catFilter)
                .WhereElementIsNotElementType()
                .ToElements();

            double envMinX = double.MaxValue, envMaxX = double.MinValue;
            double envMinY = double.MaxValue, envMaxY = double.MinValue;
            bool found = false;

            foreach (var elem in modelElements)
            {
                BoundingBoxXYZ bbox = elem.get_BoundingBox(view) ?? elem.get_BoundingBox(null);
                if (bbox == null || bbox.Min == null || bbox.Max == null) continue;

                if (Math.Abs(bbox.Min.X) < 32808 && Math.Abs(bbox.Max.X) < 32808)
                {
                    envMinX = Math.Min(envMinX, bbox.Min.X);
                    envMaxX = Math.Max(envMaxX, bbox.Max.X);
                    envMinY = Math.Min(envMinY, bbox.Min.Y);
                    envMaxY = Math.Max(envMaxY, bbox.Max.Y);
                    found = true;
                }
            }

            if (!found)
            {
                var grids = new FilteredElementCollector(doc, view.Id).OfClass(typeof(Grid)).Cast<Grid>().ToList();
                if (grids.Count == 0) grids = new FilteredElementCollector(doc).OfClass(typeof(Grid)).Cast<Grid>().ToList();
                foreach (var g in grids)
                {
                    XYZ p0 = g.Curve.GetEndPoint(0);
                    XYZ p1 = g.Curve.GetEndPoint(1);
                    envMinX = Math.Min(envMinX, Math.Min(p0.X, p1.X));
                    envMaxX = Math.Max(envMaxX, Math.Max(p0.X, p1.X));
                    envMinY = Math.Min(envMinY, Math.Min(p0.Y, p1.Y));
                    envMaxY = Math.Max(envMaxY, Math.Max(p0.Y, p1.Y));
                }
            }

            return (envMinX, envMaxX, envMinY, envMaxY);
        }

        private object AutoDimensionWallCenterlines(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            IdType viewId = parameters["viewId"]?.Value<IdType>() ?? 0;
            double stepMm = parameters["stepMm"]?.Value<double>() ?? 650.0;
            string typeName = parameters["dimensionTypeName"]?.Value<string>() ?? "TABC-DIM_dot 牆心";
            IdType typeId = parameters["dimensionTypeId"]?.Value<IdType>() ?? 0;

            ViewPlan view = doc.GetElement(viewId.ToElementId()) as ViewPlan;
            if (view == null)
                throw new Exception($"找不到平面圖視圖 ID: {viewId}");

            // 1. 取得實體外框極值 (Physical Envelope)
            var (minX, maxX, minY, maxY) = GetPhysicalEnvelope(doc, view);
            double stepFt = stepMm / 304.8;

            // 2. 解析目標標註型式 (TABC-DIM_dot 牆心)
            DimensionType targetDimType = null;
            if (typeId != 0) targetDimType = doc.GetElement(typeId.ToElementId()) as DimensionType;
            if (targetDimType == null)
            {
                targetDimType = new FilteredElementCollector(doc)
                    .OfClass(typeof(DimensionType))
                    .Cast<DimensionType>()
                    .FirstOrDefault(dt => dt.Name.Equals(typeName, StringComparison.OrdinalIgnoreCase) || dt.Name.Contains("dot 牆心") || dt.Name.Contains("牆心"));
            }

            // 3. 收集視圖中所有直線牆體
            var allWalls = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(Wall))
                .Cast<Wall>()
                .Where(w => w.Location is LocationCurve lc && lc.Curve is Line)
                .Select(w =>
                {
                    Line line = (w.Location as LocationCurve).Curve as Line;
                    XYZ p0 = line.GetEndPoint(0);
                    XYZ p1 = line.GetEndPoint(1);
                    double wMinX = Math.Min(p0.X, p1.X);
                    double wMaxX = Math.Max(p0.X, p1.X);
                    double wMinY = Math.Min(p0.Y, p1.Y);
                    double wMaxY = Math.Max(p0.Y, p1.Y);
                    bool isVert = Math.Abs(line.Direction.X) < 0.05;
                    bool isHoriz = Math.Abs(line.Direction.Y) < 0.05;
                    double center = isVert ? (p0.X + p1.X) / 2.0 : (p0.Y + p1.Y) / 2.0;
                    return new { Wall = w, Line = line, MinX = wMinX, MaxX = wMaxX, MinY = wMinY, MaxY = wMaxY, IsVertical = isVert, IsHorizontal = isHoriz, Center = center };
                })
                .ToList();

            var vertWalls = allWalls.Where(w => w.IsVertical).ToList();
            var horizWalls = allWalls.Where(w => w.IsHorizontal).ToList();

            // 解析要處理的側邊 (預設為 East, West, South)
            var sidesParam = parameters["sides"] as JArray;
            List<string> sides = new List<string>();
            if (sidesParam != null && sidesParam.Count > 0)
            {
                sides = sidesParam.Select(s => s.Value<string>().ToLowerInvariant()).ToList();
            }
            else
            {
                string singleSide = parameters["side"]?.Value<string>()?.ToLowerInvariant() ?? "all";
                if (singleSide == "all") sides = new List<string> { "east", "west", "south" };
                else sides = new List<string> { singleSide };
            }

            var createdDims = new List<object>();

            using (Transaction trans = TransactionHelper.Begin(doc, "建立牆心三層階梯標註"))
            {
                trans.Start();

                foreach (var side in sides)
                {
                    if (side == "east" || side == "right")
                    {
                        // 東側 (測量東西向水平牆 Y 坐標，標註線為垂直線)
                        // 放樣位置: Step 5, Step 4, Step 3 (鏡射至 maxX + N * stepFt)
                        double dimX1 = maxX + 5 * stepFt;
                        double dimX2 = maxX + 4 * stepFt;
                        double dimX3 = maxX + 3 * stepFt;

                        // Layer 1: 外牆總長 (最底與最頂水平外牆)
                        var d1 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX1, spanMin: minY, spanMax: maxY, sliceCoord: null, targetDimType);
                        if (d1 != null) createdDims.Add(new { Side = "East", Layer = 1, Description = "外牆總長", DimensionId = d1.Id.GetIdValue(), ValueMm = d1.Value.HasValue ? Math.Round(d1.Value.Value * 304.8, 1) : 0 });

                        // Layer 2: 第一層居室主隔間牆 (割線在東外牆內縮 3.0m)
                        double sliceX1 = maxX - 3.0 * 3.28084;
                        var d2 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX2, spanMin: minY, spanMax: maxY, sliceCoord: sliceX1, targetDimType);
                        if (d2 != null) createdDims.Add(new { Side = "East", Layer = 2, Description = "居室主隔間", DimensionId = d2.Id.GetIdValue(), Segments = d2.Segments?.Size ?? 1 });

                        // Layer 3: 第二層走廊/附屬空間隔間牆 (割線在東外牆內縮 8.0m)
                        double sliceX2 = maxX - 8.0 * 3.28084;
                        var d3 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX3, spanMin: minY, spanMax: maxY, sliceCoord: sliceX2, targetDimType);
                        if (d3 != null) createdDims.Add(new { Side = "East", Layer = 3, Description = "走廊/附屬空間隔間", DimensionId = d3.Id.GetIdValue(), Segments = d3.Segments?.Size ?? 1 });
                    }
                    else if (side == "west" || side == "left")
                    {
                        // 西側 (測量東西向水平牆 Y 坐標，標註線為垂直線)
                        // 放樣位置: Step 5, Step 4, Step 3 (鏡射至 minX - N * stepFt)
                        double dimX1 = minX - 5 * stepFt;
                        double dimX2 = minX - 4 * stepFt;
                        double dimX3 = minX - 3 * stepFt;

                        // Layer 1: 外牆總長 (最底與最頂水平外牆)
                        var d1 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX1, spanMin: minY, spanMax: maxY, sliceCoord: null, targetDimType);
                        if (d1 != null) createdDims.Add(new { Side = "West", Layer = 1, Description = "外牆總長", DimensionId = d1.Id.GetIdValue(), ValueMm = d1.Value.HasValue ? Math.Round(d1.Value.Value * 304.8, 1) : 0 });

                        // Layer 2: 第一層居室主隔間牆 (割線在西外牆內縮 3.0m)
                        double sliceX1 = minX + 3.0 * 3.28084;
                        var d2 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX2, spanMin: minY, spanMax: maxY, sliceCoord: sliceX1, targetDimType);
                        if (d2 != null) createdDims.Add(new { Side = "West", Layer = 2, Description = "居室主隔間", DimensionId = d2.Id.GetIdValue(), Segments = d2.Segments?.Size ?? 1 });

                        // Layer 3: 第二層走廊/附屬空間隔間牆 (割線在西外牆內縮 7.5m)
                        double sliceX2 = minX + 7.5 * 3.28084;
                        var d3 = CreateDimForSlice(doc, view, horizWalls, isVerticalAxis: true, isAscending: true, dimCoord: dimX3, spanMin: minY, spanMax: maxY, sliceCoord: sliceX2, targetDimType);
                        if (d3 != null) createdDims.Add(new { Side = "West", Layer = 3, Description = "走廊/附屬空間隔間", DimensionId = d3.Id.GetIdValue(), Segments = d3.Segments?.Size ?? 1 });
                    }
                    else if (side == "south" || side == "bottom")
                    {
                        // 南側 (測量南北向垂直牆 X 坐標，標註線為水平線)
                        // 放樣位置: Step 5, Step 4, Step 3 (鏡射至 minY - N * stepFt)
                        double dimY1 = minY - 5 * stepFt;
                        double dimY2 = minY - 4 * stepFt;
                        double dimY3 = minY - 3 * stepFt;

                        // Layer 1: 外牆總長 (最左與最右垂直外牆)
                        var d1 = CreateDimForSlice(doc, view, vertWalls, isVerticalAxis: false, isAscending: false, dimCoord: dimY1, spanMin: minX, spanMax: maxX, sliceCoord: null, targetDimType);
                        if (d1 != null) createdDims.Add(new { Side = "South", Layer = 1, Description = "外牆總長", DimensionId = d1.Id.GetIdValue(), ValueMm = d1.Value.HasValue ? Math.Round(d1.Value.Value * 304.8, 1) : 0 });

                        // Layer 2: 第一層居室/公共交誼廳主隔間牆 (割線在南外牆內縮 3.0m)
                        double sliceY1 = minY + 3.0 * 3.28084;
                        var d2 = CreateDimForSlice(doc, view, vertWalls, isVerticalAxis: false, isAscending: false, dimCoord: dimY2, spanMin: minX, spanMax: maxX, sliceCoord: sliceY1, targetDimType);
                        if (d2 != null) createdDims.Add(new { Side = "South", Layer = 2, Description = "居室/交誼廳主隔間", DimensionId = d2.Id.GetIdValue(), Segments = d2.Segments?.Size ?? 1 });

                        // Layer 3: 第二層走廊/機能隔間牆 (割線在南外牆內縮 7.5m)
                        double sliceY2 = minY + 7.5 * 3.28084;
                        var d3 = CreateDimForSlice(doc, view, vertWalls, isVerticalAxis: false, isAscending: false, dimCoord: dimY3, spanMin: minX, spanMax: maxX, sliceCoord: sliceY2, targetDimType);
                        if (d3 != null) createdDims.Add(new { Side = "South", Layer = 3, Description = "走廊/附屬機能隔間", DimensionId = d3.Id.GetIdValue(), Segments = d3.Segments?.Size ?? 1 });
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                CreatedDimensionsCount = createdDims.Count,
                Dimensions = createdDims,
                DimensionTypeName = targetDimType?.Name
            };
        }

        private Dimension CreateDimForSlice<T>(
            Document doc, ViewPlan view, List<T> wallItems,
            bool isVerticalAxis, bool isAscending, double dimCoord,
            double spanMin, double spanMax, double? sliceCoord,
            DimensionType targetDimType) where T : class
        {
            // 動態反射萃取 Wall, Line, Center, Min, Max
            var items = new List<(Wall wall, double center)>();
            const double tol = 0.082; // 25mm 聚類公差

            foreach (var item in wallItems)
            {
                dynamic dyn = item;
                Wall w = dyn.Wall;
                double c = dyn.Center;
                double minC = isVerticalAxis ? dyn.MinX : dyn.MinY;
                double maxC = isVerticalAxis ? dyn.MaxX : dyn.MaxY;

                if (sliceCoord.HasValue)
                {
                    if (sliceCoord.Value >= minC - tol && sliceCoord.Value <= maxC + tol)
                    {
                        items.Add((w, c));
                    }
                }
                else
                {
                    items.Add((w, c));
                }
            }

            if (items.Count == 0) return null;

            // 聚類去重 (以中心線座標排序)
            var sorted = items.OrderBy(x => x.center).ToList();
            var uniqueWalls = new List<(Wall wall, double center)>();
            foreach (var (w, c) in sorted)
            {
                if (uniqueWalls.Count == 0 || Math.Abs(uniqueWalls.Last().center - c) > tol)
                {
                    uniqueWalls.Add((w, c));
                }
            }

            // 若為 Layer 1 (sliceCoord == null)，只取極值兩端
            if (!sliceCoord.HasValue)
            {
                if (uniqueWalls.Count < 2) return null;
                uniqueWalls = new List<(Wall wall, double center)> { uniqueWalls.First(), uniqueWalls.Last() };
            }

            if (uniqueWalls.Count < 2) return null;

            // 根據方向排序 (isAscending: 由小到大；!isAscending: 由大到小)
            if (!isAscending)
            {
                uniqueWalls.Reverse();
            }

            ReferenceArray refArray = new ReferenceArray();
            foreach (var (w, _) in uniqueWalls)
            {
                refArray.Append(new Reference(w));
            }

            Line dimLine = null;
            if (isVerticalAxis)
            {
                // 標註線沿 Y 軸 (垂直)
                XYZ pStart = new XYZ(dimCoord, spanMin, 0);
                XYZ pEnd = new XYZ(dimCoord, spanMax, 0);
                dimLine = Line.CreateBound(pStart, pEnd);
            }
            else
            {
                // 標註線沿 X 軸 (水平)
                XYZ pStart = new XYZ(spanMax, dimCoord, 0);
                XYZ pEnd = new XYZ(spanMin, dimCoord, 0);
                dimLine = Line.CreateBound(pStart, pEnd);
            }

            Dimension dim = null;
            try
            {
                dim = doc.Create.NewDimension(view, dimLine, refArray);
                if (dim != null && targetDimType != null)
                {
                    dim.ChangeTypeId(targetDimType.Id);
                }
            }
            catch { }

            return dim;
        }

        private static void SetDimParam(Element el, int bipId, double val)
        {
            try
            {
                Parameter p = el.get_Parameter((BuiltInParameter)bipId);
                if (p != null && !p.IsReadOnly) p.Set(val);
            }
            catch {}
        }

        private static void SetDimParam(Element el, int bipId, int val)
        {
            try
            {
                Parameter p = el.get_Parameter((BuiltInParameter)bipId);
                if (p != null && !p.IsReadOnly) p.Set(val);
            }
            catch {}
        }

        private static void SetDimParam(Element el, int bipId, string val)
        {
            try
            {
                Parameter p = el.get_Parameter((BuiltInParameter)bipId);
                if (p != null && !p.IsReadOnly) p.Set(val);
            }
            catch {}
        }

        private static void SetDimParam(Element el, int bipId, ElementId val)
        {
            try
            {
                Parameter p = el.get_Parameter((BuiltInParameter)bipId);
                if (p != null && !p.IsReadOnly && val != null) p.Set(val);
            }
            catch {}
        }

        /// <summary>
        /// 確保指定名稱的標準標註型式存在於專案中，依規格庫權威參數精確建立與寫入
        /// </summary>
        public static DimensionType EnsureDimensionType(Document doc, string targetTypeName)
        {
            if (string.IsNullOrWhiteSpace(targetTypeName)) return null;

            // 1. 檢查是否已存在同名型式
            var existing = new FilteredElementCollector(doc)
                .OfClass(typeof(DimensionType))
                .Cast<DimensionType>()
                .FirstOrDefault(dt => dt.Name.Equals(targetTypeName, StringComparison.OrdinalIgnoreCase));

            // 2. 尋找最佳基礎線性標註型式以進行複製
            var allTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(DimensionType))
                .Cast<DimensionType>()
                .Where(dt => !dt.Name.Contains("Secret"))
                .ToList();

            DimensionType baseType = null;
            if (targetTypeName.Contains("dot") || targetTypeName.Contains("牆心"))
            {
                baseType = allTypes.FirstOrDefault(dt => dt.Name.Equals("TABC-DIM_dot", StringComparison.OrdinalIgnoreCase))
                        ?? allTypes.FirstOrDefault(dt => dt.Name.Contains("dot") && dt.FamilyName.Contains("線性"))
                        ?? allTypes.FirstOrDefault(dt => dt.FamilyName.Contains("線性"));
            }
            else
            {
                baseType = allTypes.FirstOrDefault(dt => dt.Name.Equals("TABC-DIM_*/ S 2.5", StringComparison.OrdinalIgnoreCase))
                        ?? allTypes.FirstOrDefault(dt => dt.Name.StartsWith("TABC") && dt.FamilyName.Contains("線性"))
                        ?? allTypes.FirstOrDefault(dt => dt.FamilyName.Contains("線性"));
            }

            if (baseType == null) baseType = allTypes.FirstOrDefault();
            if (baseType == null) return null;

            DimensionType targetType = existing;
            if (targetType == null)
            {
                try
                {
                    targetType = baseType.Duplicate(targetTypeName) as DimensionType;
                    if (targetType != null)
                    {
                        try { targetType.Name = targetTypeName; } catch {}
                        try
                        {
                            Parameter pName = targetType.get_Parameter(BuiltInParameter.SYMBOL_NAME_PARAM) 
                                           ?? targetType.get_Parameter(BuiltInParameter.ALL_MODEL_TYPE_NAME);
                            if (pName != null && !pName.IsReadOnly) pName.Set(targetTypeName);
                        }
                        catch {}
                    }
                }
                catch
                {
                    return null;
                }
            }

            if (targetType == null) return null;

            // 3. 尋找所有可用之端點箭頭符號 (Arrowheads)
            var allElements = new FilteredElementCollector(doc)
                .OfClass(typeof(ElementType))
                .ToList();

            Element hollowDot = allElements.FirstOrDefault(a => a.Name.Equals("TABC-空心點 1.5mm", StringComparison.OrdinalIgnoreCase))
                             ?? allElements.FirstOrDefault(a => a.Name.Contains("空心點") || a.Name.Contains("空心圓") || a.Name.Contains("Hollow"))
                             ?? allElements.FirstOrDefault(a => a.Name.Contains("圓點 1.5") || a.Name.Contains("Dot"));

            if (hollowDot == null)
            {
                foreach (var dt in allTypes)
                {
                    var p1 = dt.get_Parameter((BuiltInParameter)(-1006323));
                    if (p1 != null && p1.AsElementId() != ElementId.InvalidElementId)
                    {
                        var el = doc.GetElement(p1.AsElementId());
                        if (el != null && (el.Name.Contains("空心點") || el.Name.Contains("空心"))) { hollowDot = el; break; }
                    }
                    var p2 = dt.get_Parameter((BuiltInParameter)(-1006445));
                    if (p2 != null && p2.AsElementId() != ElementId.InvalidElementId)
                    {
                        var el = doc.GetElement(p2.AsElementId());
                        if (el != null && (el.Name.Contains("空心點") || el.Name.Contains("空心"))) { hollowDot = el; break; }
                    }
                }
            }

            Element solidDot = allElements.FirstOrDefault(a => a.Name.Equals("TABC-實圓點 1.5mm", StringComparison.OrdinalIgnoreCase))
                            ?? allElements.FirstOrDefault(a => a.Name.Contains("實圓點") || a.Name.Contains("實體圓點") || a.Name.Contains("Dot") || a.Name.Contains("圓點 1.5") || a.Name.Contains("圓點"))
                            ?? allElements.FirstOrDefault(a => a.Name.Contains("點"));

            if (solidDot == null)
            {
                foreach (var dt in allTypes)
                {
                    var p1 = dt.get_Parameter((BuiltInParameter)(-1006323));
                    if (p1 != null && p1.AsElementId() != ElementId.InvalidElementId)
                    {
                        var el = doc.GetElement(p1.AsElementId());
                        if (el != null && (el.Name.Contains("實圓點") || el.Name.Contains("dot"))) { solidDot = el; break; }
                    }
                    var p2 = dt.get_Parameter((BuiltInParameter)(-1006445));
                    if (p2 != null && p2.AsElementId() != ElementId.InvalidElementId)
                    {
                        var el = doc.GetElement(p2.AsElementId());
                        if (el != null && (el.Name.Contains("實圓點") || el.Name.Contains("dot"))) { solidDot = el; break; }
                    }
                }
            }

            Element diag3mm = allElements.FirstOrDefault(a => a.Name.Equals("對角線 3mm", StringComparison.OrdinalIgnoreCase))
                           ?? allElements.FirstOrDefault(a => a.Name.Contains("對角線 3") || a.Name.Contains("3mm") && a.Name.Contains("對角線"))
                           ?? allElements.FirstOrDefault(a => a.Name.Contains("對角線"));

            // 4. 依權威規格庫寫入參數 (使用 BuiltInParameter 數值 ID，精確跨專案跨語言保證)
            try
            {
                bool isWall = targetTypeName.Contains("dot") || targetTypeName.Contains("牆心");
                bool isDownRight = targetTypeName.Contains("下右") || targetTypeName.Contains("下左");

                // --- 顏色與線寬 ---
                // LINE_COLOR (-1006302): 0 = 黑色
                SetDimParam(targetType, -1006302, 0);
                // LINE_PEN (-1006303): 上右為 1, 下右為 2
                SetDimParam(targetType, -1006303, isDownRight ? 2 : 1);
                // TICK_MARK_PEN (-1006412): 4
                SetDimParam(targetType, -1006412, 4);

                // --- 文字相關 ---
                // TEXT_FONT (-1006300): 微軟正黑體
                SetDimParam(targetType, -1006300, "微軟正黑體");
                // TEXT_SIZE (-1006301): 牆心 2.0mm, 柱心 2.5mm
                SetDimParam(targetType, -1006301, isWall ? (2.0 / 304.8) : (2.5 / 304.8));
                // DIM_TEXT_BACKGROUND (-1006429): 1 = 透明
                SetDimParam(targetType, -1006429, 1);
                // TEXT_DIST_TO_LINE (-1006401): 文字偏移
                SetDimParam(targetType, -1006401, isWall ? (1.1 / 304.8) : 0.0);
                // TEXT_WIDTH_SCALE (-1006304): 寬度係數 1.0
                SetDimParam(targetType, -1006304, 1.0);
                // DIM_STYLE_READ_CONVENTION (-1006448): 讀取慣例 (2 = 向上，然後向右; 3 = 向左，然後向上)
                SetDimParam(targetType, -1006448, isDownRight ? 3 : 2);

                // --- 尺寸線與輔助線相關 ---
                // DIM_WITNS_LINE_CNTRL (-1006432): 1 = 固定尺寸線
                SetDimParam(targetType, -1006432, 1);
                // DIM_WITNS_LINE_EXTENSION_BELOW (-1006433): 輔助線長度 5.0 mm
                SetDimParam(targetType, -1006433, 5.0 / 304.8);
                // DIM_STYLE_DIM_LINE_SNAP_DIST (-1006446): 尺寸線鎖點距離 5.0 mm
                SetDimParam(targetType, -1006446, 5.0 / 304.8);
                // DIM_LINE_EXTENSION (-1006431): 尺寸延長線 0.0 mm
                SetDimParam(targetType, -1006431, 0.0);
                // DIM_STYLE_FLIPPED_DIM_LINE_EXTENSION (-1006434): 翻轉的尺寸延長線 2.4 mm
                SetDimParam(targetType, -1006434, 2.4 / 304.8);
                // WITNS_LINE_EXTENSION (-1006404): 輔助線延伸 1.5 mm
                SetDimParam(targetType, -1006404, 1.5 / 304.8);
                // WITNS_LINE_TO_ELEM_GAP (-1006405): 輔助線到元素的間隙 1.5 mm
                SetDimParam(targetType, -1006405, 1.5 / 304.8);
                // LINEAR_DIM_TYPE (-1006467): 1 = 連續
                SetDimParam(targetType, -1006467, 1);

                // --- 內部短斜線標記 ---
                if (diag3mm != null)
                {
                    // DIM_STYLE_INTERIOR_TICK_MARK (-1006447): 對角線 3mm
                    SetDimParam(targetType, -1006447, diag3mm.Id);
                }
                // DIM_STYLE_INTERIOR_TICK_MARK_DISPLAY (-1006449): 2 = 動態
                SetDimParam(targetType, -1006449, 2);

                // --- 中心線與端點記號 ---
                // DIM_STYLE_CENTERLINE_SYMBOL (-1006430): -1 = 無
                SetDimParam(targetType, -1006430, ElementId.InvalidElementId);

                // DIM_LEADER_ARROWHEAD (-1006323): 短斜線標記
                if (isWall)
                {
                    if (solidDot != null) SetDimParam(targetType, -1006323, solidDot.Id);
                }
                else
                {
                    // 柱心標註：端點必須是空心圓圈 (TABC-空心點 1.5mm)
                    if (hollowDot != null) SetDimParam(targetType, -1006323, hollowDot.Id);
                    else if (solidDot != null) SetDimParam(targetType, -1006323, solidDot.Id);

                    // DIM_STYLE_CENTERLINE_TICK_MARK (-1006445): 中心線短斜線標記 TABC-實圓點 1.5mm
                    if (solidDot != null) SetDimParam(targetType, -1006445, solidDot.Id);
                }
            }
            catch {}

            return targetType;
        }

        /// <summary>
        /// 批次確保規格庫標準標註型式存在 (支援 ensure_dimension_types 指令)
        /// </summary>
        private object EnsureDimensionTypes(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            var standardNames = new List<string>
            {
                "TABC-DIM_*/ S 2.5-柱心-上右",
                "TABC-DIM_*/ S 2.5-柱心-下右",
                "TABC-DIM_dot 牆心"
            };

            // 支援額外傳入指定名稱
            string customName = parameters?["dimensionTypeName"]?.Value<string>() ?? parameters?["name"]?.Value<string>();
            if (!string.IsNullOrWhiteSpace(customName) && !standardNames.Contains(customName))
            {
                standardNames.Add(customName);
            }

            var results = new List<object>();

            using (Transaction trans = TransactionHelper.Begin(doc, "確保標準標註型式存在"))
            {
                trans.Start();

                foreach (var name in standardNames)
                {
                    DimensionType dt = EnsureDimensionType(doc, name);
                    if (dt != null)
                    {
                        results.Add(new
                        {
                            DimensionTypeId = dt.Id.GetIdValue(),
                            DimensionTypeName = dt.Name,
                            FamilyName = dt.FamilyName,
                            Success = true
                        });
                    }
                    else
                    {
                        results.Add(new
                        {
                            DimensionTypeId = 0,
                            DimensionTypeName = name,
                            Success = false,
                            Message = "無法複製或建立該標註型式"
                        });
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                Count = results.Count,
                DimensionTypes = results,
                Message = $"成功確保 {results.Count} 個標準標註型式"
            };
        }

        #endregion
    }
}
