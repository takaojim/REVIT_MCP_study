import { RevitSocketClient } from '../MCP-Server/build/socket.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'extract-catalog-final-' + Date.now();
  await client.connect();

  console.log('=== 正在從 Revit 專案提取 3 個標準標註型式完整參數 Schema ===\n');

  const targets = [
    { typeId: 2240793, name: 'TABC-DIM_*/ S 2.5-柱心-上右' },
    { typeId: 2240801, name: 'TABC-DIM_*/ S 2.5-柱心-下右' },
    { typeId: 2251126, name: 'TABC-DIM_dot 牆心' }
  ];

  const catalog = {
    schemaVersion: '1.0.0',
    description: 'Revit 標準標註型式規格庫 (Seed Catalog)，用於跨專案防呆自癒與自動生成',
    updatedAt: new Date().toISOString(),
    dimensionTypes: {}
  };

  for (const t of targets) {
    const info = await client.sendCommand('get_element_info', { elementId: t.typeId });
    if (info.success && info.data) {
      console.log(`✓ 成功提取: "${info.data.Name || t.name}" (ID: ${t.typeId})，共 ${info.data.Parameters?.length || 0} 個參數`);
      catalog.dimensionTypes[t.name] = {
        name: t.name,
        typeId: t.typeId,
        familyName: info.data.Type || '線性尺寸標註型式',
        parameters: info.data.Parameters || []
      };
    } else {
      console.log(`❌ 提取失敗: ${t.name}`, info.error);
    }
  }

  const outPath = path.resolve('./domain/dimension-types-catalog.json');
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`\n🎉 3 個標準標註型式已完整儲存至: ${outPath}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
