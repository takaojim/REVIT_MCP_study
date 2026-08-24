import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-sections';
  await client.connect();

  console.log('=== Querying All Section Views ===');
  const viewsRes = await client.sendCommand('query_elements', { category: 'Views', maxCount: 1000 });
  const views = viewsRes.data?.Elements || [];

  const sectionViews = [];
  for (const v of views) {
    const vInfo = await client.sendCommand('get_element_info', { elementId: v.ElementId });
    const viewType = vInfo.data?.Parameters?.find(p => p.Name === '視圖類型' || p.Name === 'View Type' || p.Name === '類型')?.Value;
    const subType = vInfo.data?.Parameters?.find(p => p.Name === '視圖子分類' || p.Name === '子品類' || p.Name === '視圖分類' || p.Name === '階段')?.Value;
    const isSection = v.Name?.includes('剖面') || vInfo.data?.Type?.includes('剖面') || viewType?.includes('剖面') || viewType === 'Section';
    if (isSection) {
      sectionViews.push({
        Id: v.ElementId,
        Name: v.Name,
        Type: vInfo.data?.Type,
        ViewType: viewType,
        SubType: subType
      });
      console.log(`Section View ID: ${v.ElementId} | Name: "${v.Name}" | Type: "${vInfo.data?.Type}" | ViewType: "${viewType}" | Sub: "${subType}"`);
    }
  }

  console.log(`\nTotal Section views found: ${sectionViews.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
