# Solara Visual Mapper - VS Code Extension

## Overview

A production-ready VS Code extension that provides real-time bidirectional highlighting between code and HTML preview. Built with TypeScript and the VS Code Extension API.

**Current State**: Complete and ready for testing in VS Code Extension Development Host

## Recent Changes

- 2025-11-21: Initial project creation
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
│   └── preview.js           # Webview frontend script (vanilla JS)
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

2. **highlightMapping.ts**: Pure functions for attribute-based mapping
   - `selectorFromContext()`: Extracts CSS selectors from cursor position
   - `findCodeLocation()`: Reverse mapping from preview to code
   - Priority: data-code-id > id > class

3. **preview.js**: Webview frontend script
   - Element highlighting with smooth scrolling
   - Click event handling for navigation
   - CORS-aware iframe content access
   - Dynamic style injection

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

- CORS restrictions may prevent click-to-code in dev server mode
- Simple regex parsing (no AST) for attribute extraction
- Only first class name used when mapping by class
- 100ms debounce on cursor movements
