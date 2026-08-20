import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();

  const script = await client.sendCommand('execute_script', {
    code: `
      var doc = __revit__.ActiveUIDocument.Document;
      var collector = new Autodesk.Revit.DB.FilteredElementCollector(doc, new Autodesk.Revit.DB.ElementId(695));
      var dims = collector.OfClass(typeof(Autodesk.Revit.DB.Dimension)).ToElements();
      
      var list = new System.Collections.Generic.List<object>();
      foreach (var e in dims) {
        var d = e as Autodesk.Revit.DB.Dimension;
        if (d != null && d.Curve != null && d.Curve is Autodesk.Revit.DB.Line) {
          var ln = (Autodesk.Revit.DB.Line)d.Curve;
          var p0 = ln.GetEndPoint(0);
          var p1 = ln.GetEndPoint(1);
          
          var refIds = new System.Collections.Generic.List<int>();
          if (d.References != null) {
            foreach (Autodesk.Revit.DB.Reference r in d.References) {
              refIds.Add(r.ElementId.IntegerValue);
            }
          }

          list.Add(new {
            Id = d.Id.IntegerValue,
            TypeName = d.DimensionType.Name,
            TotalValueMm = d.Value.HasValue ? Math.Round(d.Value.Value * 304.8, 1) : 0,
            StartX = Math.Round(p0.X * 304.8, 1),
            StartY = Math.Round(p0.Y * 304.8, 1),
            EndX = Math.Round(p1.X * 304.8, 1),
            EndY = Math.Round(p1.Y * 304.8, 1),
            RefIds = string.Join(",", refIds)
          });
        }
      }
      list;
    `
  });

  console.log('=== 2FL Dimensions Coordinates ===');
  console.log(JSON.stringify(script.data, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
