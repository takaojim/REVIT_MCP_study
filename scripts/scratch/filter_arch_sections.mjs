import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'filter-arch-sections';
  await client.connect();

  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const views = viewsRes.data?.Elements || [];

  console.log('=== Views with Type == 建築剖面 or Name containing 剖面 ===');
  const archSections = [];

  for (const v of views) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    if (vInfo.data?.Type === '建築剖面' || (v.Name?.includes('剖面') && vInfo.data?.Type)) {
      archSections.push({
        Id: v.ElementId,
        Name: v.Name,
        Type: vInfo.data?.Type,
        Parameters: vInfo.data?.Parameters
      });
      console.log(`- ID: ${v.ElementId} | Name: "${v.Name}" | Type: "${vInfo.data?.Type}"`);
    }
  }

  console.log(`\nFound ${archSections.length} target sections:`);
  console.log(archSections.map(s => `ID: ${s.Id}, Name: ${s.Name}`).join('\n'));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
