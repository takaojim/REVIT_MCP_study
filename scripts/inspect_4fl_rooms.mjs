import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('=== 1. 查詢 4FL 視圖資訊 ===');
  const activeView = await client.sendCommand('get_active_view', {});
  console.log('Active View:', activeView.data);

  // 查詢專案中名稱包含 4FL 的平面視圖
  const viewsRes = await client.sendCommand('query_elements', {
    category: 'Views',
    returnFields: ['名稱', '視圖類型']
  });
  const allViews = viewsRes.data?.Elements || [];
  const planViews4F = allViews.filter(v => (v.Name || v['名稱'])?.includes('4FL') || (v.Name || v['名稱'])?.includes('4F'));
  console.log('4F Plan Views:', planViews4F);

  // 查詢 4FL 房間
  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '4FL' });
  console.log('Rooms on 4FL summary:', {
    Level: roomsRes.data?.Level,
    TotalRooms: roomsRes.data?.TotalRooms,
    TotalArea: roomsRes.data?.TotalArea
  });

  const rooms = roomsRes.data?.Rooms || [];
  console.log(`4FL 共有 ${rooms.length} 間房間。前 10 間：`);
  console.table(rooms.slice(0, 10).map(r => ({
    ElementId: r.ElementId,
    Number: r.Number,
    Name: r.Name,
    Area: r.Area
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
