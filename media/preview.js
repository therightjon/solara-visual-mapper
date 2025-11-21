(function() {
  const vscode = acquireVsCodeApi();
  const CHANNEL = 'solara-visual-mapper';
  
  let currentHighlightedElement = null;
  let currentMode = 'currentFile'; // currentFile | staticHtml | devServer
  let devClientConnected = false;
  let handshakeAttempts = 0;
  let handshakeInterval = null;

  // Listen for messages from VS Code extension and iframe content
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    // Handle preview-mode message from extension
    if (message.type === 'preview-mode') {
      currentMode = message.mode || 'currentFile';
      console.log('[Solara Webview] Mode set to:', currentMode);
      return;
    }
    
    // Handle highlight-element message from extension
    if (message.type === 'highlight-element' && message.selector) {
      highlightElement(message.selector);
      return;
    }

    // Handle messages from iframe content (V2 postMessage bridge)
    if (message.channel === CHANNEL) {
      handleIframeMessage(message);
    }
  });

  function handleIframeMessage(message) {
    switch (message.type) {
      case 'hello-from-client':
        console.log('[Solara Webview] Client connected');
        devClientConnected = true;
        stopHandshake();
        updateConnectionStatus(true);
        break;

      case 'focus-code':
        // Forward focus-code message to extension
        vscode.postMessage({
          type: 'focus-code',
          attributeType: message.attributeType,
          value: message.value
        });
        break;

      default:
        break;
    }
  }

  function startDevHandshake() {
    handshakeAttempts = 0;
    devClientConnected = false;
    updateConnectionStatus(false);

    console.log('[Solara Webview] Starting handshake...');

    handshakeInterval = setInterval(() => {
      if (devClientConnected || handshakeAttempts >= 10) {
        stopHandshake();
        return;
      }

      const iframe = document.getElementById('preview-frame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          channel: CHANNEL,
          type: 'hello-from-webview'
        }, '*');

        handshakeAttempts++;
        console.log('[Solara Webview] Handshake attempt', handshakeAttempts);
      }
    }, 1000);
  }

  function stopHandshake() {
    if (handshakeInterval) {
      clearInterval(handshakeInterval);
      handshakeInterval = null;
    }
  }

  function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
      if (connected) {
        statusIndicator.textContent = '✓ Interactive mode active';
        statusIndicator.style.color = '#4caf50';
      } else {
        statusIndicator.textContent = '○ Visual-only mode (interactive client not detected)';
        statusIndicator.style.color = '#888';
      }
    }
  }

  function highlightElement(selector) {
    const iframe = document.getElementById('preview-frame');
    if (!iframe) {
      return;
    }

    // V2: Use postMessage for devServer mode with connected client
    if (currentMode === 'devServer' && devClientConnected) {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          channel: CHANNEL,
          type: 'highlight-element',
          selector: selector
        }, '*');
        console.log('[Solara Webview] Sent highlight-element via postMessage');
      }
      return;
    }

    // V1: Use contentDocument for currentFile and staticHtml modes
    let iframeDoc;
    try {
      iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    } catch (e) {
      console.warn('Cannot access iframe content (possible CORS issue):', e);
      return;
    }

    if (!iframeDoc) {
      return;
    }

    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove('vscode-highlighted-element');
      currentHighlightedElement = null;
    }

    try {
      const element = iframeDoc.querySelector(selector);
      if (element) {
        element.classList.add('vscode-highlighted-element');
        currentHighlightedElement = element;
        
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    } catch (e) {
      console.warn('Error highlighting element:', e);
    }
  }

  function setupIframeClickHandler() {
    const iframe = document.getElementById('preview-frame');
    if (!iframe) {
      return;
    }

    iframe.addEventListener('load', () => {
      // Start handshake for devServer mode (V2)
      if (currentMode === 'devServer') {
        startDevHandshake();
      }

      // V1: Try to access iframe content for direct click handling
      let iframeDoc;
      try {
        iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      } catch (e) {
        console.warn('Cannot access iframe content for click handling (possible CORS issue):', e);
        return;
      }

      if (!iframeDoc) {
        return;
      }

      iframeDoc.addEventListener('click', (e) => {
        let target = e.target;
        
        while (target && target !== iframeDoc.body) {
          const dataCodeId = target.getAttribute('data-code-id');
          if (dataCodeId) {
            vscode.postMessage({
              type: 'focus-code',
              attributeType: 'data-code-id',
              value: dataCodeId
            });
            e.preventDefault();
            return;
          }

          const id = target.getAttribute('id');
          if (id) {
            vscode.postMessage({
              type: 'focus-code',
              attributeType: 'id',
              value: id
            });
            e.preventDefault();
            return;
          }

          const className = target.getAttribute('class');
          if (className) {
            const classes = className.trim().split(/\s+/);
            if (classes.length > 0 && classes[0]) {
              vscode.postMessage({
                type: 'focus-code',
                attributeType: 'class',
                value: classes[0]
              });
              e.preventDefault();
              return;
            }
          }

          target = target.parentElement;
        }
      });

      injectHighlightStyles(iframeDoc);
    });
  }

  function injectHighlightStyles(iframeDoc) {
    const styleId = 'vscode-highlight-styles';
    if (iframeDoc.getElementById(styleId)) {
      return;
    }

    const style = iframeDoc.createElement('style');
    style.id = styleId;
    style.textContent = `
      .vscode-highlighted-element {
        outline: 3px solid #007acc !important;
        outline-offset: 2px !important;
        background-color: rgba(0, 122, 204, 0.1) !important;
        transition: all 0.2s ease-in-out !important;
      }
    `;
    iframeDoc.head.appendChild(style);
  }

  setupIframeClickHandler();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.id === 'preview-frame') {
          setupIframeClickHandler();
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
