import { RevitSocketClient } from '../../REVIT_MCP_study/MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-cropbox-a301';
  await client.connect();

  console.log('=== Inspecting Viewport on A301 ===');
  const vpDebug = await client.sendCommand('debug_viewport_position', { viewportId: 690581 });
  console.log('Viewport 690581 Debug:', JSON.stringify(vpDebug.data, null, 2));

  console.log('\n=== Inspecting North Elevation (8157) All Parameters ===');
  const northInfo = await client.sendCommand('get_element_info', { elementId: 8157 });
  northInfo.data?.Parameters?.forEach(p => {
    if (p.Value && p.Value !== '無' && p.Value !== '0' && p.Value !== '0.0000 mm') {
      console.log(`  ${p.Name}: ${p.Value}`);
    }
  });

  // Check available tools
  const toolsRes = await client.sendCommand('list_tools', {});
  const tools = toolsRes.data?.tools || [];
  const cropTools = tools.filter(t => t.name.includes('crop') || t.name.includes('sheet') || t.name.includes('viewport') || t.name.includes('scope'));
  console.log('\n=== Relevant Tools in MCP ===');
  cropTools.forEach(t => console.log(`- ${t.name}: ${t.description}`));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
