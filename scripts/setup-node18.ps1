# Downloads a portable Node.js v18.x locally into .tools/node18 and wires nothing globally.
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-node18.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot '.tools'
$tmpDir = Join-Path $toolsDir 'tmp'
$destDir = Join-Path $toolsDir 'node18'

# Pick a Node 18 version compatible with Prisma (>= 18.18.0)
$nodeVersion = '18.18.2'

# Determine architecture
$arch = if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64') { 'arm64' } else { 'x64' }

$zipName = "node-v$nodeVersion-win-$arch.zip"
$zipUrl = "https://nodejs.org/dist/v$nodeVersion/$zipName"
$zipPath = Join-Path $toolsDir $zipName

# Ensure folders
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

Write-Host "Downloading Node.js v$nodeVersion ($arch) ..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

Write-Host 'Extracting...' -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force

$extractedFolder = Join-Path $tmpDir "node-v$nodeVersion-win-$arch"
if (-not (Test-Path $extractedFolder)) {
  throw "Expected extracted folder not found: $extractedFolder"
}

if (Test-Path $destDir) {
  Write-Host "Removing existing $destDir ..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force $destDir
}

Write-Host "Placing Node at $destDir" -ForegroundColor Cyan
Move-Item -Path $extractedFolder -Destination $destDir

# Cleanup
Remove-Item -Force $zipPath
Remove-Item -Recurse -Force $tmpDir

# Show result
$nodeExe = Join-Path $destDir 'node.exe'
if (-not (Test-Path $nodeExe)) {
  throw "node.exe not found at $nodeExe"
}

$version = & $nodeExe -v
Write-Host "Installed local Node: $version at $destDir" -ForegroundColor Green
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor White
Write-Host '  1) Open a NEW VS Code terminal so it picks up .vscode PATH override' -ForegroundColor White
Write-Host '  2) Run: npm install (this will now use the local Node 18)' -ForegroundColor White
