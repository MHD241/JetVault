(() => {
  // JetVault compatibility shim: the fast gallery now handles visible-card
  // view counts itself. No body-wide MutationObserver is installed.
  if (window.__JETVAULT_GALLERY_VIEWS_V11__) return;
  window.__JETVAULT_GALLERY_VIEWS_V11__ = true;

  const clean = (root = document) => {
    root.querySelectorAll?.('.archive-stamp').forEach(node => {
      node.textContent = (node.textContent || '').replace(/^SA\s*\/\s*/i, 'JV / ');
    });
    root.querySelectorAll?.('.lightbox-origin').forEach(node => {
      node.textContent = (node.textContent || '').replace(/SCOTTISH\.AERO/gi, 'JETVAULT');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => clean(), { once: true });
  } else clean();
})();
