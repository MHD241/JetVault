(() => {
  if (window.__SA_BUILD_CREDIT_V75__) return;
  window.__SA_BUILD_CREDIT_V75__ = true;

  function ensureExploreAssets() {
    if (!document.querySelector('link[href="assets/css/styles-v8-1-2.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/styles-v8-1-2.css';
      document.head.append(link);
    }
    if (!document.querySelector('script[src="assets/js/explore-v8-1-2.js"]')) {
      const script = document.createElement('script');
      script.src = 'assets/js/explore-v8-1-2.js';
      script.async = false;
      document.body.append(script);
    }
  }


  function ensureV10Assets() {
    if (!document.querySelector('link[href="assets/css/styles-v10.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/styles-v10.css';
      document.head.append(link);
    }
    if (!document.querySelector('script[src="assets/js/economy-v10.js"]')) {
      const script = document.createElement('script');
      script.src = 'assets/js/economy-v10.js';
      script.async = false;
      document.body.append(script);
    }
  }

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

      let world = nav.querySelector('a[href="airports.html"]');
      if (world) world.textContent = 'World';
      else {
        world = document.createElement('a');
        world.href = 'airports.html';
        world.textContent = 'World';
        const gallery = nav.querySelector('a[href="gallery.html"]');
        if (gallery) gallery.insertAdjacentElement('afterend', world);
        else nav.insertAdjacentElement('afterbegin', world);
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
      const gallery = col.querySelector('a[href="gallery.html"]');
      if (gallery && !col.querySelector('a[href="airports.html"]')) {
        const a = document.createElement('a');
        a.href='airports.html';
        a.textContent='World Map';
        gallery.insertAdjacentElement('afterend',a);
      }
      if (!col.querySelector('a[href="aerocoins.html"]') && (games || gallery)) {
        const a = document.createElement('a');
        a.href='aerocoins.html';
        a.textContent='AeroCoins';
        col.append(a);
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

    const ribbon = document.querySelector('[data-development-ribbon]');
    const version = ribbon?.querySelector('b');
    if (version) version.textContent = 'V10 · COMMUNITY ECONOMY';

    ensureExploreAssets();
    ensureV10Assets();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
