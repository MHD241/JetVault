(() => {
  if (window.__SA_BUILD_CREDIT_V75__) return;
  window.__SA_BUILD_CREDIT_V75__ = true;

  function mount() {
    document.querySelectorAll('.site-footer .site-shell').forEach(shell => {
      if (shell.querySelector('[data-build-credit]')) return;
      const row = document.createElement('div');
      row.className = 'sa-build-credit';
      row.dataset.buildCredit = '';
      row.innerHTML = '<span>Design &amp; development by <b>Mohammed</b></span><a href="credits.html">Built by Mohammed · Website enquiries ↗</a>';
      shell.append(row);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();