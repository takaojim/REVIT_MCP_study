import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const scaffoldRes = await client.sendCommand('calculate_exterior_wall_scaffold_perimeter', {
    levelName: '2FL',
    activeViewOnly: false,
    includeCurtainWalls: true,
    selectResult: true,
    scaffoldHeightMm: 3600
  });

  const d = scaffoldRes.data;
  console.log('=== 2FL 外牆施工架算量摘要 ===');
  console.log({
    Mode: d.Mode,
    Level: d.Level,
    AnalyzedWallCount: d.AnalyzedWallCount,
    IncludedWallCount: d.IncludedWallCount,
    ExcludedWallCount: d.ExcludedWallCount,
    TotalPerimeterMm: d.TotalPerimeterMm,
    TotalPerimeterM: d.TotalPerimeterM,
    ScaffoldHeightMm: d.ScaffoldHeightMm,
    ScaffoldAreaSqM: d.ScaffoldAreaSqM
  });

  console.log('\n=== 外牆明細清單 (前 15 筆) ===');
  console.table(d.IncludedWalls.slice(0, 15).map(w => ({
    WallId: w.WallId,
    TypeName: w.TypeName,
    LengthM: w.LengthM,
    Reason: w.InclusionReason,
    Start: `(${Math.round(w.Start.X)}, ${Math.round(w.Start.Y)})`,
    End: `(${Math.round(w.End.X)}, ${Math.round(w.End.Y)})`
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
