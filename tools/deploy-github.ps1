<#
.SYNOPSIS
  把本项目发布到 GitHub Pages（只用 GitHub REST API，不需要本地安装 git）

.DESCRIPTION
  1. 用 token 换出账号信息
  2. 仓库不存在就创建（public）
  3. 用 Git Data API 一次性提交所有文件（blobs → tree → commit → ref）
  4. 开启 GitHub Pages，输出访问地址

.EXAMPLE
  $env:GH_TOKEN = "ghp_xxx"
  powershell -File tools\deploy-github.ps1 -Repo smart-recipe
#>
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Repo = 'smart-recipe',
  [string]$Description = '家常菜谱 · 智能厨房 —— 纯静态离线菜谱与食材管理',
  [switch]$Private
)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$api    = 'https://api.github.com'
$hdr    = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'smart-recipe-deploy'
}

function Call($method, $path, $body) {
  $args = @{ Uri = "$api$path"; Method = $method; Headers = $hdr; TimeoutSec = 60 }
  if ($body) { $args.Body = ($body | ConvertTo-Json -Depth 12 -Compress); $args.ContentType = 'application/json; charset=utf-8' }
  return Invoke-RestMethod @args
}

# ---------- 1. 身份 ----------
$me = Call GET '/user'
$owner = $me.login
Write-Host "账号：$owner" -ForegroundColor Cyan

# ---------- 2. 仓库 ----------
$exists = $true
try { $null = Call GET "/repos/$owner/$Repo" } catch { $exists = $false }
if ($exists) {
  Write-Host "仓库已存在，将更新内容：$owner/$Repo" -ForegroundColor Yellow
} else {
  $null = Call POST '/user/repos' @{
    name = $Repo; description = $Description; private = [bool]$Private; auto_init = $true; has_issues = $false
  }
  Write-Host "已创建仓库：$owner/$Repo" -ForegroundColor Green
  Start-Sleep -Seconds 3
}

# 空仓库没有任何 commit 时，Git Data API 会返回 409，需要先塞一个初始文件
$hasRef = $true
try { $null = Call GET "/repos/$owner/$Repo/git/ref/heads/main" } catch { $hasRef = $false }
if (-not $hasRef) {
  $body = @{ message = 'init'; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('# init')); branch = 'main' }
  $null = Call PUT "/repos/$owner/$Repo/contents/README.md" $body
  Write-Host "已创建初始提交" -ForegroundColor Yellow
  Start-Sleep -Seconds 2
}

# ---------- 3. 收集文件 ----------
# 排除：隧道二进制（52MB）、依赖目录、git 元数据、缓存
$excludePatterns = @(
  'tools\bin\*',
  'tools\node_modules\*',
  'node_modules\*',
  '.git\*',
  '**\__pycache__\*'
)
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length).TrimStart('\')
  $keep = $true
  foreach ($pat in $excludePatterns) { if ($rel -like $pat) { $keep = $false; break } }
  $keep
}
Write-Host ("待上传 {0} 个文件，共 {1:N1} MB" -f $files.Count, (($files | Measure-Object Length -Sum).Sum / 1MB)) -ForegroundColor Cyan

$tree = @()
$i = 0
foreach ($f in $files) {
  $i++
  $rel = $f.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
  $blob = Call POST "/repos/$owner/$Repo/git/blobs" @{ content = $b64; encoding = 'base64' }
  $tree += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $blob.sha }
  if ($i % 10 -eq 0) { Write-Host ("  已上传 {0}/{1}" -f $i, $files.Count) -ForegroundColor DarkGray }
}

# ---------- 4. tree / commit / ref ----------
$newTree = Call POST "/repos/$owner/$Repo/git/trees" @{ tree = $tree }
$parents = @()
try { $cur = Call GET "/repos/$owner/$Repo/git/ref/heads/main"; $parents = @($cur.object.sha) } catch {}
$commit  = Call POST "/repos/$owner/$Repo/git/commits" @{
  message = 'deploy: 家常菜谱 · 智能厨房'; tree = $newTree.sha; parents = $parents
}

$refOk = $true
try { $null = Call GET "/repos/$owner/$Repo/git/ref/heads/main" } catch { $refOk = $false }
if ($refOk) {
  $null = Call PATCH "/repos/$owner/$Repo/git/refs/heads/main" @{ sha = $commit.sha; force = $true }
} else {
  $null = Call POST "/repos/$owner/$Repo/git/refs" @{ ref = 'refs/heads/main'; sha = $commit.sha }
}
# 默认分支指向 main
try { $null = Call PATCH "/repos/$owner/$Repo" @{ default_branch = 'main' } } catch {}

# ---------- 5. Pages ----------
try {
  $null = Call POST "/repos/$owner/$Repo/pages" @{ source = @{ branch = 'main'; path = '/' } }
  Write-Host "已开启 GitHub Pages" -ForegroundColor Green
} catch {
  Write-Host "Pages 可能已开启或需手动确认：$($_.Exception.Message)" -ForegroundColor Yellow
}

$url = "https://$($owner.ToLower()).github.io/$Repo/"
Write-Host ""
Write-Host "  部署完成，地址：" -NoNewline -ForegroundColor Green
Write-Host " $url" -ForegroundColor Yellow
Write-Host "  （首次生效约需 1-2 分钟，之后每次更新内容刷新即可）" -ForegroundColor DarkGray