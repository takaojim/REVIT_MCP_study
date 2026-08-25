import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'inspect-main-walls-15cm';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 清除剛才測試建立的 2251233 ~ 2251241 尺寸標註
  console.log('--- 清除舊測試尺寸標註 (2251233 ~ 2251241) ---');
  for (let id = 2251233; id <= 2251241; id++) {
    try {
      await client.sendCommand('delete_element', { elementId: id });
    } catch (e) {}
  }

  // 2. 收集 Thickness >= 140mm (15cm 及以上主牆)
  const wallsRes = await client.sendCommand('query_elements', { category: 'Walls', viewId: viewId, maxCount: 1000 });
  const allWalls = wallsRes.data?.Elements || [];

  const mainWalls = [];
  for (const w of allWalls) {
    const info = await client.sendCommand('get_wall_info', { wallId: w.ElementId });
    if (info.success && info.data) {
      if (info.data.Thickness >= 140) {
        mainWalls.push({
          id: w.ElementId,
          name: info.data.Name,
          type: info.data.WallType,
          thickness: info.data.Thickness,
          length: info.data.Length,
          startX: info.data.StartX,
          startY: info.data.StartY,
          endX: info.data.EndX,
          endY: info.data.EndY,
          minX: Math.min(info.data.StartX, info.data.EndX),
          maxX: Math.max(info.data.StartX, info.data.EndX),
          minY: Math.min(info.data.StartY, info.data.EndY),
          maxY: Math.max(info.data.StartY, info.data.EndY),
          isVert: Math.abs(info.data.EndX - info.data.StartX) < 40,
          isHoriz: Math.abs(info.data.EndY - info.data.StartY) < 40,
          centerX: (info.data.StartX + info.data.EndX) / 2,
          centerY: (info.data.StartY + info.data.EndY) / 2
        });
      }
    }
  }

  console.log(`\n=== Thickness >= 140mm 主牆統計 (共 ${mainWalls.length} 道) ===`);
  const vertMain = mainWalls.filter(w => w.isVert);
  const horizMain = mainWalls.filter(w => w.isHoriz);
  console.log(`- 垂直主牆: ${vertMain.length} 道`);
  console.log(`- 水平主牆: ${horizMain.length} 道`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
