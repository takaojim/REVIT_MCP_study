import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewRes = await client.sendCommand('get_active_view', {});
  const viewId = viewRes.data.ElementId;
  console.log(`Cleaning internal dimensions on View: ${viewId} (${viewRes.data.Name})`);

  // 查詢所有 Dimension
  const dimsRes = await client.sendCommand('query_elements', {
    category: 'Dimensions',
    returnFields: ['名稱', '值']
  });

  const dims = dimsRes.data?.Elements || [];
  console.log(`Found ${dims.length} dimensions in project.`);

  // 查詢在剛才批次建立 ID 區間的 Dimension (ID >= 2245090)
  const toDelete = dims.filter(d => d.ElementId >= 2245090);
  console.log(`Deleting ${toDelete.length} recently created internal dimensions...`);

  for (const d of toDelete) {
    try {
      await client.sendCommand('delete_element', { elementId: d.ElementId });
    } catch (e) {
      // ignore
    }
  }

  // 同時清理可能產生的 helper DetailCurves
  const curvesRes = await client.sendCommand('query_elements', {
    category: 'Lines',
    returnFields: ['名稱']
  });
  const curves = curvesRes.data?.Elements || [];
  const curvesToDelete = curves.filter(c => c.ElementId >= 2245090);
  console.log(`Deleting ${curvesToDelete.length} helper lines...`);
  for (const c of curvesToDelete) {
    try {
      await client.sendCommand('delete_element', { elementId: c.ElementId });
    } catch (e) {
      // ignore
    }
  }

  console.log('✅ 內部標註已全部清除完畢。');

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('清除失敗:', err);
  process.exit(1);
});
