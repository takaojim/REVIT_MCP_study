import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-user-title-' + Date.now();
  await client.connect();

  const viewId = 711441;

  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });

  const noteIds = (notesRes.data?.Elements || []).map(e => e.ElementId || e.Id);
  console.log(`Total notes: ${noteIds.length}`);

  for (const id of noteIds) {
    try {
      const info = await client.sendCommand('get_element_info', { elementId: id });
      const text = info.data?.Parameters?.find(p => p.Name === '文字' || p.Name === 'Text')?.Value || '';
      if (text.includes('擬定') || text.includes('土地使用管制規定') || text.includes('本案設計檢討') || text.includes('法條')) {
        const loc = info.data?.Location || info.data?.Coord || info.data?.Curve || info.data?.Parameters?.find(p => p.Name === '座標' || p.Name === 'Location');
        console.log(`ID: ${id}, Type: ${info.data?.Type || info.data?.TypeName}, Text: "${text}", Location:`, loc, 'All Params:', info.data?.Parameters);
      }
    } catch(e) {}
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
