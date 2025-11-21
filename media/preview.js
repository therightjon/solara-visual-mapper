(function() {
  const vscode = acquireVsCodeApi();
  
  let currentHighlightedElement = null;

  window.addEventListener('message', (event) => {
    const message = event.data;
    
    if (message.type === 'highlight-element' && message.selector) {
      highlightElement(message.selector);
    }
  });

  function highlightElement(selector) {
    const iframe = document.getElementById('preview-frame');
    if (!iframe) {
      return;
    }

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
