(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const progress = document.querySelector('[data-scroll-progress]');
  const heroMedia = document.querySelector('[data-hero-media]');
  const glow = document.querySelector('[data-cursor-glow]');

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  const updateHeader = () => header?.classList.toggle('is-scrolled', scrollY > 24);
  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });

  navToggle?.addEventListener('click', () => {
    const open = !body.classList.contains('nav-open');
    body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    body.classList.remove('nav-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));

  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        reveal.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -4% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => reveal.observe(el));

  const updateMotion = () => {
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    }
    if (heroMedia && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroMedia.style.transform = `scale(${1.035 + Math.min(scrollY / 20000, .05)}) translateY(${Math.min(scrollY * .055, 28)}px)`;
    }
  };
  updateMotion();
  addEventListener('scroll', updateMotion, { passive: true });

  if (glow && matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener('pointermove', e => {
      glow.style.setProperty('--x', `${e.clientX}px`);
      glow.style.setProperty('--y', `${e.clientY}px`);
      glow.classList.add('is-active');
    }, { passive: true });
  }

  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(900px) rotateX(${-y * 2.7}deg) rotateY(${x * 3.4}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });

  requestAnimationFrame(() => body.classList.add('page-ready'));
  window.ScottishAeroBackend?.trackVisit();
})();
