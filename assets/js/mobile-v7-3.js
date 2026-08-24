(() => {
  if (window.__SCOTTISH_AERO_MOBILE_V73__) return;
  window.__SCOTTISH_AERO_MOBILE_V73__ = true;

  const body = document.body;
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const mobile = matchMedia('(max-width:1050px)');

  function setViewportHeight(){
    const h = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--sa-mobile-vh', `${Math.round(h)}px`);
  }
  setViewportHeight();
  window.visualViewport?.addEventListener('resize', setViewportHeight, {passive:true});
  addEventListener('orientationchange', () => setTimeout(setViewportHeight, 80), {passive:true});

  function syncNav(){
    const open = body.classList.contains('nav-open');
    navToggle?.setAttribute('aria-expanded', String(open));
    navToggle?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (nav) nav.setAttribute('aria-hidden', mobile.matches && !open ? 'true' : 'false');
    if (open) {
      const menu = document.querySelector('[data-community-menu]');
      if (menu) menu.hidden = true;
      document.querySelector('[data-sa-help]')?.classList.remove('is-open');
      document.querySelector('[data-sa-bug]')?.classList.remove('is-open');
    }
  }

  navToggle?.addEventListener('click', () => requestAnimationFrame(syncNav));
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => requestAnimationFrame(syncNav)));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('nav-open')) {
      body.classList.remove('nav-open');
      syncNav();
      navToggle?.focus();
    }
  });
  mobile.addEventListener?.('change', () => {
    if (!mobile.matches) body.classList.remove('nav-open');
    syncNav();
  });
  syncNav();

  // Only one floating utility panel should be open on a phone.
  const help = document.querySelector('[data-sa-help]');
  const bug = document.querySelector('[data-sa-bug]');
  help?.querySelector('[data-help-toggle]')?.addEventListener('click', () => {
    if (help.classList.contains('is-open')) bug?.classList.remove('is-open');
  });
  bug?.querySelector('[data-bug-toggle]')?.addEventListener('click', () => {
    if (bug.classList.contains('is-open')) help?.classList.remove('is-open');
  });

  // V7.3 label without changing the V7.2 shell/database logic.
  const ribbon = document.querySelector('[data-development-ribbon]');
  if (ribbon) {
    const main = ribbon.querySelector('span');
    const sub = ribbon.querySelector('b');
    if (main) main.textContent = 'UNDER DEVELOPMENT';
    if (sub) sub.textContent = 'V7.3 · MOBILE BETA';
  }

  // Prevent decorative layers introduced by future content renders from becoming tap blockers.
  const safeDecorations = () => {
    document.querySelectorAll('.v7-sky,.hero-orbit,.hero-hud,.discover-world,.creator-index-hero__radar,.games-radar,.account-orbit,.home-world-radar,.airspace-line').forEach(el => {
      el.style.pointerEvents = 'none';
    });
  };
  safeDecorations();
  new MutationObserver(safeDecorations).observe(document.body,{childList:true,subtree:true});
})();
