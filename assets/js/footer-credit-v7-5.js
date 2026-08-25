(() => {
  if (window.__SA_BUILD_CREDIT_V75__) return;
  window.__SA_BUILD_CREDIT_V75__ = true;

  function mount() {
    document.querySelectorAll('.site-nav').forEach(nav => {
      if (!nav.querySelector('a[href="missions.html"]')) {
        const link = document.createElement('a');
        link.href = 'missions.html';
        link.textContent = 'Missions';
        const games = nav.querySelector('a[href="games.html"]');
        if (games) games.insertAdjacentElement('afterend', link);
        else nav.append(link);
      }
      const page = location.pathname.split('/').pop() || 'index.html';
      nav.querySelectorAll('a').forEach(a => {
        if (a.getAttribute('href') === page) a.setAttribute('aria-current','page');
      });
    });

    document.querySelectorAll('.site-footer .footer-col').forEach(col => {
      const games = col.querySelector('a[href="games.html"]');
      if (games && !col.querySelector('a[href="missions.html"]')) {
        const a = document.createElement('a');
        a.href='missions.html';
        a.textContent='Daily missions';
        games.insertAdjacentElement('afterend',a);
      }
    });

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