# Windows Build Troubleshooting Guide

## Common Windows Issues & Solutions

### 1. **PowerShell Execution Policy**
**Error**: `cannot be loaded because running scripts is disabled on this system`

**Solution**:
```cmd
# Run as Administrator
powershell -command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
```

### 2. **Node.js Not Found**
**Error**: `'node' is not recognized as an internal or external command`

**Solutions**:
- Install Node.js ≥20.0.0 from [nodejs.org](https://nodejs.org)
- Restart Command Prompt after installation
- Verify: `node --version`

### 3. **Path Issues**
**Error**: File paths with spaces or special characters

**Solutions**:
- Use quotes around paths: `"C:\Program Files\..."`
- Avoid spaces in project folder names
- Use short path names when possible

### 4. **ZIP Creation Fails**
**Error**: PowerShell Compress-Archive fails

**Alternative Methods**:

#### Option A: Use 7-Zip (if installed)
```cmd
7z a -tzip n8n-mcp-server.dxt dxt\*
```

#### Option B: Manual ZIP creation
1. Right-click the `dxt` folder
2. Select "Send to" → "Compressed (zipped) folder"  
3. Rename from `dxt.zip` to `n8n-mcp-server.dxt`

#### Option C: Use Python (if installed)
```cmd
python -c "import shutil; shutil.make_archive('n8n-mcp-server', 'zip', 'dxt')" && ren n8n-mcp-server.zip n8n-mcp-server.dxt
```

### 5. **JSON Processing Issues**
**Error**: jq or PowerShell JSON conversion fails

**Solution**: The script will fallback to copying the manifest as-is, which should still work.

### 6. **Character Encoding Issues**
**Error**: Special characters in output

**Solutions**:
- Run Command Prompt as Administrator
- Use PowerShell instead of CMD
- Ensure UTF-8 encoding: `chcp 65001`

## Recommended Windows Workflow

### Prerequisites Check
```cmd
# Check Node.js version
node --version

# Check npm version  
npm --version

# Check PowerShell version
powershell -command "$PSVersionTable.PSVersion"
```

### Build Process
```cmd
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Build DXT (includes sync)
build-dxt.bat

# Alternative if build-dxt.bat fails:
sync-to-dxt.bat
# Then manually create ZIP from dxt folder
```

### Manual DXT Creation
If automated scripts fail:

1. **Build the project**:
   ```cmd
   npm run build
   ```

2. **Manually sync files**:
   - Copy `build\index.js` → `dxt\server\index.js`
   - Copy `manifest.json` → `dxt\manifest.json`

3. **Create ZIP**:
   - Right-click `dxt` folder → "Send to" → "Compressed folder"
   - Rename `dxt.zip` to `n8n-mcp-server.dxt`

## Environment Variables

If you need to set environment variables for the build:

```cmd
set NODE_ENV=production
set NODE_OPTIONS=--max-old-space-size=4096
```

## Testing the DXT

1. **Verify file size**: DXT should be several MB (not just a few KB)
2. **Check contents**: 
   ```cmd
   powershell -command "Expand-Archive -Path n8n-mcp-server.dxt -DestinationPath temp-extract"
   dir temp-extract
   ```
3. **Install in Claude Desktop**: Drag `n8n-mcp-server.dxt` into Claude Desktop

## Get Help

If you're still having issues:

1. **Run diagnostics**:
   ```cmd
   echo Node.js version: & node --version
   echo npm version: & npm --version  
   echo PowerShell version: & powershell -command "$PSVersionTable.PSVersion"
   echo Current directory: & cd
   dir build\index.js
   dir dxt\server\index.js
   ```

2. **Try the minimal approach**: Use manual ZIP creation method above

3. **Use WSL**: If available, use Windows Subsystem for Linux with the bash scripts

Remember: The goal is to create a ZIP file containing the `dxt` folder contents with a `.dxt` extension!