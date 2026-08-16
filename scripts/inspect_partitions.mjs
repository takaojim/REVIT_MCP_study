import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL

  // 1. Get all walls on 3FL
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId });
  console.log('Total walls on 3FL:', wallsRes.data?.Count);

  const wallDetails = [];
  for (const w of wallsRes.data.Elements) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success) {
      wallDetails.push(info.data);
    }
  }

  // Find exterior boundary of all walls
  const allX = [];
  const allY = [];
  wallDetails.forEach(w => {
    allX.push(w.StartX, w.EndX);
    allY.push(w.StartY, w.EndY);
  });

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  console.log(`Building Bounds: X = [${minX}, ${maxX}] (Width: ${maxX - minX}), Y = [${minY}, ${maxY}] (Height: ${maxY - minY})`);

  // Analyze unique X coordinates of vertical walls (room partitions)
  const verticalWalls = wallDetails.filter(w => Math.abs(w.StartX - w.EndX) < 50);
  const vCoords = [...new Set(verticalWalls.map(w => Math.round((w.StartX + w.EndX) / 2)))].sort((a,b) => a - b);
  console.log('Vertical Wall X coords (Partitions):', vCoords);

  // Analyze unique Y coordinates of horizontal walls (room partitions)
  const horizontalWalls = wallDetails.filter(w => Math.abs(w.StartY - w.EndY) < 50);
  const hCoords = [...new Set(horizontalWalls.map(w => Math.round((w.StartY + w.EndY) / 2)))].sort((a,b) => a - b);
  console.log('Horizontal Wall Y coords (Partitions):', hCoords);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
