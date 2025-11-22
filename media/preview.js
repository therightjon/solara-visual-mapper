(function() {
  console.log('[Solara Webview] Script initializing...');
  
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
    console.log('[Solara Webview] Received message:', JSON.stringify(message));
    
    // Handle preview-mode message from extension
    if (message.type === 'preview-mode') {
      currentMode = message.mode || 'currentFile';
      console.log('[Solara Webview] Mode set to:', currentMode);
      return;
    }
    
    // Handle highlight-element message from extension
    if (message.type === 'highlight-element' && message.selector) {
      console.log('[Solara Webview] Received highlight-element request for selector:', message.selector);
      highlightElement(message.selector);
      return;
    }

    // Handle messages from iframe content (V2 postMessage bridge)
    if (message.channel === CHANNEL) {
      console.log('[Solara Webview] Received channel message:', message.type);
      handleIframeMessage(message);
    }
  });

  function handleIframeMessage(message) {
    console.log('[Solara Webview] handleIframeMessage called with type:', message.type);
    
    switch (message.type) {
      case 'hello-from-client':
        console.log('[Solara Webview] Client connected');
        devClientConnected = true;
        stopHandshake();
        updateConnectionStatus(true);
        break;

      case 'focus-code':
        console.log('[Solara Webview] Forwarding focus-code to extension:', message.attributeType, '=', message.value);
        // Forward focus-code message to extension
        vscode.postMessage({
          type: 'focus-code',
          attributeType: message.attributeType,
          value: message.value
        });
        break;

      default:
        console.log('[Solara Webview] Unknown iframe message type:', message.type);
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
    console.log('[Solara Webview] highlightElement called with selector:', selector);
    console.log('[Solara Webview] Current mode:', currentMode, 'Dev client connected:', devClientConnected);
    
    const iframe = document.getElementById('preview-frame');
    if (!iframe) {
      console.error('[Solara Webview] ERROR: iframe with id "preview-frame" not found!');
      return;
    }
    console.log('[Solara Webview] Iframe found:', iframe);

    // V2: Use postMessage for devServer mode with connected client
    if (currentMode === 'devServer' && devClientConnected) {
      console.log('[Solara Webview] Using V2 postMessage mode');
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          channel: CHANNEL,
          type: 'highlight-element',
          selector: selector
        }, '*');
        console.log('[Solara Webview] Sent highlight-element via postMessage');
      } else {
        console.error('[Solara Webview] ERROR: iframe.contentWindow is null');
      }
      return;
    }

    // V1: Use contentDocument for currentFile and staticHtml modes
    console.log('[Solara Webview] Using V1 contentDocument mode');
    let iframeDoc;
    try {
      iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      console.log('[Solara Webview] iframeDoc obtained:', !!iframeDoc);
    } catch (e) {
      console.error('[Solara Webview] ERROR: Cannot access iframe content (possible CORS issue):', e);
      return;
    }

    if (!iframeDoc) {
      console.error('[Solara Webview] ERROR: iframeDoc is null or undefined');
      return;
    }

    if (currentHighlightedElement) {
      console.log('[Solara Webview] Removing previous highlight');
      currentHighlightedElement.classList.remove('vscode-highlighted-element');
      currentHighlightedElement = null;
    }

    try {
      const element = iframeDoc.querySelector(selector);
      if (element) {
        console.log('[Solara Webview] Element found! Adding highlight class');
        element.classList.add('vscode-highlighted-element');
        currentHighlightedElement = element;
        
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        console.log('[Solara Webview] Element highlighted and scrolled into view');
      } else {
        console.warn('[Solara Webview] WARNING: No element found for selector:', selector);
      }
    } catch (e) {
      console.error('[Solara Webview] ERROR: Error highlighting element:', e);
    }
  }

  function setupIframeClickHandler() {
    console.log('[Solara Webview] setupIframeClickHandler called');
    
    const iframe = document.getElementById('preview-frame');
    if (!iframe) {
      console.warn('[Solara Webview] WARNING: iframe not found in setupIframeClickHandler, will retry via MutationObserver');
      return;
    }
    
    console.log('[Solara Webview] Iframe found, attaching load event listener');

    iframe.addEventListener('load', () => {
      console.log('[Solara Webview] Iframe load event fired!');
      console.log('[Solara Webview] Current mode:', currentMode);
      
      // Start handshake for devServer mode (V2)
      if (currentMode === 'devServer') {
        console.log('[Solara Webview] Starting dev handshake for devServer mode');
        startDevHandshake();
      }

      // V1: Try to access iframe content for direct click handling
      let iframeDoc;
      try {
        iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        console.log('[Solara Webview] Successfully accessed iframeDoc for click handling');
      } catch (e) {
        console.error('[Solara Webview] ERROR: Cannot access iframe content for click handling (possible CORS issue):', e);
        return;
      }

      if (!iframeDoc) {
        console.error('[Solara Webview] ERROR: iframeDoc is null');
        return;
      }

      console.log('[Solara Webview] Attaching click event listener to iframe document');
      
      iframeDoc.addEventListener('click', (e) => {
        console.log('[Solara Webview] Click event fired in iframe!');
        console.log('[Solara Webview] Click target:', e.target);
        
        let target = e.target;
        let depth = 0;
        
        while (target && target !== iframeDoc.body) {
          console.log('[Solara Webview] Checking element at depth', depth, ':', target.tagName);
          
          const dataCodeId = target.getAttribute('data-code-id');
          if (dataCodeId) {
            console.log('[Solara Webview] Found data-code-id:', dataCodeId);
            vscode.postMessage({
              type: 'focus-code',
              attributeType: 'data-code-id',
              value: dataCodeId
            });
            console.log('[Solara Webview] Sent focus-code message to extension');
            e.preventDefault();
            return;
          }

          const id = target.getAttribute('id');
          if (id) {
            console.log('[Solara Webview] Found id:', id);
            vscode.postMessage({
              type: 'focus-code',
              attributeType: 'id',
              value: id
            });
            console.log('[Solara Webview] Sent focus-code message to extension');
            e.preventDefault();
            return;
          }

          const className = target.getAttribute('class');
          if (className) {
            const classes = className.trim().split(/\s+/);
            if (classes.length > 0 && classes[0]) {
              console.log('[Solara Webview] Found class:', classes[0]);
              vscode.postMessage({
                type: 'focus-code',
                attributeType: 'class',
                value: classes[0]
              });
              console.log('[Solara Webview] Sent focus-code message to extension');
              e.preventDefault();
              return;
            }
          }

          target = target.parentElement;
          depth++;
        }
        
        console.log('[Solara Webview] No suitable attribute found after checking', depth, 'elements');
      });

      injectHighlightStyles(iframeDoc);
      console.log('[Solara Webview] Click handler setup complete');
    });
  }

  function injectHighlightStyles(iframeDoc) {
    console.log('[Solara Webview] injectHighlightStyles called');
    
    const styleId = 'vscode-highlight-styles';
    if (iframeDoc.getElementById(styleId)) {
      console.log('[Solara Webview] Highlight styles already injected');
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
    console.log('[Solara Webview] Highlight styles injected successfully');
  }

  console.log('[Solara Webview] Setting up initial iframe click handler');
  setupIframeClickHandler();

  console.log('[Solara Webview] Setting up MutationObserver for dynamic iframe additions');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.id === 'preview-frame') {
          console.log('[Solara Webview] MutationObserver detected new iframe, setting up click handler');
          setupIframeClickHandler();
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[Solara Webview] Script initialization complete');
})();
