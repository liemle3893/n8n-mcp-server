# Release Guide

## Automated Release System

The project uses GitHub Actions with a **single consolidated workflow** to build and release:
- 6 platform-specific DXT packages 
- npm package publication
- Docker images (triggered after release)

## Release Process

### 1. **Create Release (Recommended)**
```bash
npm run release:patch   # 0.1.10 -> 0.1.11
npm run release:minor   # 0.1.10 -> 0.2.0  
npm run release:major   # 0.1.10 -> 1.0.0
```

This will:
1. Bump the version in `package.json`
2. Create and push a git tag (e.g., `v0.1.11`)
3. **Automatically trigger** the release workflow

### 2. **Manual Workflow Trigger** (Alternative)
- Go to GitHub Actions → "Release" workflow
- Click "Run workflow" 
- Enter release tag (e.g., `v0.1.11`)

## What Happens Automatically

### **Release Workflow** (triggered by tags)
1. **Multi-platform DXT builds**: 6 platform-specific packages
2. **GitHub Release**: Created with all DXT files attached
3. **npm Publication**: Package published to `@liemle3893/n8n-mcp-server`

### **Docker Workflow** (triggered by releases)
- Automatically builds Docker images after GitHub release is published
- Multi-arch support: `linux/amd64` and `linux/arm64`

## Release Artifacts

Each release creates:

### **DXT Packages** (6 platforms)
- `n8n-mcp-server-darwin-x64.dxt` (macOS Intel)
- `n8n-mcp-server-darwin-arm64.dxt` (macOS Apple Silicon)  
- `n8n-mcp-server-linux-x64.dxt` (Linux x64)
- `n8n-mcp-server-linux-arm64.dxt` (Linux ARM64)
- `n8n-mcp-server-win32-x64.dxt` (Windows x64)
- `n8n-mcp-server-win32-arm64.dxt` (Windows ARM64)

### **npm Package**
- Published to `@liemle3893/n8n-mcp-server`
- Available via `npm install -g @liemle3893/n8n-mcp-server`

### **Docker Images**  
- Published to Docker Hub
- Multi-architecture support

## Manual Development

```bash
# Build TypeScript
npm run build

# Build local DXT package  
npm run build:dxt
```

## Workflow Architecture

```
Tag Push (v*) → Release Workflow → GitHub Release → Docker Workflow
                     ↓
              Multi-platform DXT + npm
```

**No more conflicts** - single source of truth for all releases!