import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-dim-and-elevations';
  await client.connect();

  console.log('=== 檢查剛剛建立的標註與立面圖高程資訊 ===\n');

  const dimInfo = await client.sendCommand('get_element_info', { elementId: 2246283 });
  console.log('剛剛建立的標註資訊:', JSON.stringify(dimInfo.data, null, 2));

  // 刪除剛才測試的標註
  await client.sendCommand('delete_element', { elementId: 2246283 });
  console.log('已清理測試標註 2246283\n');

  // 檢查所有 10 個 Levels 的高程
  const levelsRes = await client.sendCommand('query_elements', { category: 'Levels' });
  const levels = levelsRes.data?.Elements || [];
  console.log(`=== 所有標高 (Levels) 高程 ===`);
  const levelDetails = [];
  for (const l of levels) {
    const lInfo = await client.sendCommand('get_element_info', { elementId: l.ElementId });
    const elev = lInfo.data?.Parameters?.find(p => p.Name === '高程' || p.Name === 'Elevation')?.Value;
    levelDetails.push({ id: l.ElementId, name: l.Name, elevation: elev });
  }
  console.log(levelDetails);

  await client.disconnect();
}

main().catch(console.error);
