import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-existing-dims';
  await client.connect();

  console.log('=== Inspecting All Existing Dimensions in 4 Elevation Views ===');

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  // Query all dimensions in project
  const dimsRes = await client.sendCommand('query_elements', { category: 'Dimensions', maxCount: 1000 });
  const allDims = dimsRes.data?.Elements || [];

  for (const e of elevs) {
    console.log(`\n========================================`);
    console.log(`>>> Checking View: ${e.name} (ID: ${e.id}) <<<`);
    console.log(`========================================`);

    const viewDims = [];
    for (const d of allDims) {
      const dInfo = await client.sendCommand('get_element_info', { elementId: d.ElementId });
      const ownerView = dInfo.data?.Parameters?.find(p => p.Name === '檢視' || p.Name === '視圖' || p.Name === 'View' || p.Name === '主體視圖')?.Value;
      const ownerViewId = dInfo.data?.Parameters?.find(p => p.Name === '檢視' || p.Name === '視圖' || p.Name === 'View' || p.Name === '主體視圖');
      
      // Let's check if the dimension belongs to this view
      const lenVal = dInfo.data?.Parameters?.find(p => p.Name === '值' || p.Name === 'Value' || p.Name === '長度' || p.Name === '總長度')?.Value;
      const typeName = dInfo.data?.Type;
      
      if (ownerView === e.name || ownerView?.includes(e.name)) {
        viewDims.push({
          id: d.ElementId,
          type: typeName,
          value: lenVal,
          params: dInfo.data?.Parameters
        });
        console.log(`  - Dim ID: ${d.ElementId} | Type: "${typeName}" | Value: ${lenVal}`);
      }
    }
    console.log(`Total Dimensions in ${e.name}: ${viewDims.length}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
