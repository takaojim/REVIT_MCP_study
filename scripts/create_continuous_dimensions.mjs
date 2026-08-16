import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'antigravity-agent';
  await client.connect();

  const viewId = 695; // 2FL

  // 1. 刪除先前建立的分開獨立標註
  console.log('=== 1. 清理先前的個別獨立尺寸標註 ===');
  const oldDimIds = [
    2110040, 2110043, 2110046, 2110049, 2110052, 2110055, 2110058,
    2110061, 2110064, 2110067, 2110070, 2110073, 2110076, 2110079,
    2110082, 2110085, 2110088, 2110091, 2110094, 2110097, 2110100
  ];
  for (const id of oldDimIds) {
    try {
      await client.sendCommand('delete_element', { elementId: id });
    } catch (e) {}
  }

  // 2. 建立【北側 (上)】：
  // 第一道：X向總長 (一條單一尺寸)
  // 第二道：G-F-E-D-C-B-A 柱間距【同一條連續串接標註線 (String Dimension)】
  console.log('\n=== 2. 建立北側柱線尺寸 ===');
  
  // (1) 北側總長
  const nTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: 35500,
    endX: 47333.25,
    endY: 35500,
    offset: 0
  });
  console.log('北側總長標註:', nTotal.data);

  // (2) 北側柱線連續串接標註 (G, F, E, D, C, B, A 共 7 個軸點，同一線段)
  const northPoints = [
    { x: -1691.74, y: 34000 }, // G
    { x: 58.24, y: 34000 },    // F
    { x: 8208.26, y: 34000 },  // E
    { x: 19608.25, y: 34000 }, // D
    { x: 31008.25, y: 34000 }, // C
    { x: 40383.24, y: 34000 }, // B
    { x: 47333.25, y: 34000 }  // A
  ];
  const nContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: northPoints,
    offset: 0
  });
  console.log('北側連續柱間距標註 (同一線段):', nContinuous.data);

  // 3. 建立【西側 (左)】：
  // 第一道：Y向總長 (一條單一尺寸)
  // 第二道：1-2-3-4-5-6-7 柱間距【同一條連續串接標註線 (String Dimension)】
  console.log('\n=== 3. 建立西側柱線尺寸 ===');

  // (1) 西側總長
  const wTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -6500,
    startY: -19836.27,
    endX: -6500,
    endY: 32163.73,
    offset: 0
  });
  console.log('西側總長標註:', wTotal.data);

  // (2) 西側柱線連續串接標註 (1, 2, 3, 4, 5, 6, 7 共 7 個軸點，同一線段)
  const westPoints = [
    { x: -5000, y: -19836.27 }, // 1
    { x: -5000, y: -11836.27 }, // 2
    { x: -5000, y: -3836.27 },  // 3
    { x: -5000, y: 4163.73 },   // 4
    { x: -5000, y: 11363.73 },  // 5
    { x: -5000, y: 20163.73 },  // 6
    { x: -5000, y: 32163.73 }   // 7
  ];
  const wContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: westPoints,
    offset: 0
  });
  console.log('西側連續柱間距標註 (同一線段):', wContinuous.data);

  // 4. 建立【南側 (下)】：
  // 第一道：南翼X向總長 (Grid G~D)
  // 第二道：G-F-E-D 柱間距【同一條連續串接標註線】
  console.log('\n=== 4. 建立南側柱線尺寸 ===');

  const sTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: -1691.74,
    startY: -23500,
    endX: 19608.25,
    endY: -23500,
    offset: 0
  });
  console.log('南側總長標註:', sTotal.data);

  const southPoints = [
    { x: -1691.74, y: -22000 }, // G
    { x: 58.24, y: -22000 },    // F
    { x: 8208.26, y: -22000 },  // E
    { x: 19608.25, y: -22000 }  // D
  ];
  const sContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: southPoints,
    offset: 0
  });
  console.log('南側連續柱間距標註 (同一線段):', sContinuous.data);

  // 5. 建立【東側 (右)】：
  // 第一道：東翼Y向總長 (Grid 5~7)
  // 第二道：5-6-7 柱間距【同一條連續串接標註線】
  console.log('\n=== 5. 建立東側柱線尺寸 ===');

  const eTotal = await client.sendCommand('create_dimension', {
    viewId: viewId,
    startX: 52000,
    startY: 11363.73,
    endX: 52000,
    endY: 32163.73,
    offset: 0
  });
  console.log('東側總長標註:', eTotal.data);

  const eastPoints = [
    { x: 50500, y: 11363.73 }, // 5
    { x: 50500, y: 20163.73 }, // 6
    { x: 50500, y: 32163.73 }  // 7
  ];
  const eContinuous = await client.sendCommand('create_dimension', {
    viewId: viewId,
    points: eastPoints,
    offset: 0
  });
  console.log('東側連續柱間距標註 (同一線段):', eContinuous.data);

  process.exit(0);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
