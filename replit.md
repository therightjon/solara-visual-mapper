# Solara Visual Mapper - VS Code Extension

## Overview

A production-ready VS Code extension that provides real-time bidirectional highlighting between code and HTML preview. Built with TypeScript and the VS Code Extension API.

**Current State**: V2 complete with interactive dev server support via postMessage bridge

## Recent Changes

- 2025-11-21: **V2 Release - Interactive Dev Server Support**
  - Added postMessage bridge for bidirectional communication with dev servers
  - Created optional client script (`client/solaraPreviewClient.js`) for React/Next.js apps
  - Implemented handshake protocol with 10-second timeout
  - Added connection status indicator in webview
  - Updated preview.js to branch between V1 (contentDocument) and V2 (postMessage) paths
  - Extended extension.ts to send preview-mode messages to webview
  - All V1 features preserved - fully backward compatible
  - Updated README with comprehensive V2 usage instructions

- 2025-11-21: Initial V1 project creation
  - Set up TypeScript configuration with strict mode
  - Implemented three-mode preview system (currentFile, devServer, staticHtml)
  - Created webview panel with iframe-based preview
  - Implemented cursor-to-element highlighting with debouncing
  - Added click-to-code navigation
  - Created comprehensive README with usage instructions

## Project Architecture

### File Structure

```
.
├── package.json              # Extension manifest and configuration
├── tsconfig.json            # TypeScript compiler settings
├── src/
│   ├── extension.ts         # Main extension logic, commands, and webview
│   └── highlightMapping.ts  # Selector extraction and code mapping
├── media/
│   └── preview.js           # Webview frontend script (V1 + V2 postMessage)
├── client/
│   └── solaraPreviewClient.js  # Optional client script for React/Next.js apps
├── .vscode/
│   ├── launch.json          # Extension debug configuration
│   └── extensions.json      # Recommended extensions
├── example.html             # Sample HTML for testing
└── README.md                # User documentation
```

### Key Components

1. **extension.ts**: Main extension activation, commands, webview management
   - Three commands: openPreview, setDevServerUrl, selectStaticHtml
   - Webview panel creation with CSP and nonce security
   - Selection change listener with debouncing
   - Message handling for bidirectional communication
   - Sends preview-mode message to webview for V2 support
   - Connection status indicator in webview UI

2. **highlightMapping.ts**: Pure functions for attribute-based mapping
   - `selectorFromContext()`: Extracts CSS selectors from cursor position
   - `findCodeLocation()`: Reverse mapping from preview to code
   - Priority: data-code-id > id > class

3. **preview.js**: Webview frontend script (V1 + V2 hybrid)
   - Mode detection (currentFile, devServer, staticHtml)
   - V1 path: Direct contentDocument access for inline/static HTML
   - V2 path: postMessage bridge for dev server interactivity
   - Handshake protocol with 10-second timeout
   - Connection status tracking and display
   - Element highlighting with smooth scrolling
   - Click event handling for navigation
   - Dynamic style injection

4. **solaraPreviewClient.js**: Optional client script for dev servers
   - Runs inside React/Next.js app (same origin as dev server)
   - Implements postMessage protocol using "solara-visual-mapper" channel
   - Sends hello-from-client on initialization
   - Receives highlight-element messages from parent
   - Sends focus-code messages on element click
   - DOM tree walking to find data-code-id, id, or class attributes
   - Auto-injects highlight styles

### Preview Modes

1. **currentFile**: Direct HTML file preview using srcdoc
2. **devServer**: External dev server via iframe src (React, Next.js)
3. **staticHtml**: Built HTML from dist/out folders

## User Preferences

None set yet.

## Dependencies

- **Runtime**: VS Code API (^1.80.0)
- **DevDependencies**:
  - TypeScript ^5.3.0
  - @types/node ^20.10.0
  - @types/vscode ^1.80.0

## Development Workflow

### Building

```bash
npm install
npm run compile
```

### Testing

1. Open this folder in VS Code
2. Press F5 to launch Extension Development Host
3. Open example.html in the new window
4. Run "Open Visual Preview" command
5. Move cursor through HTML tags to test highlighting

### Packaging

```bash
npm install -g @vscode/vsce
vsce package
```

## Known Limitations

- Dev server interactivity requires optional client script (visual-only without it)
- Multiline attribute position (cursor on middle attribute line may not highlight)
- Simple regex parsing (no AST) for attribute extraction
- Only first class name used when mapping by class
- 100ms debounce on cursor movements

## V2 Message Protocol

All postMessage communication uses the `"solara-visual-mapper"` channel namespace.

**Parent → Dev Server:**
- `{ channel: "solara-visual-mapper", type: "hello-from-webview" }`
- `{ channel: "solara-visual-mapper", type: "highlight-element", selector: string }`

**Dev Server → Parent:**
- `{ channel: "solara-visual-mapper", type: "hello-from-client" }`
- `{ channel: "solara-visual-mapper", type: "focus-code", attributeType: string, value: string }`

**Handshake:** 10 attempts at 1-second intervals. Graceful fallback to visual-only if no response.
