import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'batch-align-current-8steps';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【當前專案全樓板平面圖】8 個間距 (5,200mm) 軸線氣泡齊頭整列 ===');
  console.log('================================================================\n');

  // 當前開啟專案之主要樓板平面圖視圖清單
  // 4FL 為頂層主要樓層，RFL 與 TRFL 繼承 4FL (624294)
  const targetViews = [
    { id: 312, name: '1FL', refId: null },
    { id: 695, name: '2FL', refId: null },
    { id: 428158, name: '3FL', refId: null },
    { id: 624294, name: '4FL', refId: null },
    { id: 624304, name: 'RFL', refId: 624294 }, // 繼承 4FL 外框基準
    { id: 624314, name: 'TRFL', refId: 624294 }, // 繼承 4FL 外框基準
    { id: 390778, name: 'GL', refId: null }
  ];

  console.log(`📋 準備依序處理 ${targetViews.length} 個樓板平面圖視圖（齊頭間距: 8 個模矩 = 5,200.0 mm）...\n`);

  const summary = [];

  for (const v of targetViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始執行 8 間距齊頭整列...`);

    const payload = {
      viewId: v.id,
      stepCount: 8.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false // 配置 A: 北側與東側顯示氣泡
    };
    if (v.refId) {
      payload.referenceViewId = v.refId;
    }

    const alignRes = await client.sendCommand('align_plan_grids', payload);

    if (!alignRes.success) {
      console.error(`  ❌ 齊頭整列失敗 [${v.name}]:`, alignRes.error);
      summary.push({ name: v.name, status: 'FAILED', error: alignRes.error });
      continue;
    }

    const data = alignRes.data;
    console.log(`  ✓ 齊頭整列成功！共調整 ${data.AlignedGridsCount} 條軸線（0 錯誤）`);
    if (data.ReferenceViewName && data.ReferenceViewName !== data.ViewName) {
      console.log(`    - 🌟 繼承參考視圖: ${data.ReferenceViewName} (ID: ${data.ReferenceViewId})`);
    }
    if (data.PhysicalEnvelopeMm) {
      console.log(`    - 實體外框 X: [${data.PhysicalEnvelopeMm.MinX.toFixed(1)}, ${data.PhysicalEnvelopeMm.MaxX.toFixed(1)}] mm (寬 ${(data.PhysicalEnvelopeMm.Width / 1000).toFixed(2)}m)`);
      console.log(`    - 實體外框 Y: [${data.PhysicalEnvelopeMm.MinY.toFixed(1)}, ${data.PhysicalEnvelopeMm.MaxY.toFixed(1)}] mm (深 ${(data.PhysicalEnvelopeMm.Depth / 1000).toFixed(2)}m)`);
    }
    console.log(`    - 8間距齊頭範圍 (Offset 5,200mm): Top=${data.AlignmentBoundsMm.TopY.toFixed(1)}, Bottom=${data.AlignmentBoundsMm.BottomY.toFixed(1)}, Left=${data.AlignmentBoundsMm.LeftX.toFixed(1)}, Right=${data.AlignmentBoundsMm.RightX.toFixed(1)} mm`);

    // 繪製紅色實體外框線與藍色 8 間距齊頭線
    const env = data.PhysicalEnvelopeMm || {
      MinX: data.AlignmentBoundsMm.LeftX + 5200,
      MaxX: data.AlignmentBoundsMm.RightX - 5200,
      MinY: data.AlignmentBoundsMm.BottomY + 5200,
      MaxY: data.AlignmentBoundsMm.TopY - 5200
    };
    const bounds = data.AlignmentBoundsMm;

    const linesToDraw = [
      // --- 紅色實體外框 (4條邊) ---
      { startX: env.MinX, startY: env.MaxY, endX: env.MaxX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-北` },
      { startX: env.MaxX, startY: env.MaxY, endX: env.MaxX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-東` },
      { startX: env.MaxX, startY: env.MinY, endX: env.MinX, endY: env.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-南` },
      { startX: env.MinX, startY: env.MinY, endX: env.MinX, endY: env.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-實體外框-西` },

      // --- 藍色 8 間距齊頭線框 (4條邊) ---
      { startX: bounds.LeftX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-8間距齊頭-北` },
      { startX: bounds.RightX, startY: bounds.TopY, endX: bounds.RightX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-8間距齊頭-東` },
      { startX: bounds.RightX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-8間距齊頭-南` },
      { startX: bounds.LeftX, startY: bounds.BottomY, endX: bounds.LeftX, endY: bounds.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-8間距齊頭-西` }
    ];

    try {
      await client.sendCommand('create_detail_lines', {
        viewId: v.id,
        lines: linesToDraw
      });
      console.log(`    - 🎨 成功繪製 8 條檢測輔助線（4 紅 ＋ 4 藍 8間距）`);
    } catch (e) {
      console.log(`    - 輔助線繪製提示:`, e.message);
    }

    summary.push({
      name: v.name,
      id: v.id,
      grids: data.AlignedGridsCount,
      ref: data.ReferenceViewName || v.name,
      width: (env.Width / 1000).toFixed(2),
      depth: (env.Depth / 1000).toFixed(2),
      bounds: data.AlignmentBoundsMm,
      status: 'SUCCESS'
    });
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 當前專案全樓板平面圖 8 間距齊頭整列與輔助線繪製完成總覽 ===`);
  console.log(`================================================================`);
  for (const s of summary) {
    console.log(`- 視圖: ${s.name.padEnd(8)} | 軸線: ${s.grids} 條 | 基準: ${s.ref.padEnd(6)} | 外框: ${s.width}m x ${s.depth}m | 齊頭 Top: ${s.bounds.TopY.toFixed(1)} mm | 狀態: ${s.status}`);
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
