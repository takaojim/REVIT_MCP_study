import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-view-notes-' + Date.now();
  await client.connect();

  const notesRes = await client.sendCommand('query_elements', {
    viewId: 711441,
    category: 'OST_TextNotes'
  });

  const notes = notesRes.data?.Elements || [];
  console.log(`Found ${notes.length} TextNotes in view 711441`);

  for (const n of notes) {
    const info = await client.sendCommand('get_element_info', { elementId: n.ElementId || n.Id });
    const text = info.data?.Parameters?.find(p => p.Name === '文字' || p.Name === 'Text')?.Value || '';
    if (text.includes('電信用地') || text.includes('退縮建築') || text.includes('第一之二種住宅區及') || text.includes('（八）')) {
      console.log(`\nNote ID ${n.ElementId || n.Id}:`);
      console.log(`Text preview: ${text.substring(0, 80)}...`);
      console.log(`Coordinates / Level:`, info.data);
    }
  }

  const linesRes = await client.sendCommand('query_elements', {
    viewId: 711441,
    category: 'OST_Lines'
  });
  console.log(`Found ${linesRes.data?.Count} detail lines`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
