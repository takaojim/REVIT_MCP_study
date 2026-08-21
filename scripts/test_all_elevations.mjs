import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-all-elevations';
  await client.connect();

  console.log('=== 測試各立面圖標註 ===\n');

  // 1. 測試 東立面 (Grids 1~8)
  const eastViewId = 8176;
  await client.sendCommand('set_active_view', { viewId: eastViewId });
  const eastGrids = await client.sendCommand('query_elements', { category: 'Grids', viewId: eastViewId });
  const egMap = {};
  for (const g of eastGrids.data?.Elements || []) egMap[g.Name] = g.ElementId;
  console.log('東立面 Grids:', egMap);

  try {
    const res = await client.sendCommand('create_dimension', {
      viewId: eastViewId,
      gridIds: [egMap['1'], egMap['8']],
      startX: 0,
      startY: -26000,
      endX: 0,
      endY: 38067
    });
    console.log('東立面建立總尺寸結果:', res);
    if (res.data?.DimensionId) {
      await client.sendCommand('delete_element', { elementId: res.data.DimensionId });
      console.log('東立面測試成功，已清理');
    }
  } catch (err) {
    console.error('東立面測試失敗:', err);
  }

  // 2. 測試 南立面 (Grids A~H)
  const southViewId = 98984;
  await client.sendCommand('set_active_view', { viewId: southViewId });
  const southGrids = await client.sendCommand('query_elements', { category: 'Grids', viewId: southViewId });
  const sgMap = {};
  for (const g of southGrids.data?.Elements || []) sgMap[g.Name] = g.ElementId;
  console.log('\n南立面 Grids:', sgMap);

  try {
    const res = await client.sendCommand('create_dimension', {
      viewId: southViewId,
      gridIds: [sgMap['H'], sgMap['A']],
      startX: -1691.74,
      startY: 0,
      endX: 47333.25,
      endY: 0
    });
    console.log('南立面建立總尺寸結果:', res);
    if (res.data?.DimensionId) {
      await client.sendCommand('delete_element', { elementId: res.data.DimensionId });
      console.log('南立面測試成功，已清理');
    }
  } catch (err) {
    console.error('南立面測試失敗:', err);
  }

  // 3. 測試 西立面 (Grids 1~8)
  const westViewId = 8237;
  await client.sendCommand('set_active_view', { viewId: westViewId });
  const westGrids = await client.sendCommand('query_elements', { category: 'Grids', viewId: westViewId });
  const wgMap = {};
  for (const g of westGrids.data?.Elements || []) wgMap[g.Name] = g.ElementId;
  console.log('\n西立面 Grids:', wgMap);

  try {
    const res = await client.sendCommand('create_dimension', {
      viewId: westViewId,
      gridIds: [wgMap['8'], wgMap['1']],
      startX: 0,
      startY: 38067,
      endX: 0,
      endY: -26000
    });
    console.log('西立面建立總尺寸結果:', res);
    if (res.data?.DimensionId) {
      await client.sendCommand('delete_element', { elementId: res.data.DimensionId });
      console.log('西立面測試成功，已清理');
    }
  } catch (err) {
    console.error('西立面測試失敗:', err);
  }

  await client.disconnect();
}

main().catch(console.error);
