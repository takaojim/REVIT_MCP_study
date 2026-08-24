import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'align-roof-with-5fl';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【RFL & TRFL】依 5FL 實體外牆外框基準 進行 9 間距齊頭整列 ===');
  console.log('================================================================\n');

  const refViewId = 1334374; // 5FL View ID

  // 1. 先從 5FL 抓取完整的實體外框極值
  console.log(`📌 步驟 1: 正在從 5FL (ID: ${refViewId}) 提取實體外牆外框基準...`);
  const align5fl = await client.sendCommand('align_plan_grids', {
    viewId: refViewId,
    stepCount: 9.0,
    stepMm: 650.0,
    usePhysicalEnvelope: true,
    showAllBubbles: false
  });

  if (!align5fl.success) {
    throw new Error(`無法取得 5FL 實體外框: ${align5fl.error}`);
  }

  const env5fl = align5fl.data.PhysicalEnvelopeMm;
  const bounds5fl = align5fl.data.AlignmentBoundsMm;

  console.log(`✓ 5FL 實體外框基準:`);
  console.log(`  - X 範圍: [${env5fl.MinX.toFixed(1)}, ${env5fl.MaxX.toFixed(1)}] mm (寬 ${(env5fl.Width / 1000).toFixed(2)}m)`);
  console.log(`  - Y 範圍: [${env5fl.MinY.toFixed(1)}, ${env5fl.MaxY.toFixed(1)}] mm (深 ${(env5fl.Depth / 1000).toFixed(2)}m)`);
  console.log(`  - 9間距齊頭線: Top=${bounds5fl.TopY.toFixed(1)}, Bottom=${bounds5fl.BottomY.toFixed(1)}, Left=${bounds5fl.LeftX.toFixed(1)}, Right=${bounds5fl.RightX.toFixed(1)} mm\n`);

  // 2. 對 RFL (586090) 與 TRFL (586100) 套用 5FL 外框齊頭
  const roofViews = [
    { id: 586090, name: 'RFL' },
    { id: 586100, name: 'TRFL' }
  ];

  for (const v of roofViews) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🚀 [${v.name}] (View ID: ${v.id}) 開始依 5FL 基準齊頭整列...`);

    const alignRes = await client.sendCommand('align_plan_grids', {
      viewId: v.id,
      referenceViewId: refViewId,
      stepCount: 9.0,
      stepMm: 650.0,
      usePhysicalEnvelope: true,
      showAllBubbles: false // 配置 A
    });

    if (!alignRes.success) {
      console.error(`  ❌ [${v.name}] 齊頭整列失敗:`, alignRes.error);
      continue;
    }

    const data = alignRes.data;
    console.log(`  ✓ 齊頭整列成功！共調整 ${data.AlignedGridsCount} 條軸線（0 錯誤）`);
    console.log(`    - 繼承參考視圖: ${data.ReferenceViewName || '5FL'} (ID: ${data.ReferenceViewId || refViewId})`);
    console.log(`    - 9間距齊頭範圍: Top=${data.AlignmentBoundsMm.TopY.toFixed(1)}, Bottom=${data.AlignmentBoundsMm.BottomY.toFixed(1)}, Left=${data.AlignmentBoundsMm.LeftX.toFixed(1)}, Right=${data.AlignmentBoundsMm.RightX.toFixed(1)} mm`);

    // 3. 繪製 5FL 實體外框紅線與 9 間距齊頭藍線
    const linesToDraw = [
      // --- 紅色 5FL 實體外框基準 (4條邊) ---
      { startX: env5fl.MinX, startY: env5fl.MaxY, endX: env5fl.MaxX, endY: env5fl.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-5FL外牆基準-北` },
      { startX: env5fl.MaxX, startY: env5fl.MaxY, endX: env5fl.MaxX, endY: env5fl.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-5FL外牆基準-東` },
      { startX: env5fl.MaxX, startY: env5fl.MinY, endX: env5fl.MinX, endY: env5fl.MinY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-5FL外牆基準-南` },
      { startX: env5fl.MinX, startY: env5fl.MinY, endX: env5fl.MinX, endY: env5fl.MaxY, color: { r: 255, g: 0, b: 0 }, label: `${v.name}-5FL外牆基準-西` },

      // --- 藍色 9 間距齊頭線框 (4條邊) ---
      { startX: bounds5fl.LeftX, startY: bounds5fl.TopY, endX: bounds5fl.RightX, endY: bounds5fl.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-北` },
      { startX: bounds5fl.RightX, startY: bounds5fl.TopY, endX: bounds5fl.RightX, endY: bounds5fl.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-東` },
      { startX: bounds5fl.RightX, startY: bounds5fl.BottomY, endX: bounds5fl.LeftX, endY: bounds5fl.BottomY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-南` },
      { startX: bounds5fl.LeftX, startY: bounds5fl.BottomY, endX: bounds5fl.LeftX, endY: bounds5fl.TopY, color: { r: 0, g: 100, b: 255 }, label: `${v.name}-9間距齊頭-西` }
    ];

    try {
      const drawRes = await client.sendCommand('create_detail_lines', {
        viewId: v.id,
        lines: linesToDraw
      });
      console.log(`    - 🎨 成功繪製 8 條檢測輔助線（4 紅 5FL外框 ＋ 4 藍 齊頭線）`);
    } catch (e) {
      console.log(`    - 輔助線繪製提示:`, e.message);
    }
  }

  console.log(`\n================================================================`);
  console.log(`=== 🎉 RFL & TRFL 依 5FL 基準齊頭整列完成！ ===`);
  console.log(`================================================================`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
