# 重新生成精简版 Tailwind（等价于本仓库 assets/css/tailwind.min.css）
# 依赖：tailwindcss 2.2.19 + postcss 8 + autoprefixer 10（临时目录安装即可）
# 用法：pwsh -File tools/build-css.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$work = Join-Path $env:TEMP 'twbuild'
if (-not (Test-Path $work)) { New-Item -ItemType Directory $work | Out-Null }
if (-not (Test-Path (Join-Path $work 'node_modules'))) {
  Push-Location $work
  '{ "name": "twbuild", "private": true }' | Out-File -Encoding ascii package.json
  & npm install -D tailwindcss@2.2.19 postcss@8 autoprefixer@10
  Pop-Location
}
@tailwind base;
@tailwind components;
@tailwind utilities;
 | Out-File -Encoding utf8 (Join-Path $work 'input.css')
@
module.exports = { purge: { enabled: true, content: ['./index.html','./assets/js/**/*.js'], options: { safelist: ['md:grid-cols-4','grid-cols-2'] } }, darkMode: false, theme: { extend: {} }, variants: { extend: {} }, plugins: [] };
@ | Out-File -Encoding utf8 (Join-Path $work 'tailwind.config.js')
Push-Location $root
& $node (Join-Path $work 'node_modules\tailwindcss\lib\cli.js') build (Join-Path $work 'input.css') -o (Join-Path $root 'assets\css\tailwind.min.css') --minify -c (Join-Path $work 'tailwind.config.js')
Pop-Location
Write-Host '已重新生成 assets/css/tailwind.min.css'
