import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('get_rooms_by_level', { level: '2FL' });
  const rooms = roomsRes.data.Rooms || [];

  const targetNames = ['女浴', '男浴', 'B211', 'B212', '教具室', '醫材儲藏室'];
  const targets = rooms.filter(r => {
    return targetNames.some(t => r.Name.includes(t)) || 
      (parseInt(r.Number.replace('F', '')) >= 235 && parseInt(r.Number.replace('F', '')) <= 248);
  });

  targets.sort((a,b) => parseInt(a.Number.replace('F','')) - parseInt(b.Number.replace('F','')));
  console.log('Target Suite Rooms (Topology Verified):');
  console.table(targets.map(r => ({
    房號: r.Number,
    名稱: r.Name,
    ElementId: r.ElementId,
    面積: r.Area
  })));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
