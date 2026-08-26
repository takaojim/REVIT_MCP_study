import { RevitSocketClient } from '../MCP-Server/build/socket.js';

async function main() {
  const client = new RevitSocketClient('localhost', 8964);
  client.clientName = 'test-elevation-silhouette';
  await client.connect();

  console.log('=== Step 1: Query Active View ===');
  const activeViewRes = await client.sendCommand('get_active_view', {});
  console.log('Active View:', JSON.stringify(activeViewRes.data, null, 2));

  const viewId = activeViewRes.data?.ElementId;

  console.log('\n=== Step 2: Compute Elevation Outer Contour (Clipper2 Silhouette) ===');
  const contourRes = await client.sendCommand('get_elevation_outer_contour', {
    viewId: viewId,
    tolerance_mm: 5.0,
    draw_contour: true // 自動在視圖中繪製外輪廓 Detail Lines 供視覺檢驗
  });

  console.log('Silhouette Calculation Result:');
  console.log('  Source Elements Count:', contourRes.data?.sourceElementCount);
  console.log('  Projected Triangles Count:', contourRes.data?.projectedTriangleCount);
  console.log('  Building Width (mm):', contourRes.data?.widthMm);
  console.log('  Building Height (mm):', contourRes.data?.heightMm);
  console.log('  Bounds (mm):', JSON.stringify(contourRes.data?.boundsMm));
  console.log('  Components Count:', contourRes.data?.componentsCount);
  console.log('  Primary Contour Points Count:', contourRes.data?.primaryContour?.length);
  console.log('  Drawn Lines Count:', contourRes.data?.drawnLineCount);

  if (contourRes.data?.primaryContour?.length > 0) {
    console.log('\nPrimary Contour Vertices (first 10):');
    console.log(JSON.stringify(contourRes.data.primaryContour.slice(0, 10), null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
