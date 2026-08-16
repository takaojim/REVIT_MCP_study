import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();
  console.log('Connected to Revit successfully.');

  // 1. Get active view
  try {
    const activeView = await client.sendCommand('get_active_view', {});
    console.log('Active View:', JSON.stringify(activeView, null, 2));
  } catch (e) {
    console.error('Error getting active view:', e.message);
  }

  // 2. Query levels
  try {
    const levels = await client.sendCommand('query_elements', { category: 'Levels' });
    console.log('Levels:', JSON.stringify(levels, null, 2));
  } catch (e) {
    console.error('Error querying levels:', e.message);
  }

  // 3. Query views (FloorPlans)
  try {
    const views = await client.sendCommand('query_elements', { category: 'Views' });
    console.log('Views count:', views?.data?.elements?.length || 0);
    const planViews = (views?.data?.elements || []).filter((v) => 
      (v.name && (v.name.includes('3') || v.name.toLowerCase().includes('plan') || v.name.includes('FL') || v.name.includes('F')))
    );
    console.log('Filtered Plan Views:', planViews);
  } catch (e) {
    console.error('Error querying views:', e.message);
  }

  // 4. Query rooms
  try {
    const rooms = await client.sendCommand('query_elements', { category: 'Rooms' });
    console.log('Rooms count:', rooms?.data?.elements?.length || 0);
    if (rooms?.data?.elements?.length > 0) {
      console.log('Sample rooms:', rooms.data.elements.slice(0, 5));
    }
  } catch (e) {
    console.error('Error querying rooms:', e.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
