import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-section-sheets';
  await client.connect();

  console.log('=== Inspecting Section Views and Sheets ===');
  const sectionIds = [590271, 624109, 624490, 693638]; // 剖面 1, 2, 3, 4

  for (const sId of sectionIds) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: sId });
    console.log(`\nView ${sId} ("${vInfo.data?.Name}"):`);

    const cropBox = await client.sendCommand('shift_view_cropbox', { viewId: sId, dx_mm: 0, dy_mm: 0 });
    console.log('  CropBox:', JSON.stringify(cropBox.data?.NewCropBox_mm));
  }

  // Find which sheet has these viewports
  const vpRes = await client.sendCommand('query_elements', { category: 'Viewports', maxCount: 1000 });
  for (const vp of vpRes.data?.Elements || []) {
    const vpInfo = await client.sendCommand('get_element_info', { elementId: vp.ElementId });
    const viewName = vpInfo.data?.Parameters?.find(p => p.Name === '檢視名稱' || p.Name === '視圖名稱' || p.Name === 'View Name')?.Value;
    const sheetNum = vpInfo.data?.Parameters?.find(p => p.Name === '圖紙號碼' || p.Name === 'Sheet Number')?.Value;
    const sheetName = vpInfo.data?.Parameters?.find(p => p.Name === '圖紙名稱' || p.Name === 'Sheet Name')?.Value;
    if (viewName?.includes('剖面')) {
      console.log(`\nViewport ${vp.ElementId}: View "${viewName}" is on Sheet [${sheetNum}] "${sheetName}"`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
