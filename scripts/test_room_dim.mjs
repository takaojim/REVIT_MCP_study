import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data.ElementId;
  console.log(`Using View ID: ${viewId} (${viewRes.data.Name})`);

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '4FL' });
  const rooms = roomsRes.data.Rooms || [];
  const testRoom = rooms[0]; // e.g. 洗衣房/烘衣房

  console.log(`Test Room: ID ${testRoom.ElementId}, Name: "${testRoom.Name}"`);

  const dimX = await client.sendCommand('create_dimension_by_bounding_box', {
    viewId: viewId,
    roomId: testRoom.ElementId,
    axis: 'X',
    offset: 500
  });
  console.log('Dim X result:', dimX);

  const dimY = await client.sendCommand('create_dimension_by_bounding_box', {
    viewId: viewId,
    roomId: testRoom.ElementId,
    axis: 'Y',
    offset: 500
  });
  console.log('Dim Y result:', dimY);

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
