import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-elevation-cropboxes';
  await client.connect();

  const elevs = [
    { name: '北', id: 8157 },
    { name: '東', id: 8176 },
    { name: '南', id: 98984 },
    { name: '西', id: 8237 }
  ];

  for (const e of elevs) {
    const shiftRes = await client.sendCommand('shift_view_cropbox', {
      viewId: e.id,
      dx_mm: 0,
      dy_mm: 0
    });
    console.log(`\nView ${e.name} (${e.id}) CropBox:`, JSON.stringify(shiftRes.data?.NewCropBox_mm, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
