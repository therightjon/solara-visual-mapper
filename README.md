# Solara Visual Mapper

A VS Code extension that provides real-time bidirectional highlighting between your code and HTML preview. Move your cursor in the code, and see the corresponding element highlight in the preview. Click an element in the preview to jump to its code location.

**⭐ NEW in V2**: Dev Server mode now supports **full bidirectional highlighting** with the optional Solara client script! Add it to your React/Next.js app for cursor-to-element highlighting and click-to-code navigation in dev server mode.

## Features

- **Three Preview Modes**:
  - **Current File** ✅ (Full bidirectional highlighting): Preview plain HTML files from your workspace
  - **Static Build** ✅ (Full bidirectional highlighting): Preview compiled HTML from build folders (dist, out, etc.)
  - **Dev Server** ✅ (Visual + Optional Interactive): Connect to running development servers (React, Next.js, etc.) - Now supports full bidirectional features with the optional Solara client script!

- **Cursor-to-Element Highlighting**: As you move your cursor through HTML/JSX code, matching elements in the preview are highlighted automatically (works in all modes, dev server requires client script)

- **Click-to-Code Navigation**: Click elements in the preview to jump to their code location (works in all modes, dev server requires client script)

- **Smart Attribute Detection**: Supports `data-code-id`, `id`, and `class` attributes for mapping across multiple lines

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

**Important Notes**: 
- The extension does NOT start or manage your dev server. You must run it separately.
- **CORS Limitation**: By default, dev server mode is visual-only due to browser security. However, you can enable **full bidirectional features** (highlighting + click-to-code) by adding the Solara client script to your app. See the "Dev Server Interactive Mode" section below.

#### Dev Server Interactive Mode (V2)

**NEW**: Enable bidirectional highlighting and click-to-code in dev server mode!

While inline HTML and static builds can be controlled directly by the extension, dev servers run in a different origin which prevents direct DOM access. The Solara client script bridges this gap using a secure `postMessage` protocol.

**How It Works:**
1. The client script runs inside your React/Next.js app (same origin as dev server)
2. It communicates with the VS Code extension via `window.postMessage`
3. This enables cursor-to-element highlighting AND click-to-code navigation in dev server mode

**Setup Steps:**

1. **Copy the client script** from `client/solaraPreviewClient.js` into your project

2. **Import and attach the client** in your app's entry point:

   **For React (Vite)** - in `main.jsx` or `main.tsx`:
   ```javascript
   import React from 'react';
   import ReactDOM from 'react-dom/client';
   import App from './App';
   import { attachSolaraPreviewClient } from './client/solaraPreviewClient';

   // Attach Solara client for VS Code integration
   attachSolaraPreviewClient();

   ReactDOM.createRoot(document.getElementById('root')).render(<App />);
   ```

   **For Next.js (App Router)** - create `app/SolaraClient.tsx`:
   ```typescript
   'use client';
   import { useEffect } from 'react';
   import { attachSolaraPreviewClient } from '../client/solaraPreviewClient';

   export default function SolaraClient() {
     useEffect(() => {
       attachSolaraPreviewClient();
     }, []);
     return null;
   }
   ```

   Then in `app/layout.tsx`:
   ```typescript
   import SolaraClient from './SolaraClient';

   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           <SolaraClient />
           {children}
         </body>
       </html>
     );
   }
   ```

   **For Next.js (Pages Router)** - in `pages/_app.js`:
   ```javascript
   import { useEffect } from 'react';
   import { attachSolaraPreviewClient } from '../client/solaraPreviewClient';

   export default function App({ Component, pageProps }) {
     useEffect(() => {
       attachSolaraPreviewClient();
     }, []);

     return <Component {...pageProps} />;
   }
   ```

3. **Add highlight styles** to your global CSS:
   ```css
   .solara-preview-highlight {
     outline: 2px solid #0066ff !important;
     outline-offset: 2px !important;
     background-color: rgba(0, 102, 255, 0.1) !important;
   }
   ```

4. **Start your dev server** and open the Visual Preview in VS Code

5. **Look for the connection status** in the preview panel:
   - "Dev server preview • Interactive link with Solara client connected" ✅
   - If you see "Connecting..." for more than 10 seconds, the client script may not be loaded correctly

**Optional**: The client script is **completely optional**. If you don't add it, dev server mode works as a visual-only preview without any errors.

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

- **Dev Server Requires Client Script for Interactivity**: Due to browser same-origin policies, the extension cannot directly access iframe content from external dev servers (e.g., `http://localhost:3000`). To enable full bidirectional features in dev server mode:
  - **Add the Solara client script** to your React/Next.js app (see "Dev Server Interactive Mode" section above)
  - Without the client script, dev server mode works as visual-only preview (no errors)
  - The client script is completely optional and uses secure `postMessage` communication

- **Multiline Attribute Position**: When the cursor is on a middle line of a multiline tag (on an attribute line, not the line with `<tagName`), highlighting may not work. Move your cursor to the opening tag line or attribute value for best results.

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
│   └── preview.js           # Webview frontend script (with V2 postMessage)
├── client/
│   └── solaraPreviewClient.js  # Optional client script for dev server mode
├── .vscode/
│   ├── launch.json          # Debug configuration
│   └── extensions.json      # Recommended extensions
└── example.html             # Sample HTML for testing
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
