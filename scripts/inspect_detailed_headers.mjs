import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-view-' + Date.now();
  await client.connect();

  const viewId = 711441;

  // Let's get all text notes by query_elements
  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });

  const elements = notesRes.data?.Elements || [];
  console.log(`Found ${elements.length} text elements in view ${viewId}`);

  // Let's print each element's info
  for (const el of elements) {
    const info = await client.sendCommand('get_element_info', { elementId: el.ElementId || el.Id });
    const d = info.data;
    if (d) {
      const textParam = d.Parameters?.find(p => p.Name === '文字' || p.Name === 'Text')?.Value || '';
      if (textParam.includes('擬定') || textParam.includes('土地使用管制規定') || textParam.includes('本案設計檢討') || textParam.includes('法條')) {
        console.log(`\nNote ID ${d.ElementId}:`);
        console.log(`  Text: "${textParam}"`);
        console.log(`  Type: ${d.Type || d.TypeName}`);
        console.log(`  Coord/Location:`, d.Location, d.Coord, d.Curve);
        for (const p of d.Parameters || []) {
          if (p.Name.includes('X') || p.Name.includes('Y') || p.Name.includes('位置') || p.Name.includes('對齊')) {
            console.log(`    ${p.Name}: ${p.Value}`);
          }
        }
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
