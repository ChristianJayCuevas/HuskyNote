# ========================================================
#   HuskyNote - Automated Windows Desktop & Installer Builder
# ========================================================
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  HuskyNote Windows Build & Package Pipeline" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT
$Version = (Get-Content "package.json" -Raw | ConvertFrom-Json).version
Write-Host "Version $Version (from package.json)"

# 1. Build Web App (Vite)
Write-Host "`n[1/5] Building Web Production Assets (npm run build)..." -ForegroundColor Yellow
if (-not (Test-Path "dist\index.html")) {
    npm run build
} else {
    Write-Host "Existing dist found, rebuilding for latest changes..."
    npm run build
}

# 2. Build HuskyNote Desktop App
Write-Host "`n[2/5] Publishing HuskyNote Desktop Executable..." -ForegroundColor Yellow
$DesktopProj = "desktop\windows\HuskyNote.csproj"
$DesktopPublishDir = "desktop\windows\bin\Release\net9.0-windows\win-x64\publish"
# Self-contained win-x64 (HuskyNote.csproj); the version comes from desktop\Directory.Build.props
dotnet publish $DesktopProj -c Release -o $DesktopPublishDir
if ($LASTEXITCODE -ne 0) { throw "Publishing the desktop app failed" }
# A self-contained app carries the .NET host; without it people would need the .NET 9 Desktop Runtime
if (-not (Test-Path "$DesktopPublishDir\hostfxr.dll")) { throw "The desktop app was not published self-contained" }

# 3. Assemble Bundle Directory
Write-Host "`n[3/5] Assembling Application Bundle..." -ForegroundColor Yellow
$BundleDir = "desktop\bundle"
if (Test-Path $BundleDir) { Remove-Item -Recurse -Force $BundleDir }
New-Item -ItemType Directory -Force -Path "$BundleDir\web" | Out-Null

# Copy desktop binaries
Copy-Item "$DesktopPublishDir\*" -Destination $BundleDir -Recurse -Force
# Copy compiled web assets to web/ (excluding downloads to prevent recursive bundling)
Get-ChildItem "dist" | Where-Object { $_.Name -ne "downloads" } | Copy-Item -Destination "$BundleDir\web" -Recurse -Force
# Copy icon
Copy-Item "public\favicon.ico" -Destination "$BundleDir\favicon.ico" -Force

# Create portable zip & installer bundle.zip
$BundleZip = "$ROOT\desktop\installer\bundle.zip"
if (Test-Path $BundleZip) { Remove-Item -Force $BundleZip }
Write-Host "Compressing bundle into $BundleZip..."

Add-Type -AssemblyName System.IO.Compression.FileSystem
Start-Sleep -Milliseconds 500
[System.IO.Compression.ZipFile]::CreateFromDirectory("$ROOT\$BundleDir", $BundleZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# Also create portable zip in public/downloads
$DownloadsDir = "$ROOT\public\downloads"
New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
$PortableZip = "$DownloadsDir\HuskyNote-Windows-Portable.zip"
if (Test-Path $PortableZip) { Remove-Item -Force $PortableZip }
Copy-Item $BundleZip -Destination $PortableZip -Force
Write-Host "Created portable archive: $PortableZip" -ForegroundColor Green

# 4. Build HuskyNote Installer (.EXE)
Write-Host "`n[4/5] Compiling HuskyNote Installer (.EXE)..." -ForegroundColor Yellow
$InstallerProj = "desktop\installer\HuskyNoteSetup.csproj"
$InstallerPublishDir = "desktop\installer\bin\Release\publish"
# A .NET Framework 4.8 executable (built into Windows) with the app bundle embedded
dotnet publish $InstallerProj -c Release -o $InstallerPublishDir
if ($LASTEXITCODE -ne 0) { throw "Publishing the installer failed" }
$InstallerFramework = (dotnet msbuild $InstallerProj -getProperty:TargetFramework).Trim()
if ($InstallerFramework -ne "net48") { throw "The installer must target .NET Framework 4.8 (found $InstallerFramework)" }

# Copy compiled installer to public/downloads/HuskyNote-Setup-x64.exe
$BuiltInstaller = "$InstallerPublishDir\HuskyNote-Setup-x64.exe"
if (Test-Path $BuiltInstaller) {
    Copy-Item $BuiltInstaller -Destination "$DownloadsDir\HuskyNote-Setup-x64.exe" -Force
    Write-Host "Successfully generated Installer: $DownloadsDir\HuskyNote-Setup-x64.exe" -ForegroundColor Green
} else {
    throw "Installer binary was not found at $BuiltInstaller"
}

# Copy setup-windows.bat
Copy-Item "scripts\setup-windows.bat" -Destination "$DownloadsDir\HuskyNote-Setup.bat" -Force

# Clean temporary bundle folder
Remove-Item -Recurse -Force $BundleDir -ErrorAction SilentlyContinue

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Windows Build Succeeded!" -ForegroundColor Green
Write-Host "  Version:   $Version (app self-contained; installer runs on the .NET Framework 4.8 built into Windows)" -ForegroundColor White
Write-Host ("  Installer: $DownloadsDir\HuskyNote-Setup-x64.exe ({0:N0} MB)" -f ((Get-Item "$DownloadsDir\HuskyNote-Setup-x64.exe").Length / 1MB)) -ForegroundColor White
Write-Host ("  Portable:  $DownloadsDir\HuskyNote-Windows-Portable.zip ({0:N0} MB)" -f ((Get-Item $PortableZip).Length / 1MB)) -ForegroundColor White
Write-Host "========================================================`n" -ForegroundColor Cyan
