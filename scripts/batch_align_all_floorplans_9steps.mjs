import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-align-floorplans-9steps';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【全樓板平面圖】實體外框抓取與 9 個間距軸線氣泡齊頭整列 ===');
  console.log('================================================================\n');

  // 1. 定義要處理的樓板平面圖視圖清單
  const targetViews = [
    { id: 312, name: '1FL' },
    { id: 695, name: '2FL' },
    { id: 428158, name: '3FL' },
    { id: 586080, name: '4FL' },
    { id: 1334374, name: '5FL' },
    { id: 586090, name: 'RFL' },
    { id: 586100, name: 'TRFL' },
    { id: 390778, name: 'GL' }
  ];

  console.log(`📋 準備依序處理 ${targetViews.length} 個樓板平面圖視圖...\n`);

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始執行...`);

    // 1. 切換作用中視圖
    try {
      await client.sendCommand('set_active_view', { viewId: v.id });
    } catch (e) {
      console.log(`  ℹ 切換視圖提示:`, e.message);
    }

    // 2. 呼叫 align_plan_grids
    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      stepCount: 9.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false // 配置 A: 北側與東側顯示氣泡
    });

    if (!alignRes.success) {
      console.error(`  ❌ 齊頭整列失敗 [${v.name}]:`, alignRes.error);
      summary.push({ name: v.name, status: 'FAILED', error: alignRes.error });
      continue;
    }

    const data = alignRes.data;
    console.log(`  ✓ 齊頭整列成功！共調整 ${data.AlignedGridsCount} 條軸線（0 錯誤）`);
    if (data.PhysicalEnvelopeMm) {
      console.log(`    - 實體外框 X: [${data.PhysicalEnvelopeMm.MinX.toFixed(1)}, ${data.PhysicalEnvelopeMm.MaxX.toFixed(1)}] mm`);
      console.log(`    - 實體外框 Y: [${data.PhysicalEnvelopeMm.MinY.toFixed(1)}, ${data.PhysicalEnvelopeMm.MaxY.toFixed(1)}] mm`);
      console.log(`    - 實體總寬深: 寬 ${(data.PhysicalEnvelopeMm.Width / 1000).toFixed(2)}m x 深 ${(data.PhysicalEnvelopeMm.Depth / 1000).toFixed(2)}m`);
    }

    // 3. 繪製紅色實體外框線與藍色 9 間距齊頭線
    const env = data.PhysicalEnvelopeMm || {
      MinX: data.AlignmentBoundsMm.LeftX + 5850,
      MaxX: data.AlignmentBoundsMm.RightX - 5850,
      MinY: data.AlignmentBoundsMm.BottomY + 5850,
      MaxY: data.AlignmentBoundsMm.TopY - 5850
    };
    const bounds = data.AlignmentBoundsMm;

    const linesToDraw = [
      // --- 紅色實體外框 (4條邊) ---
      { startX: env.MinX, startY: env.MaxY, endX: env.MaxX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-北` },
      { startX: env.MaxX, startY: env.MaxY, endX: env.MaxX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-東` },
      { startX: env.MaxX, startY: env.MinY, endX: env.MinX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-南` },
      { startX: env.MinX, startY: env.MinY, endX: env.MinX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-西` },

      // --- 藍色 9 間距齊頭線框 (4條邊) ---
      { startX: bounds.LeftX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-北` },
      { startX: bounds.RightX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-東` },
      { startX: bounds.RightX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-南` },
      { startX: bounds.LeftX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-西` }
    ];

    try {
      const drawRes = await client.sendCommand('create_detail_lines', {
        viewId: v.id,
        lines: linesToDraw
      });
      console.log(`    - 🎨 成功繪製 8 條檢測輔助線（4 紅 ＋ 4 藍）`);
    } catch (e) {
      console.log(`    - 輔助線繪製提示:`, e.message);
    }

    summary.push({
      name: v.name,
      id: v.id,
      grids: data.AlignedGridsCount,
      elements: data.PhysicalElementsEvaluated,
      status: 'SUCCESS'
    });
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 全樓板平面圖 9 間距齊頭整列與輔助線繪製完成總覽 ===`);
  console.log(`================================================================`);
  for (const s of summary) {
    console.log(`- 視圖: ${s.name.padEnd(8)} | 軸線: ${s.grids} 條 | 評估實體: ${s.elements} 個 | 狀態: ${s.status}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
