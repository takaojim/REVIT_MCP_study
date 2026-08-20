import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const roomsRes = await client.sendCommand('query_elements', {
    category: 'Rooms',
    maxCount: 5000,
    returnFields: ['編號', '名稱', '樓層']
  });

  const elements = roomsRes.data.Elements || [];
  console.log('Total room elements in project:', elements.length);

  const existingNumbers = new Set(elements.map(e => e['編號']).filter(Boolean));
  console.log('Total unique existing room numbers in project:', existingNumbers.size);

  const f200Numbers = [...existingNumbers].filter(n => /^F2\d+$/i.test(n));
  console.log('Existing F2xx room numbers in project:', f200Numbers);

  const fNumbers = [...existingNumbers].filter(n => /^F\d+$/i.test(n));
  console.log('Sample F numbers in project:', fNumbers.slice(0, 30));

  client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
