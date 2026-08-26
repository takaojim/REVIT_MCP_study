import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-header-' + Date.now();
  await client.connect();

  const activeViewRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', activeViewRes.data);

  const viewId = activeViewRes.data?.ViewId || 711441;

  // Query all TextNotes in the view
  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });

  // Query all Detail Lines
  const linesRes = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  console.log(`Total TextNotes: ${notesRes.data?.Elements?.length || 0}`);
  console.log(`Total Lines: ${linesRes.data?.Elements?.length || 0}`);

  // Let's filter top elements (Y > 3470)
  const topNotes = (notesRes.data?.Elements || []).filter(el => {
    return el.Location?.Y > 3460 || el.Coord?.Y > 3460 || (el.BoundingBox && el.BoundingBox.Max?.Y > 3460);
  });
  console.log('\n--- Top Notes (Y > 3460) ---');
  for (const n of topNotes) {
    console.log(`ID: ${n.ElementId || n.Id}, Text: "${n.Text}", Coord:`, n.Location || n.Coord || n.BoundingBox);
  }

  // Also print all notes in view sorted by Y descending
  const allNotes = (notesRes.data?.Elements || []).map(el => ({
    id: el.ElementId || el.Id,
    text: el.Text,
    typeId: el.GetTypeId || el.TypeId,
    loc: el.Location || el.Coord || el.BoundingBox
  }));

  console.log('\n--- All Notes count:', allNotes.length);
  // Print top 15 notes
  console.log(allNotes.slice(0, 20));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
