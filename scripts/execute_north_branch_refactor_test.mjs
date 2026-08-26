import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-elevation-refactor-' + Date.now();
  await client.connect();

  console.log('================================================================');
  console.log('=== 【分支實測】標準立面外輪廓整列與 5 間距標註全新指令執行 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保 TABC 標註型式存在
  await client.sendCommand('ensure_dimension_types', {});

  // 2. 呼叫全新 C# 原生重構指令
  console.log('📌 執行 align_and_dimension_elevation...');
  const res = await client.sendCommand('align_and_dimension_elevation', {
    viewId: viewId,
    stepModules: 5,
    drawGuideLines: true,
    cleanExisting: true
  });

  console.log('\n=== 執行成果報告 ===');
  console.log(JSON.stringify(res.data, null, 2));

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
