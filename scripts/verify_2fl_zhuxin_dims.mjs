import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL
  const ids = [2110202, 2110205, 2110213, 2110216, 2110221, 2110224, 2110228, 2110231];

  const results = [];
  for (const id of ids) {
    const info = await client.sendCommand('get_element_info', { elementId: id });
    results.push({
      ElementId: id,
      TypeName: info.data?.Type,
      Category: info.data?.Category
    });
  }

  console.log('\n=== 2FL 柱心尺寸標註類型驗證結果 ===');
  console.table(results);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
