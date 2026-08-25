import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'verify-sections';
  await client.connect();

  const sectionIds = [590271, 624109, 624490, 693638];
  console.log('=== Section Views Readback Status ===');

  for (const id of sectionIds) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: id });
    const cropActive = vInfo.data?.Parameters?.find(p => p.Name === '裁剪檢視' || p.Name === '裁剪視圖' || p.Name === 'Crop View')?.Value;
    const cropVisible = vInfo.data?.Parameters?.find(p => p.Name === '裁剪區域可見' || p.Name === 'Crop Region Visible')?.Value;
    console.log(`- 視圖 [${id}] "${vInfo.data?.Name}": CropActive=${cropActive}, CropVisible=${cropVisible}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
