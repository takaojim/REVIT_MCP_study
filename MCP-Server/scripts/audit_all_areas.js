import { RevitSocketClient } from '../build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  await client.connect();

  const areasRes = await client.sendCommand('query_elements', { category: 'OST_Areas' });
  const elements = areasRes.data.Elements;

  const results = [];
  for (const el of elements) {
    const infoRes = await client.sendCommand('get_element_info', { elementId: el.ElementId });
    if (infoRes.success && infoRes.data) {
      const pMap = {};
      (infoRes.data.Parameters || []).forEach(p => {
        if (!pMap[p.Name]) pMap[p.Name] = p.Value;
      });
      results.push({
        id: el.ElementId,
        level: infoRes.data.Level || pMap['樓層'] || 'Unknown',
        name: pMap['名稱'] || el.Name,
        number: pMap['編號'] || '',
        area: parseFloat(pMap['面積'] || '0'),
        usage: pMap['用途'] || '',
        planId: pMap['面積計畫 ID'] || '',
        includeVolume: pMap['C計入容積'] || '',
        includeArea: pMap['C計入面積'] || ''
      });
    }
  }

  // Group by level
  const byLevel = {};
  results.forEach(r => {
    if (!byLevel[r.level]) byLevel[r.level] = [];
    byLevel[r.level].push(r);
  });

  const levelOrder = ['GL', '1FL', '2FL', '3FL', '4FL', 'RFL', 'TRFL'];
  const allLevels = Array.from(new Set([...levelOrder, ...Object.keys(byLevel)]));

  for (const lvl of allLevels) {
    const items = byLevel[lvl];
    if (!items || items.length === 0) continue;
    console.log(`\n========================================`);
    console.log(`Level: ${lvl} (Count: ${items.length})`);
    let sum = 0;
    items.forEach(it => {
      sum += it.area;
      console.log(`  ID: ${String(it.id).padEnd(8)} | No: ${it.number.padEnd(4)} | Name: ${it.name.padEnd(16)} | Area: ${it.area.toFixed(2).padStart(8)} m² | PlanId: ${it.planId}`);
    });
    console.log(`  >>> Floor Total Area: ${sum.toFixed(2)} m²`);
  }

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
