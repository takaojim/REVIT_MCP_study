import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL FloorPlan

  // Switch to 2FL
  await client.sendCommand('set_active_view', { viewId: viewId });

  // Query all walls/columns on 2FL
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId });
  console.log('Walls on 2FL count:', wallsRes.data?.Count);

  // Let's sample walls to find the bounding box of 2FL
  const wallCoords = [];
  for (const w of wallsRes.data.Elements.slice(0, 40)) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success) {
      wallCoords.push(info.data);
    }
  }

  const allX = [];
  const allY = [];
  wallCoords.forEach(w => {
    allX.push(w.StartX, w.EndX);
    allY.push(w.StartY, w.EndY);
  });

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  console.log(`2FL Extent: X = [${minX}, ${maxX}] (Width: ${maxX - minX} mm), Y = [${minY}, ${maxY}] (Height: ${maxY - minY} mm)`);

  // Query rooms on 2FL
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  console.log('Rooms on 2FL count:', roomsRes.data?.TotalRooms);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
