import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'delete-helper-lines-' + Date.now();
  await client.connect();

  console.log('========================================================================');
  console.log('=== 清除 12 個 1/50 規劃平面視圖中的所有輔助線（紅線與藍線） ===');
  console.log('========================================================================\n');

  const targetViews = [
    { id: 650463, name: '1FL 規劃 50' },
    { id: 748034, name: '2FL規劃 50' },
    { id: 748079, name: '3FL規劃 50' },
    { id: 748125, name: '4FL規劃 50' },
    { id: 748164, name: 'RFL規劃 50' },
    { id: 748207, name: 'TRFL規劃 50' },
    { id: 806391, name: '1FL 規劃 50-二次' },
    { id: 806446, name: '2FL規劃 50-二次' },
    { id: 806485, name: '3FL規劃 50-二次' },
    { id: 806523, name: '4FL規劃 50-二次' },
    { id: 806551, name: 'RFL規劃 50-二次' },
    { id: 806583, name: '1FL 規劃 50-夾層-二次' }
  ];

  let totalDeleted = 0;
  const summary = [];

  for (const v of targetViews) {
    const linesRes = await client.sendCommand('query_elements', {
      category: 'Lines',
      viewId: v.id,
      maxCount: 200
    });

    const lines = linesRes.data?.Elements || [];
    let delCount = 0;

    for (const l of lines) {
      try {
        const delRes = await client.sendCommand('delete_element', { elementId: l.ElementId });
        if (delRes.success) {
          delCount++;
          totalDeleted++;
        }
      } catch (e) {
        console.error(`視圖 ${v.name} 刪除線段 ${l.ElementId} 失敗:`, e.message);
      }
    }

    console.log(`✓ [${v.name}] 清理了 ${delCount} 條輔助線`);
    summary.push({ viewId: v.id, viewName: v.name, deletedLines: delCount });
  }

  console.log('\n========================================================================');
  console.log(`🎉 12 個視圖的輔助線清理完畢，共刪除 ${totalDeleted} 條輔助線！`);
  console.log('========================================================================');
  console.table(summary);

  await client.disconnect();
}

main().catch(console.error);
