import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-elevation-dim-contents';
  await client.connect();

  console.log('=== Checking Dimensions in 4 Elevation Views ===');

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西向立面(正立面)', id: 8237 }
  ];

  // Check which dimensions belong to which view
  const dimIds = [
    690525, 690526, 690537, 690538, 690564, 690565, 690566, 690567, 
    690568, 690569, 690570, 690571, 690572, 690573, 690574
  ];

  for (const dId of dimIds) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: dId });
    const val = dInfo.data?.Parameters?.find(p => p.Name === '值' || p.Name === '長度' || p.Name === '總長度')?.Value;
    const typeName = dInfo.data?.Type;
    console.log(`Dim ${dId}: Type="${typeName}", Value=${val}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
