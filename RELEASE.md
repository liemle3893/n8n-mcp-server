# Release Guide

## Automated Releases

The project uses GitHub Actions to automatically build and release DXT packages for multiple platforms.

### Trigger a Release

1. **Tag-based release (recommended)**:
   ```bash
   npm run release:patch   # 0.1.8 -> 0.1.9
   npm run release:minor   # 0.1.8 -> 0.2.0  
   npm run release:major   # 0.1.8 -> 1.0.0
   ```

2. **Manual workflow trigger**:
   - Go to GitHub Actions → Release workflow
   - Click "Run workflow"
   - Enter the release tag (e.g., `v0.1.9`)

### Release Artifacts

Each release automatically creates:

- **DXT Packages** (6 platforms):
  - `n8n-mcp-server-darwin-x64.dxt` (macOS Intel)
  - `n8n-mcp-server-darwin-arm64.dxt` (macOS Apple Silicon)
  - `n8n-mcp-server-linux-x64.dxt` (Linux x64)
  - `n8n-mcp-server-linux-arm64.dxt` (Linux ARM64)
  - `n8n-mcp-server-win32-x64.dxt` (Windows x64)  
  - `n8n-mcp-server-win32-arm64.dxt` (Windows ARM64)

- **npm Package**: Published to `@liemle3893/n8n-mcp-server`

## Manual Build

```bash
# Build TypeScript
npm run build

# Build DXT package
npm run build:dxt
```