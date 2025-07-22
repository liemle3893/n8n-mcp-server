@echo off
setlocal enabledelayedexpansion

REM n8n MCP Server DXT Builder Script for Windows
REM Builds the DXT package with proper validation and cleanup

echo [36m🔧 n8n MCP Server DXT Builder[0m
echo ==================================

REM Configuration
set "DXT_NAME=n8n-mcp-server"
set "DXT_SOURCE_DIR=dxt"
set "OUTPUT_FILE=%DXT_NAME%.dxt"

REM Check if we're in the right directory
if not exist "%DXT_SOURCE_DIR%" (
    echo [31m❌ Error: '%DXT_SOURCE_DIR%' directory not found![0m
    echo Please run this script from the project root directory.
    exit /b 1
)

REM Sync build artifacts to DXT first
echo [33m🔄 Syncing build artifacts to DXT...[0m
if exist "sync-to-dxt.bat" (
    call sync-to-dxt.bat
    if errorlevel 1 (
        echo [31m❌ Failed to sync build artifacts[0m
        exit /b 1
    )
) else (
    echo [33m⚠️  sync-to-dxt.bat not found, using existing DXT files[0m
)

REM Check required files
echo [33m📋 Validating DXT structure...[0m

set "FILES_MISSING=0"
if not exist "%DXT_SOURCE_DIR%\manifest.json" (
    echo [31m❌ Missing required file: %DXT_SOURCE_DIR%\manifest.json[0m
    set "FILES_MISSING=1"
)
if not exist "%DXT_SOURCE_DIR%\server\index.js" (
    echo [31m❌ Missing required file: %DXT_SOURCE_DIR%\server\index.js[0m
    set "FILES_MISSING=1"
)
if not exist "%DXT_SOURCE_DIR%\package.json" (
    echo [31m❌ Missing required file: %DXT_SOURCE_DIR%\package.json[0m
    set "FILES_MISSING=1"
)

if %FILES_MISSING%==1 (
    exit /b 1
)

echo [32m✅ All required files present[0m

REM Remove existing DXT file if it exists
if exist "%OUTPUT_FILE%" (
    echo [33m🗑️  Removing existing %OUTPUT_FILE%...[0m
    del "%OUTPUT_FILE%"
)

REM Create DXT package
echo [33m📦 Building DXT package...[0m

REM Change to DXT directory
cd "%DXT_SOURCE_DIR%"

REM Use official DXT packing tool
npx @anthropic-ai/dxt pack . "..\%OUTPUT_FILE%"

REM Return to original directory
cd ..

REM Verify the created DXT
if not exist "%OUTPUT_FILE%" (
    echo [31m❌ Error: Failed to create %OUTPUT_FILE%[0m
    exit /b 1
)

REM Get file size (approximation)
for %%I in ("%OUTPUT_FILE%") do set "FILE_SIZE=%%~zI"
set /a "FILE_SIZE_KB=%FILE_SIZE% / 1024"

echo [32m✅ DXT package created successfully![0m
echo.
echo [36m📁 Output: %OUTPUT_FILE%[0m
echo [36m📏 Size: %FILE_SIZE_KB% KB[0m
echo.

REM Provide installation instructions
echo [32m🚀 Installation Instructions:[0m
echo 1. Drag %OUTPUT_FILE% into Claude Desktop, or
echo 2. Double-click %OUTPUT_FILE% to install
echo.
echo [36m⚙️  Configuration:[0m
echo After installation, configure your n8n settings in:
echo Claude Desktop → Extensions → n8n Workflow Automation Server
echo.

echo [32m🎉 Build complete![0m
echo.
echo [33mNote: If you encounter issues on Windows, ensure you have:[0m
echo - PowerShell available (required for ZIP creation)
echo - Node.js ^>=20.0.0 installed
echo - Claude Desktop latest version
pause