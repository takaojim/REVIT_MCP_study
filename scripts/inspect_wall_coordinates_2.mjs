import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'wall-coord-inspector-2';
  await client.connect();

  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: 428158 });
  const walls = wallsRes.data?.Elements || [];
  console.log(`3FL 中有 ${walls.length} 道牆體`);

  const pts = [];
  for (const w of walls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.data && info.data.StartPoint && info.data.EndPoint) {
      pts.push(info.data.StartPoint);
      pts.push(info.data.EndPoint);
    }
  }

  const minX = Math.min(...pts.map(p => p.X));
  const maxX = Math.max(...pts.map(p => p.X));
  const minY = Math.min(...pts.map(p => p.Y));
  const maxY = Math.max(...pts.map(p => p.Y));

  console.log(`\n=== 3FL 建築物外框極值幾何座標 (mm) ===`);
  console.log(`- X 範圍: [${minX.toFixed(2)}, ${maxX.toFixed(2)}] (總寬: ${(maxX - minX).toFixed(2)} mm)`);
  console.log(`- Y 範圍: [${minY.toFixed(2)}, ${maxY.toFixed(2)}] (總深: ${(maxY - minY).toFixed(2)} mm)`);

  await client.disconnect();
}

main().catch(console.error);
