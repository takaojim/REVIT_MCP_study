import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'align-2fl-9steps';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【2FL 平面圖】實體外框抓取與 9 個間距軸線氣泡齊頭整列 ===');
  console.log('================================================================\n');

  // 1. 取得作用中視圖 (2FL)
  const viewRes = await client.sendCommand('get_active_view', {});
  const activeView = viewRes.data;
  console.log(`📌 作用中平面視圖: "${activeView?.Name}" (ID: ${activeView?.ElementId}), 比例 1:${activeView?.Scale}`);
  const viewId = activeView?.ElementId;
  const scale = activeView?.Scale || 100;

  // 2. 執行 align_plan_grids (stepCount: 9, stepMm: 650, usePhysicalEnvelope: true)
  console.log(`\n🚀 正在呼叫 align_plan_grids 指令...`);
  const alignRes = await client.sendCommand('align_plan_grids', {
    viewId: viewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false // 配置 A: 北側與東側顯示氣泡
  });

  console.log(`\n📋 指令回傳結果:`);
  console.log(JSON.stringify(alignRes, null, 2));

  if (!alignRes.success) {
    console.error('❌ 齊頭整列失敗:', alignRes.error);
    process.exit(1);
  }

  // 3. 查詢目前 2FL 視圖中所有軸線幾何端點，驗證齊頭狀態
  console.log(`\n🔍 正在驗證 2FL 視圖各軸線端點座標...`);
  const gridsRes = await client.sendCommand('query_elements', { category: 'Grids', viewId: viewId });
  const grids = gridsRes.data?.Elements || [];

  console.log(`\n軸線總數: ${grids.length} 條`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
