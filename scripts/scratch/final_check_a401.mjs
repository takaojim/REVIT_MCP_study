import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'final-check-a401';
  await client.connect();

  const details = await client.sendCommand('get_sheet_viewport_details', { sheetId: 650359 });
  console.log('Sheet A401 Final Viewports:');
  for (const vp of details.data?.Viewports || []) {
    console.log(`- [${vp.ViewName}] (VP ID: ${vp.ViewportId})`);
    console.log(`  Center: (${vp.Center.X.toFixed(2)}, ${vp.Center.Y.toFixed(2)}) mm`);
    console.log(`  Width: ${vp.WidthMm.toFixed(2)} mm, Height: ${vp.HeightMm.toFixed(2)} mm`);
    console.log(`  MinX: ${vp.Outline.MinX.toFixed(2)}, MaxX: ${vp.Outline.MaxX.toFixed(2)} mm\n`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
