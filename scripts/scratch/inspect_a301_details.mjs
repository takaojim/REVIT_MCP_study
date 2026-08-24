import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-a301-details';
  await client.connect();

  console.log('=== 1. Sheet A301 (ID: 690575) Details ===');
  const sInfo = await client.sendCommand('get_element_info', { elementId: 690575 });
  console.log('Parameters:');
  for (const p of sInfo.data?.Parameters || []) {
    if (['圖紙號碼', '圖紙名稱', '比例', 'Scale', 'Sheet Number', 'Sheet Name'].includes(p.Name)) {
      console.log(`  ${p.Name}: ${p.Value}`);
    }
  }

  // Check viewports on sheet 690575
  const vpRes = await client.sendCommand('query_elements', { category: 'Viewports', maxCount: 1000 });
  console.log('\nAll Viewports:', vpRes.data?.Elements?.length);
  for (const vp of vpRes.data?.Elements || []) {
    const vpInfo = await client.sendCommand('get_element_info', { elementId: vp.ElementId });
    const sheetParam = vpInfo.data?.Parameters?.find(p => p.Name === '圖紙號碼' || p.Name === 'Sheet Number')?.Value;
    const viewParam = vpInfo.data?.Parameters?.find(p => p.Name === '檢視名稱' || p.Name === '視圖名稱' || p.Name === 'View Name')?.Value;
    console.log(`Viewport ${vp.ElementId} on Sheet [${sheetParam}], View: "${viewParam}"`);
  }

  console.log('\n=== 2. Four Architectural Elevation Views ===');
  const elevIds = [8157, 8176, 98984, 8237]; // 北, 東, 南, 西
  for (const id of elevIds) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: id });
    console.log(`\nView ${id} ("${vInfo.data?.Name}"):`);
    for (const p of vInfo.data?.Parameters || []) {
      if (['範圍框', 'Scope Box', '裁剪檢視', '裁剪視圖', 'Crop View', '裁剪區域可見', 'Crop Region Visible', '註解裁剪', 'Annotation Crop', '遠處裁剪作用中', '視圖比例', '比例值 1:'].includes(p.Name)) {
        console.log(`  ${p.Name}: ${p.Value}`);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
