import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 428158; // 3FL

  // 1. Query Rooms on 3FL
  try {
    const rooms = await client.sendCommand('get_rooms_by_level', { level: '3FL' });
    console.log('Rooms on 3FL:', JSON.stringify(rooms, null, 2));
  } catch (e) {
    console.error('Rooms query error:', e.message);
  }

  // 2. Query Structural Columns
  try {
    const structCols = await client.sendCommand('query_elements', { category: '結構柱' });
    console.log('Structural Columns count:', structCols?.data?.Count);
    if (structCols?.data?.Elements?.length) {
      console.log('Sample structural columns:', structCols.data.Elements.slice(0, 10));
    }
  } catch (e) {
    console.error('Struct columns query error:', e.message);
  }

  // 3. Query Walls in 3FL view
  try {
    const walls = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId });
    console.log('Walls in 3FL count:', walls?.data?.Count);
    if (walls?.data?.Elements?.length) {
      console.log('Sample walls:', walls.data.Elements.slice(0, 5));
    }
  } catch (e) {
    console.error('Walls query error:', e.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
