/**
 * Solara Preview Client
 * 
 * A standalone client script for React/Next.js apps to enable interactive
 * bidirectional communication with the Solara Visual Mapper VS Code extension.
 * 
 * Usage:
 *   import { attachSolaraPreviewClient } from './path/to/solaraPreviewClient.js';
 *   
 *   attachSolaraPreviewClient({
 *     highlightClass: 'solara-preview-highlight' // optional
 *   });
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SolaraPreviewClient = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  const CHANNEL = 'solara-visual-mapper';
  let currentHighlightedElement = null;
  let highlightClassName = 'solara-preview-highlight';
  let isInitialized = false;

  function attachSolaraPreviewClient(options) {
    options = options || {};
    highlightClassName = options.highlightClass || 'solara-preview-highlight';

    if (isInitialized) {
      console.warn('[Solara] Preview client already initialized');
      return;
    }

    isInitialized = true;

    injectHighlightStyles();
    setupMessageListener();
    setupClickHandler();
    sendHelloMessage();

    console.log('[Solara] Preview client initialized');
  }

  function sendHelloMessage() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        channel: CHANNEL,
        type: 'hello-from-client'
      }, '*');
      console.log('[Solara] Sent hello-from-client message');
    }
  }

  function setupMessageListener() {
    window.addEventListener('message', function(event) {
      const message = event.data;

      if (!message || message.channel !== CHANNEL) {
        return;
      }

      switch (message.type) {
        case 'hello-from-webview':
          console.log('[Solara] Received hello-from-webview');
          sendHelloMessage();
          break;

        case 'highlight-element':
          if (message.selector) {
            highlightElement(message.selector);
          }
          break;

        default:
          break;
      }
    });

    console.log('[Solara] Message listener attached');
  }

  function highlightElement(selector) {
    if (currentHighlightedElement) {
      currentHighlightedElement.classList.remove(highlightClassName);
      currentHighlightedElement = null;
    }

    try {
      const element = document.querySelector(selector);
      if (element) {
        element.classList.add(highlightClassName);
        currentHighlightedElement = element;

        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        console.log('[Solara] Highlighted element:', selector);
      }
    } catch (e) {
      console.warn('[Solara] Error highlighting element:', e);
    }
  }

  function setupClickHandler() {
    document.addEventListener('click', function(e) {
      let target = e.target;

      while (target && target !== document.body) {
        const dataCodeId = target.getAttribute('data-code-id');
        if (dataCodeId) {
          sendFocusCodeMessage('data-code-id', dataCodeId);
          e.preventDefault();
          return;
        }

        const id = target.getAttribute('id');
        if (id) {
          sendFocusCodeMessage('id', id);
          e.preventDefault();
          return;
        }

        const className = target.getAttribute('class');
        if (className) {
          const classes = className.trim().split(/\s+/);
          if (classes.length > 0 && classes[0]) {
            sendFocusCodeMessage('class', classes[0]);
            e.preventDefault();
            return;
          }
        }

        target = target.parentElement;
      }
    });

    console.log('[Solara] Click handler attached');
  }

  function sendFocusCodeMessage(attributeType, value) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        channel: CHANNEL,
        type: 'focus-code',
        attributeType: attributeType,
        value: value
      }, '*');

      console.log('[Solara] Sent focus-code message:', attributeType, value);
    }
  }

  function injectHighlightStyles() {
    const styleId = 'solara-preview-highlight-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${highlightClassName} {
        outline: 3px solid #007acc !important;
        outline-offset: 2px !important;
        background-color: rgba(0, 122, 204, 0.1) !important;
        transition: all 0.2s ease-in-out !important;
      }
    `;

    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.head.appendChild(style);
      });
    }
  }

  return {
    attachSolaraPreviewClient: attachSolaraPreviewClient
  };
}));
