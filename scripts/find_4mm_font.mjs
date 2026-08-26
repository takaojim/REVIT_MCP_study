import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-4mm-font-' + Date.now();
  await client.connect();

  const typesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes'
  });

  const elements = typesRes.data?.Elements || [];
  console.log(`Querying ${elements.length} text notes...`);

  let font4mmTypeId = null;

  for (const el of elements) {
    const info = await client.sendCommand('get_element_info', { elementId: el.ElementId || el.Id });
    const typeName = info.data?.TypeName || info.data?.Type || info.data?.Name;
    if (typeName && (typeName.includes('4 mm') || typeName.includes('4mm'))) {
      console.log('Found 4mm TextNote:', info.data);
      // Let's get its type ID
      const typeIdParam = info.data?.Parameters?.find(p => p.Name === '類型' || p.Name === 'Type')?.Value;
      console.log('Type Param:', typeIdParam);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
