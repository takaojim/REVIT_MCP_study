import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-scope-boxes';
  await client.connect();

  console.log('=== Checking existing ScopeBoxes ===');
  try {
    // Intentionally pass a dummy scopeBoxName to see the available list in exception or check
    const res = await client.sendCommand('set_scope_box_for_views', {
      scopeBoxName: '__CHECK_AVAILABLE__',
      viewIds: [8157]
    });
    console.log('Result:', res);
  } catch (err) {
    console.log('ScopeBox list from server error message:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
