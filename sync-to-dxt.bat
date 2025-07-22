@echo off
setlocal enabledelayedexpansion

REM Sync script to update DXT folder from build artifacts
REM This ensures DXT contains the latest compiled version

echo [36m🔄 Syncing build artifacts to DXT folder...[0m

REM Check if build directory exists
if not exist "build" (
    echo [31m❌ Build directory not found. Run 'npm run build' first.[0m
    exit /b 1
)

REM Check if build/index.js exists
if not exist "build\index.js" (
    echo [31m❌ build\index.js not found. Run 'npm run build' first.[0m
    exit /b 1
)

REM Create dxt\server directory if it doesn't exist
if not exist "dxt" mkdir "dxt"
if not exist "dxt\server" mkdir "dxt\server"

REM Copy compiled server
echo [33m📦 Copying build\index.js → dxt\server\index.js[0m
copy "build\index.js" "dxt\server\index.js" > nul
if errorlevel 1 (
    echo [31m❌ Failed to copy build\index.js[0m
    exit /b 1
)

REM Copy and update manifest.json for DXT format
echo [33m📋 Updating dxt\manifest.json from root manifest.json[0m

REM Check if we have a JSON processing tool (jq via Git Bash, or PowerShell)
where jq > nul 2>&1
if %errorlevel%==0 (
    echo [36m📝 Using jq to convert manifest to DXT format[0m
    jq "{ dxt_version: \"0.1\", name, display_name: .name, version, description, long_description: (.description + \"\n\nFeatures:\n- Complete workflow lifecycle management\n- Execution monitoring and control\n- Webhook-based workflow triggers\n- Health monitoring and diagnostics\n- Secure credential handling\n- Resource browsing capabilities\n\nRequires n8n instance with API access enabled.\"), author: { name: \"liemle3893\", email: \"liemle3893@gmail.com\", url: \"https://github.com/liemle3893\" }, license, repository, homepage, documentation: .homepage, support: .bugs.url, server: { type: \"node\", entry_point: \"server/index.js\", mcp_config: { command: \"node\", args: [\"${__dirname}/server/index.js\"], env: { N8N_API_URL: \"${user_config.n8n_api_url}\", N8N_API_KEY: \"${user_config.n8n_api_key}\", N8N_WEBHOOK_USERNAME: \"${user_config.n8n_webhook_username}\", N8N_WEBHOOK_PASSWORD: \"${user_config.n8n_webhook_password}\", DEBUG: \"${user_config.enable_debug}\", REQUEST_TIMEOUT: \"${user_config.timeout}\", MAX_RESULTS: \"${user_config.max_results}\" } } }, tools, user_config: { n8n_api_key: { type: \"string\", title: \"n8n API Key\", description: \"API key for authenticating with your n8n instance\", required: true, sensitive: true }, n8n_api_url: { type: \"string\", title: \"n8n API URL\", description: \"Full URL of the n8n API, including /api/v1 (e.g., https://your-n8n.app.n8n.cloud/api/v1 or http://localhost:5678/api/v1)\", required: true, default: \"http://localhost:5678/api/v1\" }, n8n_webhook_username: { type: \"string\", title: \"Webhook Username\", description: \"Username for webhook authentication (optional, only if using webhooks with basic auth)\", required: false }, n8n_webhook_password: { type: \"string\", title: \"Webhook Password\", description: \"Password for webhook authentication (optional, only if using webhooks with basic auth)\", required: false, sensitive: true }, timeout: { type: \"number\", title: \"Request Timeout\", description: \"Timeout for API requests in milliseconds\", required: false, default: 30000, min: 5000, max: 120000 }, max_results: { type: \"number\", title: \"Maximum Results\", description: \"Maximum number of results to return for list operations\", required: false, default: 50, min: 1, max: 500 }, enable_debug: { type: \"boolean\", title: \"Enable Debug Logging\", description: \"Enable verbose debug logging for troubleshooting\", required: false, default: false } }, compatibility: { client: \">=0.10.0\", platforms: [\"darwin\", \"win32\", \"linux\"], runtime: { node: \">=20.0.0\" } }, keywords: (.keywords + [\"desktop-extension\"]) }" manifest.json > dxt\manifest.json
) else (
    REM Fallback: Use PowerShell to process JSON
    echo [33m📝 Using PowerShell to convert manifest to DXT format[0m
    powershell -command "try { $manifest = Get-Content 'manifest.json' | ConvertFrom-Json; $dxtManifest = @{ dxt_version = '0.1'; name = $manifest.name; display_name = $manifest.name; version = $manifest.version; description = $manifest.description; long_description = $manifest.description + \"`n`nFeatures:`n- Complete workflow lifecycle management`n- Execution monitoring and control`n- Webhook-based workflow triggers`n- Health monitoring and diagnostics`n- Secure credential handling`n- Resource browsing capabilities`n`nRequires n8n instance with API access enabled.\"; author = @{ name = 'liemle3893'; email = 'liemle3893@gmail.com'; url = 'https://github.com/liemle3893' }; license = $manifest.license; repository = $manifest.repository; homepage = $manifest.homepage; documentation = $manifest.homepage; support = $manifest.bugs.url; server = @{ type = 'node'; entry_point = 'server/index.js'; mcp_config = @{ command = 'node'; args = @('${__dirname}/server/index.js'); env = @{ N8N_API_URL = '${user_config.n8n_api_url}'; N8N_API_KEY = '${user_config.n8n_api_key}'; N8N_WEBHOOK_USERNAME = '${user_config.n8n_webhook_username}'; N8N_WEBHOOK_PASSWORD = '${user_config.n8n_webhook_password}'; DEBUG = '${user_config.enable_debug}'; REQUEST_TIMEOUT = '${user_config.timeout}'; MAX_RESULTS = '${user_config.max_results}' } } }; tools = $manifest.tools; user_config = @{ n8n_api_key = @{ type = 'string'; title = 'n8n API Key'; description = 'API key for authenticating with your n8n instance'; required = $true; sensitive = $true }; n8n_api_url = @{ type = 'string'; title = 'n8n API URL'; description = 'Full URL of the n8n API, including /api/v1 (e.g., https://your-n8n.app.n8n.cloud/api/v1 or http://localhost:5678/api/v1)'; required = $true; default = 'http://localhost:5678/api/v1' }; n8n_webhook_username = @{ type = 'string'; title = 'Webhook Username'; description = 'Username for webhook authentication (optional, only if using webhooks with basic auth)'; required = $false }; n8n_webhook_password = @{ type = 'string'; title = 'Webhook Password'; description = 'Password for webhook authentication (optional, only if using webhooks with basic auth)'; required = $false; sensitive = $true }; timeout = @{ type = 'number'; title = 'Request Timeout'; description = 'Timeout for API requests in milliseconds'; required = $false; default = 30000; min = 5000; max = 120000 }; max_results = @{ type = 'number'; title = 'Maximum Results'; description = 'Maximum number of results to return for list operations'; required = $false; default = 50; min = 1; max = 500 }; enable_debug = @{ type = 'boolean'; title = 'Enable Debug Logging'; description = 'Enable verbose debug logging for troubleshooting'; required = $false; default = $false } }; compatibility = @{ client = '>=0.10.0'; platforms = @('darwin', 'win32', 'linux'); runtime = @{ node = '>=20.0.0' } }; keywords = $manifest.keywords + @('desktop-extension') }; $dxtManifest | ConvertTo-Json -Depth 10 | Out-File 'dxt\manifest.json' -Encoding UTF8; Write-Output 'DXT manifest created successfully' } catch { Write-Error $_.Exception.Message; copy 'manifest.json' 'dxt\manifest.json' }"
    if errorlevel 1 (
        echo [33m⚠️  PowerShell JSON processing failed, copying manifest as-is[0m
        copy "manifest.json" "dxt\manifest.json" > nul
    )
)

REM Update dxt\package.json if needed
echo [33m📄 Updating dxt\package.json[0m
if exist "dxt\package.json" (
    REM Try to update version using PowerShell
    powershell -command "try { $rootPkg = Get-Content 'package.json' | ConvertFrom-Json; $dxtPkg = Get-Content 'dxt\package.json' | ConvertFrom-Json; $dxtPkg.version = $rootPkg.version; $dxtPkg | ConvertTo-Json -Depth 10 | Out-File 'dxt\package.json' -Encoding UTF8 } catch { Write-Warning 'Failed to update DXT package.json version' }" > nul
)

echo [32m✅ DXT sync completed successfully![0m
echo.
echo [36mNext steps:[0m
echo 1. Run 'build-dxt.bat' to create the .dxt package
echo 2. Test the .dxt package in Claude Desktop