import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-element-info-' + Date.now();
  await client.connect();

  const viewId = 711441;

  const notesRes = await client.sendCommand('query_elements', {
    category: 'OST_TextNotes',
    viewId: viewId
  });

  const linesRes = await client.sendCommand('query_elements', {
    category: 'OST_Lines',
    viewId: viewId
  });

  const noteIds = (notesRes.data?.Elements || []).map(e => e.ElementId || e.Id);
  console.log(`Total notes: ${noteIds.length}`);

  // Query info for all notes
  const notesInfo = [];
  for (const id of noteIds) {
    try {
      const info = await client.sendCommand('get_element_info', { elementId: id });
      if (info.data) {
        notesInfo.push(info.data);
      }
    } catch(e) {}
  }

  // Filter top notes (Y > 3470)
  const topNotes = notesInfo.filter(n => {
    const y = n.Location?.Y || n.Coord?.Y || n.BoundingBox?.Max?.Y || n.Origin?.Y || 0;
    return y > 3460 || (n.Text && (n.Text.includes('擬定') || n.Text.includes('法條') || n.Text.includes('土地使用管制規定') || n.Text.includes('本案設計檢討')));
  });

  console.log('\n--- Header & Top Text Notes ---');
  for (const n of topNotes) {
    console.log(`ID: ${n.ElementId || n.Id}, Text: "${n.Text?.replace(/\n/g, '\\n')}", Location:`, n.Location || n.Coord || n.Origin || n.BoundingBox, `Type: ${n.TypeName || n.TypeId}`);
  }

  // Also let's inspect all lines near the top (Y > 3470)
  const lineIds = (linesRes.data?.Elements || []).map(e => e.ElementId || e.Id);
  const topLines = [];
  for (const id of lineIds) {
    try {
      const info = await client.sendCommand('get_element_info', { elementId: id });
      if (info.data) {
        topLines.push(info.data);
      }
    } catch(e) {}
  }

  console.log('\n--- Header Lines near top ---');
  for (const l of topLines.slice(0, 20)) {
    console.log(`Line ${l.ElementId || l.Id}:`, l.Geometry || l.Curve || l.Location || l.BoundingBox);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
