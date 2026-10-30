<#
.SYNOPSIS
  一键把「家常菜谱」分享到公网（本地静态服务 + Cloudflare 快速隧道）

.DESCRIPTION
  1. 检查本地 8123 端口是否有静态服务，没有就启动 Python 自带的 http.server
  2. 用 cloudflared 建立临时公网隧道，得到一个 https 链接
  3. 打印链接，复制给别人即可访问

.EXAMPLE
  powershell -File tools\share.ps1
  powershell -File tools\share.ps1 -Port 9000
#>
param(
  [int]$Port = 8123
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cf   = Join-Path $PSScriptRoot 'bin\cloudflared.exe'

if (-not (Test-Path $cf)) {
  Write-Host "缺少 cloudflared，请先下载：" -ForegroundColor Yellow
  Write-Host "  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  Write-Host "  放到 tools\bin\cloudflared.exe"
  exit 1
}

# 1) 本地静态服务
$listen = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listen) {
  Write-Host "启动本地静态服务 http://127.0.0.1:$Port ..." -ForegroundColor Cyan
  Start-Process -FilePath 'python' -ArgumentList '-m','http.server',"$Port",'--bind','127.0.0.1' `
    -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Write-Host "复用已在运行的本地服务（端口 $Port）" -ForegroundColor DarkGray
}

try {
  $null = Invoke-WebRequest "http://127.0.0.1:$Port/index.html" -UseBasicParsing -TimeoutSec 8
} catch {
  Write-Host "本地服务没起来，请检查是否安装了 Python。" -ForegroundColor Red
  exit 1
}

# 2) 公网隧道
$log = Join-Path $env:TEMP 'sr-tunnel.log'
Remove-Item $log -ErrorAction SilentlyContinue
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Write-Host "正在建立公网隧道..." -ForegroundColor Cyan
Start-Process -FilePath $cf `
  -ArgumentList 'tunnel','--url',"http://127.0.0.1:$Port",'--no-autoupdate','--protocol','http2' `
  -RedirectStandardError $log -WindowStyle Hidden

$url = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
       Select-Object -First 1
  if ($m) { $url = [regex]::Match($m.Line, 'https://[a-z0-9-]+\.trycloudflare\.com').Value; break }
}

if (-not $url) {
  Write-Host "隧道建立失败，最近日志：" -ForegroundColor Red
  Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 10
  exit 1
}

Write-Host ""
Write-Host "  公网链接：" -NoNewline -ForegroundColor Green
Write-Host " $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "  把这个链接发给别人就能打开。" -ForegroundColor Gray
Write-Host "  · 链接在你本机关机和断网后会失效，重启本脚本会得到新链接" -ForegroundColor DarkGray
Write-Host "  · 页面数据存在每个访客自己的浏览器里，互相看不到" -ForegroundColor DarkGray
Write-Host "  · 停止分享：Get-Process cloudflared | Stop-Process -Force" -ForegroundColor DarkGray
Write-Host ""