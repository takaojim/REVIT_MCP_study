import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const stairIds = [1527417, 1527465, 1527561, 1646635, 1646683, 1646731, 1646779, 1656623, 1656991, 1865520, 1865568, 1866599, 1869684];

  console.log('=== 查詢所有樓梯的寬度與參數 ===');
  for (const sid of stairIds) {
    try {
      const width = await client.sendCommand('get_stair_actual_width', { stairId: sid });
      console.log(`Stair ID ${sid}:`, JSON.stringify(width.data));
    } catch (e) {
      console.log(`Stair ID ${sid} get_stair_actual_width 失敗: ${e.message}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
