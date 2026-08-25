import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'wall-coord-inspector';
  await client.connect();

  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: 428158 });
  const walls = wallsRes.data?.Elements || [];
  console.log(`3FL 中有 ${walls.length} 道牆體`);

  const wallInfos = [];
  for (const w of walls.slice(0, 8)) {
    const info = await client.sendCommand('get_wall_info', { elementId: w.ElementId });
    if (info.data) {
      wallInfos.push(info.data);
      console.log(`- 牆 ID ${w.ElementId}: P0(${info.data.StartPoint?.X}, ${info.data.StartPoint?.Y}) -> P1(${info.data.EndPoint?.X}, ${info.data.EndPoint?.Y})`);
    }
  }

  await client.disconnect();
}

main().catch(console.error);
