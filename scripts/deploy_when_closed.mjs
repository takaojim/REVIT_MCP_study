import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== 等待 Revit 關閉以完成 DLL 覆蓋部署 ===');

function isRevitRunning() {
  try {
    const stdout = execSync('powershell -Command "Get-Process -Name Revit -ErrorAction SilentlyContinue | Measure-Object | Select -ExpandProperty Count"').toString().trim();
    return parseInt(stdout, 10) > 0;
  } catch (e) {
    return false;
  }
}

// 檢查是否關閉
if (isRevitRunning()) {
  console.log('Revit 仍在運行中，請先關閉 Revit 視窗...');
} else {
  console.log('Revit 已關閉，開始執行 install-addon.ps1...');
  try {
    const res = execSync('powershell -ExecutionPolicy Bypass -File scripts/install-addon.ps1 -Version 2026 -NonInteractive').toString();
    console.log(res);
    console.log('\n✅ 部署成功！現在可以重新開啟 Revit 了！');
  } catch (err) {
    console.error('部署失敗:', err.message);
  }
}
