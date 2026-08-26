import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'find-type-name-4mm-' + Date.now();
  await client.connect();

  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes'
  });

  const elements = notesRes.data?.Elements || [];
  console.log(`Searching across ${elements.length} text notes in project...`);

  const foundTypes = new Map();

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    try {
      const info = await client.sendCommand('get_element_info', { elementId: el.ElementId || el.Id });
      const typeName = info.data?.TypeName || info.data?.Type || info.data?.Name;
      const typeIdParam = info.data?.Parameters?.find(p => p.Name === '類型 ID' || p.Name === 'Type ID' || p.Name === '族群與類型')?.Value;
      if (typeName && !foundTypes.has(typeName)) {
        foundTypes.set(typeName, { elId: el.ElementId || el.Id, typeName, typeIdParam, allParams: info.data?.Parameters });
        console.log(`Discovered TypeName: "${typeName}" (ElementId: ${el.ElementId || el.Id})`);
      }
      if (typeName && (typeName.includes('4 mm') || typeName.includes('4mm'))) {
        console.log(`\n🎉 Found 4mm TextNote:`, info.data);
      }
    } catch(e) {}
  }

  console.log('\n--- All Discovered Text Types ---');
  for (const [name, data] of foundTypes.entries()) {
    console.log(`TypeName: "${name}", Param:`, data.typeIdParam);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
