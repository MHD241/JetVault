(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const progress = document.querySelector('[data-scroll-progress]');
  const heroMedia = document.querySelector('[data-hero-media]');
  const glow = document.querySelector('[data-cursor-glow]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer:fine)');

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  navToggle?.addEventListener('click', () => {
    const open = !body.classList.contains('nav-open');
    body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    body.classList.remove('nav-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .08, rootMargin: '0px 0px -3% 0px' }) : null;

  document.querySelectorAll('[data-reveal]').forEach(el => {
    if (observer) observer.observe(el); else el.classList.add('is-visible');
  });

  let ticking = false;
  function updateFrame() {
    ticking = false;
    const y = scrollY;
    header?.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }
    if (heroMedia && !reduceMotion.matches) {
      heroMedia.style.transform = `scale(${1.025 + Math.min(y / 26000, .035)}) translate3d(0,${Math.min(y * .038, 20)}px,0)`;
    }
  }
  function requestFrame() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateFrame);
  }
  updateFrame();
  addEventListener('scroll', requestFrame, { passive: true });
  addEventListener('resize', requestFrame, { passive: true });

  if (glow && finePointer.matches && !reduceMotion.matches) {
    let pointerTicking = false;
    let px = 0, py = 0;
    addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY;
      if (pointerTicking) return;
      pointerTicking = true;
      requestAnimationFrame(() => {
        glow.style.setProperty('--x', `${px}px`);
        glow.style.setProperty('--y', `${py}px`);
        glow.classList.add('is-active');
        pointerTicking = false;
      });
    }, { passive: true });
  }

  if (finePointer.matches && !reduceMotion.matches) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      let tiltTicking = false, x = 0, y = 0;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        x = (e.clientX - r.left) / r.width - .5;
        y = (e.clientY - r.top) / r.height - .5;
        if (tiltTicking) return;
        tiltTicking = true;
        requestAnimationFrame(() => {
          card.style.transform = `perspective(900px) rotateX(${-y * 2}deg) rotateY(${x * 2.5}deg) translate3d(0,-3px,0)`;
          tiltTicking = false;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => card.style.transform = '');
    });
  }

  // Content is already visible underneath; this is a quick polish, not a blocking intro.
  requestAnimationFrame(() => body.classList.add('page-ready'));
  window.ScottishAeroBackend?.trackVisit();
})();
