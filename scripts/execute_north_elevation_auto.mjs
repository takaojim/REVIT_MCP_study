import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'execute-north-elevation-auto';
  await client.connect();

  console.log('================================================================');
  console.log('=== 【北向立面】5 個間距 頂部柱心 ＋ 側邊樓層線標準標註 ===');
  console.log('================================================================\n');

  const viewId = 8157; // 北向立面

  // 1. 確保標註型式 (TABC-空心點 1.5mm 圓圈 + 黑色線條)
  await client.sendCommand('ensure_dimension_types', {});
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  const dimTypeList = dimTypesRes.data?.DimensionTypes || [];

  const typeIdUpRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-上右')?.DimensionTypeId || 1513273;
  const typeIdDownRight = dimTypeList.find(t => t.DimensionTypeName === 'TABC-DIM_*/ S 2.5-柱心-下右')?.DimensionTypeId || 1513281;

  console.log(`📌 標註型式:`);
  console.log(`   - 頂部柱心: ID ${typeIdUpRight} (TABC-DIM_*/ S 2.5-柱心-上右) [空心圓圈/黑]`);
  console.log(`   - 側邊樓層: ID ${typeIdDownRight} (TABC-DIM_*/ S 2.5-柱心-下右) [空心圓圈/黑]\n`);

  // 2. 清除該視圖舊有尺寸與輔助線
  const oldDims = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 1000 });
  for (const d of oldDims.data?.Elements || []) {
    try { await client.sendCommand('delete_element', { elementId: d.ElementId }); } catch (e) {}
  }
  console.log(`✓ 已清除視圖內舊有標註`);

  // 3. 呼叫 auto_dimension_elevation_grids 建立頂部雙層柱心標註 (Step 4 總跨, Step 3 連續)
  console.log('\n--- 執行頂部雙層柱心標註 ---');
  const gridDimRes = await client.sendCommand('auto_dimension_elevation_grids', {
    viewId: viewId,
    typeId: typeIdUpRight,
    offsetTier1Mm: 6.5,
    stepTier2Mm: 6.5
  });
  console.log('柱心標註結果:', gridDimRes.data || gridDimRes);

  // 4. 呼叫 auto_dimension_elevation_levels 建立側邊雙層樓層標註 (Step 4 總建高, Step 3 連續層高)
  console.log('\n--- 執行側邊雙層樓層高程標註 ---');
  const levelDimRes = await client.sendCommand('auto_dimension_elevation_levels', {
    viewId: viewId,
    typeId: typeIdDownRight,
    offsetTier1Mm: 30.0,
    stepTier2Mm: 6.5
  });
  console.log('樓層高程標註結果:', levelDimRes.data || levelDimRes);

  console.log('\n================================================================');
  console.log('=== 🎉 【北向立面】頂部柱心與側邊樓層標註建立完成！ ===');
  console.log('================================================================');

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
