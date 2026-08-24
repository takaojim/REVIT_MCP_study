import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-view-dims';
  await client.connect();

  console.log('=== Checking Dimensions in Each View ===');

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  // We can query all elements in each view:
  // In Revit MCP, query_elements with viewId
  for (const e of elevs) {
    console.log(`\n========================================`);
    console.log(`>>> View: ${e.name} (ID: ${e.id}) <<<`);
    console.log(`========================================`);

    // Let's check which dimensions are in this view
    // By checking which dimensions were created in the project
    // Let's check dimIds around 690500 - 690600
    for (let id = 690520; id <= 690580; id++) {
      try {
        const info = await client.sendCommand('get_element_info', { elementId: id });
        if (info.data?.Category === '尺寸') {
          console.log(`  Dim ${id}: Type="${info.data?.Type}" | Name="${info.data?.Name}"`);
        }
      } catch (err) {}
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
