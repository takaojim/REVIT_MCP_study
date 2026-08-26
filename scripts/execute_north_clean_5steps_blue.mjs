import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'draw-clean-blue-lines-' + Date.now();
  await client.connect();

  const viewId = 8157; // 北向立面
  const redLineIds = [709095, 709096, 709097, 709098];

  // 1. 清除所有舊輔助線（除使用者對齊的 4 條紅線外）與尺寸
  const oldLines = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 1000 });
  for (const l of oldLines.data?.Elements || []) {
    if (!redLineIds.includes(l.ElementId)) {
      try { await client.sendCommand('delete_element', { elementId: l.ElementId }); } catch (e) {}
    }
  }
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  console.log('✓ 已清理完畢，保留 4 條基準紅線');

  // 2. 嚴格依 4 條紅線外推 5 個間距 (3,250 mm) 繪製 4 條標準藍線:
  // 左紅線: X = 826.8 mm -> 5間距左藍線: X = -2,423.2 mm (u = 9748.1)
  // 右紅線: X = 16026.8 mm -> 5間距右藍線: X = 19,276.8 mm (u = -11951.9)
  // 底紅線: Z = 0.0 mm -> 5間距底藍線: Z = -3,250.0 mm (v = -3250.0)
  // 頂紅線: Z = 18550.0 mm -> 5間距頂藍線: Z = 21,800.0 mm (v = 21800.0)

  const uLeftBlue = 9748.1;
  const uRightBlue = -11951.9;
  const vBottomBlue = -3250.0;
  const vTopBlue = 21800.0;

  const blueLines = [
    // 🔵 頂部藍線 (貼齊頂部所有軸線氣泡圓圈)
    { startX: uLeftBlue + 1500, startY: vTopBlue, endX: uRightBlue - 1500, endY: vTopBlue, color: { r: 0, g: 100, b: 255 }, label: '北立面-頂部藍線 (紅線外推5個間距 3250mm)' },
    // 🔵 左側藍線 (貼齊左側所有樓層線標示圈)
    { startX: uLeftBlue, startY: vBottomBlue - 1500, endX: uLeftBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-左側藍線 (紅線外推5個間距 3250mm)' },
    // 🔵 底部藍線
    { startX: uLeftBlue + 1500, startY: vBottomBlue, endX: uRightBlue - 1500, endY: vBottomBlue, color: { r: 0, g: 100, b: 255 }, label: '北立面-底部藍線 (紅線外推5個間距 3250mm)' },
    // 🔵 右側藍線
    { startX: uRightBlue, startY: vBottomBlue - 1500, endX: uRightBlue, endY: vTopBlue + 1500, color: { r: 0, g: 100, b: 255 }, label: '北立面-右側藍線 (紅線外推5個間距 3250mm)' }
  ];

  const lineRes = await client.sendCommand('create_detail_lines', {
    viewId: viewId,
    lines: blueLines
  });
  console.log('✓ 4 條 5 間距標準藍線繪製完成:', lineRes.data);

  // 3. 建立標準頂部雙層柱心標註與左側雙層樓層標註
  const typeIdUpRight = 689724;
  const typeIdDownRight = 689732;

  await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });

  await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5,
    baseLevelName: 'GL'
  });

  console.log('✓ 頂部與左側雙層標註更新完成');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
