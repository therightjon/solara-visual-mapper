# Solara Visual Mapper

A VS Code extension that provides real-time bidirectional highlighting between your code and HTML preview. Move your cursor in the code, and see the corresponding element highlight in the preview. Click an element in the preview to jump to its code location.

## Features

- **Three Preview Modes**:
  - **Current File**: Preview plain HTML files from your workspace
  - **Dev Server**: Connect to running development servers (React, Next.js, etc.)
  - **Static Build**: Preview compiled HTML from build folders (dist, out, etc.)

- **Cursor-to-Element Highlighting**: As you move your cursor through HTML/JSX code, matching elements in the preview are highlighted automatically

- **Click-to-Code Navigation**: Click elements in the preview to jump to their code location

- **Smart Attribute Detection**: Supports `data-code-id`, `id`, and `class` attributes for mapping

- **Status Bar Indicator**: Shows current preview mode at a glance

## Installation & Setup

### Running in Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Compile the Extension**:
   ```bash
   npm run compile
   ```

3. **Launch Extension Development Host**:
   - Open this folder in VS Code
   - Press `F5` to open a new VS Code window with the extension loaded
   - The Extension Development Host will launch with your extension active

### Building for Production

To create a `.vsix` package for distribution:

```bash
npm install -g @vscode/vsce
vsce package
```

## Usage

### Opening the Preview

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Run the command: **"Open Visual Preview"**
3. The preview panel will open beside your editor

### Mode 1: Current File (Plain HTML)

**Best for**: Static HTML files

1. Open an HTML file in VS Code
2. Run **"Open Visual Preview"**
3. The file will be rendered in the preview panel
4. As you move your cursor, elements with matching attributes will highlight

**Configuration**:
```json
{
  "visualPreview.defaultMode": "currentFile"
}
```

### Mode 2: Dev Server (React, Next.js, etc.)

**Best for**: Live development with hot-reload frameworks

1. Start your development server separately:
   ```bash
   npm run dev
   # or
   next dev
   # or
   yarn start
   ```

2. Set the dev server URL:
   - Run command: **"Set Dev Server URL"**
   - Enter your server URL (e.g., `http://localhost:3000`)
   - Choose "Yes" to switch to devServer mode

3. Run **"Open Visual Preview"**

**Configuration**:
```json
{
  "visualPreview.defaultMode": "devServer",
  "visualPreview.devServerUrl": "http://localhost:3000"
}
```

**Note**: The extension does NOT start or manage your dev server. You must run it separately.

### Mode 3: Static Build

**Best for**: Previewing production builds without running a server

1. Build your project:
   ```bash
   npm run build
   ```

2. Select the built HTML file:
   - Run command: **"Select Static HTML File"**
   - Navigate to your build folder (e.g., `dist/index.html`, `out/index.html`)
   - Select the HTML file
   - Choose "Yes" to switch to staticHtml mode

3. Run **"Open Visual Preview"**

**Configuration**:
```json
{
  "visualPreview.defaultMode": "staticHtml"
}
```

The selected file path is stored in workspace state.

## Attribute Mapping

The extension maps code to preview elements using HTML attributes. It searches in this priority order:

### 1. `data-code-id` (Recommended)

Best for explicit, reliable mapping:

```html
<div data-code-id="hero-section">
  <h1 data-code-id="hero-title">Welcome</h1>
</div>
```

```jsx
<div data-code-id="hero-section">
  <h1 data-code-id="hero-title">Welcome</h1>
</div>
```

### 2. `id` Attribute

Works well for unique elements:

```html
<button id="submit-btn">Submit</button>
```

```jsx
<button id="submit-btn">Submit</button>
```

### 3. `class` / `className` Attribute

Uses the first class name:

```html
<div class="primary-button large">Click me</div>
```

```jsx
<div className="primary-button large">Click me</div>
```

## Commands

| Command | Description |
|---------|-------------|
| **Open Visual Preview** | Opens or reveals the preview panel |
| **Set Dev Server URL** | Configure the URL for dev server mode |
| **Select Static HTML File** | Choose an HTML file for static build mode |

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `visualPreview.defaultMode` | `string` | `"currentFile"` | Preview mode: `currentFile`, `devServer`, or `staticHtml` |
| `visualPreview.devServerUrl` | `string` | `""` | URL of the development server |

## How It Works

### Code to Preview (Highlighting)

1. When you move your cursor in the editor, the extension examines the current line
2. It extracts identifiable attributes (`data-code-id`, `id`, or `class`)
3. A CSS selector is constructed and sent to the webview
4. The webview highlights the matching element and scrolls it into view

### Preview to Code (Click Navigation)

1. When you click an element in the preview, the webview walks up the DOM tree
2. It finds the first element with `data-code-id`, `id`, or `class`
3. The attribute value is sent back to the extension
4. The extension searches the document for matching code
5. Your cursor jumps to the matching location

## Known Limitations

- **CORS Restrictions**: Dev server mode may not support click-to-code navigation due to cross-origin security policies. Use `data-code-id` attributes in your source code for best results.

- **Approximate Matching**: The extension uses simple regex-based parsing. Complex or minified code may not map accurately.

- **First Class Only**: When using `class` attributes, only the first class name is used for mapping.

- **No AST Parsing**: The extension doesn't parse JavaScript/TypeScript syntax trees, so it relies on simple string matching.

- **Debouncing**: Cursor movements are debounced by 100ms to prevent excessive highlighting updates.

## Tips for Best Results

1. **Use `data-code-id`** for the most reliable mapping, especially in complex components
2. **Keep attributes on the same line** as the opening tag for better detection
3. **Use unique IDs** when possible for precise navigation
4. **Run dev servers on standard ports** (3000, 8080, etc.)
5. **Check CORS settings** if click-to-code doesn't work in dev server mode

## Development

### File Structure

```
.
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
├── src/
│   ├── extension.ts         # Main extension logic
│   └── highlightMapping.ts  # Selector extraction logic
├── media/
│   └── preview.js           # Webview frontend script
└── .vscode/
    ├── launch.json          # Debug configuration
    └── extensions.json      # Recommended extensions
```

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
vsce package
```

### Debugging

1. Open this folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Set breakpoints in `src/extension.ts`
4. Use the Debug Console to inspect variables

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Roadmap

Future enhancements:
- AST-based parsing for more accurate code mapping
- Support for multiple cursors
- Configurable highlight colors
- Component tree visualization for React
- Hot-reload detection and auto-refresh
