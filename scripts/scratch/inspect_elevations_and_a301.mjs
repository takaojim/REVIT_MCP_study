import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevations-a301';
  await client.connect();

  console.log('=== 1. Inspecting Sheets ===');
  const sheetsRes = await client.sendCommand('query_elements', { category: 'Sheets', maxCount: 1000 });
  for (const s of (sheetsRes.data?.Elements || [])) {
    const sInfo = await client.sendCommand('get_element_info', { elementId: s.ElementId });
    const num = sInfo.data?.Parameters?.find(p => p.Name === '圖紙號碼' || p.Name === 'Sheet Number')?.Value;
    const name = sInfo.data?.Parameters?.find(p => p.Name === '圖紙名稱' || p.Name === 'Sheet Name')?.Value;
    console.log(`Sheet ID: ${s.ElementId} | Number: [${num}] | Name: "${name}"`);
  }

  console.log('\n=== 2. Inspecting All Views with name containing 立面, 向, Elevation ===');
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  for (const v of (viewsRes.data?.Elements || [])) {
    if (v.Name?.includes('立面') || v.Name?.includes('北') || v.Name?.includes('南') || v.Name?.includes('東') || v.Name?.includes('西') || v.Name?.includes('Elevation')) {
      const vInfo = await client.sendCommand('get_element_info', { elementId: v.ElementId });
      const viewType = vInfo.data?.Parameters?.find(p => p.Name === '視圖類型' || p.Name === 'View Type' || p.Name === '類型')?.Value;
      const scopeBox = vInfo.data?.Parameters?.find(p => p.Name === '範圍框' || p.Name === 'Scope Box')?.Value;
      const cropActive = vInfo.data?.Parameters?.find(p => p.Name === '裁剪檢視' || p.Name === '裁剪視圖' || p.Name === 'Crop View')?.Value;
      const cropVisible = vInfo.data?.Parameters?.find(p => p.Name === '裁剪區域可見' || p.Name === 'Crop Region Visible')?.Value;
      const farClip = vInfo.data?.Parameters?.find(p => p.Name === '遠處裁剪作用中' || p.Name === 'Far Clipping')?.Value;
      console.log(`View ID: ${v.ElementId} | Name: "${v.Name}" | ScopeBox: "${scopeBox}" | Crop: ${cropActive} | Visible: ${cropVisible} | FarClip: ${farClip}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
