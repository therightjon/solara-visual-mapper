"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const highlightMapping_1 = require("./highlightMapping");
let previewPanel;
let statusBarItem;
let lastHighlightTime = 0;
const DEBOUNCE_MS = 100;
function activate(context) {
    console.log('Solara Visual Mapper is now active');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    const openPreviewCommand = vscode.commands.registerCommand('visualPreview.openPreview', () => openPreview(context));
    const setDevServerUrlCommand = vscode.commands.registerCommand('visualPreview.setDevServerUrl', () => setDevServerUrl(context));
    const selectStaticHtmlCommand = vscode.commands.registerCommand('visualPreview.selectStaticHtml', () => selectStaticHtml(context));
    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((event) => {
        handleSelectionChange(event, context);
    });
    context.subscriptions.push(openPreviewCommand, setDevServerUrlCommand, selectStaticHtmlCommand, selectionChangeListener);
}
function deactivate() {
    if (previewPanel) {
        previewPanel.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
function openPreview(context) {
    const config = vscode.workspace.getConfiguration('visualPreview');
    const defaultMode = config.get('defaultMode', 'currentFile');
    if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }
    previewPanel = vscode.window.createWebviewPanel('visualPreview', 'Visual Preview', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media')
        ]
    });
    previewPanel.onDidDispose(() => {
        previewPanel = undefined;
        updateStatusBar();
    });
    previewPanel.webview.onDidReceiveMessage((message) => handleWebviewMessage(message, context), undefined, context.subscriptions);
    updatePreviewContent(context, defaultMode);
    updateStatusBar(defaultMode);
}
async function updatePreviewContent(context, mode) {
    if (!previewPanel) {
        return;
    }
    const config = vscode.workspace.getConfiguration('visualPreview');
    const devServerUrl = config.get('visualPreview.devServerUrl', '');
    let iframeContent = '';
    let errorMessage = '';
    try {
        if (mode === 'currentFile') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.fileName.endsWith('.html')) {
                const content = editor.document.getText();
                iframeContent = `<iframe id="preview-frame" srcdoc="${escapeHtml(content)}" sandbox="allow-scripts allow-same-origin"></iframe>`;
            }
            else {
                errorMessage = 'Please open an HTML file to preview in currentFile mode.';
            }
        }
        else if (mode === 'devServer') {
            const actualDevServerUrl = config.get('devServerUrl', '');
            if (actualDevServerUrl) {
                iframeContent = `<iframe id="preview-frame" src="${actualDevServerUrl}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;
            }
            else {
                errorMessage = 'No dev server URL configured. Use "Set Dev Server URL" command.';
            }
        }
        else if (mode === 'staticHtml') {
            const staticHtmlUriString = context.workspaceState.get('visualPreview.staticHtmlUri');
            if (staticHtmlUriString) {
                const staticHtmlUri = vscode.Uri.parse(staticHtmlUriString);
                const fileData = await vscode.workspace.fs.readFile(staticHtmlUri);
                const content = Buffer.from(fileData).toString('utf8');
                iframeContent = `<iframe id="preview-frame" srcdoc="${escapeHtml(content)}" sandbox="allow-scripts allow-same-origin"></iframe>`;
            }
            else {
                errorMessage = 'No static HTML file selected. Use "Select Static HTML File" command.';
            }
        }
    }
    catch (error) {
        errorMessage = `Error loading preview: ${error instanceof Error ? error.message : String(error)}`;
    }
    const scriptUri = previewPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.js'));
    const nonce = getNonce();
    previewPanel.webview.html = getWebviewContent(scriptUri, nonce, iframeContent, errorMessage);
}
function getWebviewContent(scriptUri, nonce, iframeContent, errorMessage) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src *; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Visual Preview</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    #preview-frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    .error-message {
      padding: 20px;
      color: #f48771;
      font-family: system-ui, -apple-system, sans-serif;
      background: #1e1e1e;
      height: 100vh;
      box-sizing: border-box;
    }
    .vscode-highlighted-element {
      outline: 3px solid #007acc !important;
      outline-offset: 2px !important;
      background-color: rgba(0, 122, 204, 0.1) !important;
    }
  </style>
</head>
<body>
  ${errorMessage ? `<div class="error-message">${errorMessage}</div>` : iframeContent}
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
function handleSelectionChange(event, context) {
    if (!previewPanel || !event.textEditor) {
        return;
    }
    const now = Date.now();
    if (now - lastHighlightTime < DEBOUNCE_MS) {
        return;
    }
    lastHighlightTime = now;
    const document = event.textEditor.document;
    const position = event.selections[0].active;
    const selector = (0, highlightMapping_1.selectorFromContext)(document, position);
    if (selector) {
        previewPanel.webview.postMessage({
            type: 'highlight-element',
            selector,
            meta: { source: 'cursor' }
        });
    }
}
function handleWebviewMessage(message, context) {
    if (message.type === 'focus-code') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const { attributeType, value } = message;
        const range = (0, highlightMapping_1.findCodeLocation)(editor.document, attributeType, value);
        if (range) {
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    }
}
async function setDevServerUrl(context) {
    const url = await vscode.window.showInputBox({
        prompt: 'Enter dev server URL (e.g., http://localhost:3000)',
        placeHolder: 'http://localhost:3000',
        validateInput: (value) => {
            return value.trim() ? null : 'URL cannot be empty';
        }
    });
    if (url) {
        const config = vscode.workspace.getConfiguration('visualPreview');
        await config.update('devServerUrl', url, vscode.ConfigurationTarget.Workspace);
        const switchMode = await vscode.window.showInformationMessage('Dev server URL set. Switch to devServer mode?', 'Yes', 'No');
        if (switchMode === 'Yes') {
            await config.update('defaultMode', 'devServer', vscode.ConfigurationTarget.Workspace);
            if (previewPanel) {
                updatePreviewContent(context, 'devServer');
            }
            updateStatusBar('devServer');
        }
        vscode.window.showInformationMessage(`Dev server URL set to: ${url}`);
    }
}
async function selectStaticHtml(context) {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
            'HTML Files': ['html']
        },
        openLabel: 'Select Static HTML File'
    });
    if (uris && uris.length > 0) {
        const uri = uris[0];
        await context.workspaceState.update('visualPreview.staticHtmlUri', uri.toString());
        const config = vscode.workspace.getConfiguration('visualPreview');
        const switchMode = await vscode.window.showInformationMessage('Static HTML file selected. Switch to staticHtml mode?', 'Yes', 'No');
        if (switchMode === 'Yes') {
            await config.update('defaultMode', 'staticHtml', vscode.ConfigurationTarget.Workspace);
            if (previewPanel) {
                updatePreviewContent(context, 'staticHtml');
            }
            updateStatusBar('staticHtml');
        }
        vscode.window.showInformationMessage(`Static HTML file set to: ${uri.fsPath}`);
    }
}
function updateStatusBar(mode) {
    if (!statusBarItem) {
        return;
    }
    if (!previewPanel) {
        statusBarItem.hide();
        return;
    }
    const config = vscode.workspace.getConfiguration('visualPreview');
    const currentMode = mode || config.get('defaultMode', 'currentFile');
    statusBarItem.text = `$(preview) Preview: ${currentMode}`;
    statusBarItem.show();
}
function escapeHtml(html) {
    return html
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map