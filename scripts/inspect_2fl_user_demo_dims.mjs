import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-demo-2fl';
  await client.connect();

  const viewId = 695; // 2FL

  console.log('================================================================');
  console.log('=== 連線讀取 2FL 使用者親自繪製的示範標註與線條 (唯讀檢視) ===');
  console.log('================================================================\n');

  // 1. 查詢 2FL 上所有尺寸標註
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', viewId: viewId, maxCount: 100 });
  console.log(`2FL 上共有 ${dimsRes.data?.Count || 0} 個尺寸標註:`);

  for (const d of dimsRes.data?.Elements || []) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
    console.log(`\n- 標註 ID: ${d.ElementId} | 名稱: "${d.Name}" | 類型: "${dInfo.data?.Type}"`);
    console.log(`  參數清單:`);
    for (const p of dInfo.data?.Parameters || []) {
      if (['長度', '尺寸', '類型', '族群與類型', '視圖'].includes(p.Name) || p.Name.includes('標註') || p.Name.includes('Value')) {
        console.log(`    * ${p.Name}: ${p.Value}`);
      }
    }
  }

  // 2. 查詢 2FL 上的線條 (找紅色、綠色、紫色線)
  const linesRes = await client.sendCommand('query_elements', { category: 'Lines', viewId: viewId, maxCount: 200 });
  console.log(`\n2FL 上共有 ${linesRes.data?.Count || 0} 條 Detail Lines:`);
  for (const l of linesRes.data?.Elements || []) {
    const lInfo = await client.sendCommand('get_element_info', { elementId: l.ElementId });
    console.log(`  - 線 ID: ${l.ElementId} | Name: "${l.Name}" | Type: "${lInfo.data?.Type}"`);
  }

  // 3. 查詢所有 Dimension Types 找到 "TABC-DIM_dot 牆心"
  const dimTypesRes = await client.sendCommand('list_dimension_types', {});
  console.log(`\n=== 標註型式清單比對 "TABC-DIM_dot" 或 "牆心" ===`);
  for (const dt of dimTypesRes.data?.DimensionTypes || []) {
    if (dt.DimensionTypeName.includes('牆心') || dt.DimensionTypeName.includes('dot') || dt.DimensionTypeName.includes('TABC-DIM')) {
      console.log(`  - ID: ${dt.DimensionTypeId.toString().padEnd(8)} | Name: "${dt.DimensionTypeName}" | Family: "${dt.FamilyName}"`);
    }
  }

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
