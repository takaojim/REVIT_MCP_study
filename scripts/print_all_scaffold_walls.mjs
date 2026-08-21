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
  console.log('Total Walls count:', d.IncludedWalls.length);
  console.table(d.IncludedWalls.map((w, idx) => ({
    No: idx + 1,
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
