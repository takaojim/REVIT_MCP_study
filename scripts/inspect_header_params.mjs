import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-header-details-' + Date.now();
  await client.connect();

  const viewId = 711441;

  // Let's get parameters of all text notes in view 711441
  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });

  const linesRes = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  console.log(`Total TextNotes in view: ${notesRes.data?.Elements?.length || 0}`);
  console.log(`Total Lines in view: ${linesRes.data?.Elements?.length || 0}`);

  // Query details of the newest text notes and lines, or lines with highest/lowest coordinates
  const noteIds = (notesRes.data?.Elements || []).map(e => e.ElementId || e.Id);
  const lineIds = (linesRes.data?.Elements || []).map(e => e.ElementId || e.Id);

  // Let's sample the last 20 elements
  const sampleNoteIds = noteIds.slice(-25);
  for (const id of sampleNoteIds) {
    const p = await client.sendCommand('get_element_parameters', { elementId: id });
    const textParam = (p.data?.Parameters || []).find(x => x.Name === '文字' || x.Name === 'Text');
    console.log(`Note ${id}: Text="${textParam?.Value}"`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
