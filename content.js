/**
 * BlockMedia - Content Script for DOM Purge
 */

function purgeDOM() {
  chrome.storage.local.get(['blockConfig'], (result) => {
    const config = result.blockConfig;
    if (!config || !config.domPurge) return;

    const { mode, domains } = config;
    const currentHost = window.location.hostname.replace(/^www\./, '');

    let shouldPurge = false;
    if (mode === 'whitelist') {
      shouldPurge = !domains.includes(currentHost);
    } else {
      shouldPurge = domains.includes(currentHost);
    }

    if (!shouldPurge) return;

    const selectors = [
      'img', 'video', 'audio', 'picture', 'source', 'canvas', 
      '[style*="background-image"]', 'object', 'embed'
    ];

    const removeElements = () => {
      document.querySelectorAll(selectors.join(',')).forEach(el => {
        // For background images, we might want to just clear the style
        if (el.hasAttribute('style') && el.style.backgroundImage) {
          el.style.backgroundImage = 'none';
        } else {
          el.remove();
        }
      });
    };

    // Initial purge
    removeElements();

    // Observe changes
    const observer = new MutationObserver((mutations) => {
      removeElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', purgeDOM);
} else {
  purgeDOM();
}
