import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  console.log('[1/3] Checking active view...');
  const viewRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', viewRes.data);

  console.log('[2/3] Executing dry-run for 2FL renumbering from F201...');
  const dryRunRes = await client.sendCommand('renumber_rooms_by_level', {
    level: '2FL',
    startNumber: 'F201',
    dryRun: true,
    yToleranceMm: 3000,
    includeUnnamed: true,
  });

  console.log('DryRun Result:', JSON.stringify(dryRunRes.data, null, 2));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
