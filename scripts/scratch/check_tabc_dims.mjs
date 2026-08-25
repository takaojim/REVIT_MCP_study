import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'check-tabc-dims';
  await client.connect();

  console.log('=== Checking TABC Dimensions ===');

  const dimIds = [690525, 690526, 690564, 690565, 690566, 690567, 690568, 690569, 690570, 690571, 690572, 690573, 690574];

  for (const dId of dimIds) {
    const dInfo = await client.sendCommand('get_element_info', { elementId: dId });
    const viewParam = dInfo.data?.Parameters?.find(p => p.Name === '檢視' || p.Name === '視圖' || p.Name === 'View')?.Value;
    const typeIdParam = dInfo.data?.Parameters?.find(p => p.Name === '類型 ID' || p.Name === 'Type Id')?.Value;
    const valParam = dInfo.data?.Parameters?.find(p => p.Name === '值' || p.Name === '長度' || p.Name === 'Value')?.Value;
    console.log(`Dim ${dId}: Type="${dInfo.data?.Type}" (TypeId: ${typeIdParam}) | View="${viewParam}" | Value=${valParam}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
