(() => {
  if (window.__SA_RULES_V751__) return;
  window.__SA_RULES_V751__ = true;

  const blocks = [...document.querySelectorAll('.rule-block[id]')];
  const links = [...document.querySelectorAll('.rules-index a[href^="#"]')];
  const index = document.querySelector('.rules-index');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: .08, rootMargin: '0px 0px -8% 0px' });
    blocks.forEach((block, i) => {
      block.classList.add('rules-reveal');
      if (i < 2) block.classList.add('is-visible');
      reveal.observe(block);
    });
  }

  const update = () => {
    const marker = innerHeight * .34;
    let current = blocks[0];
    for (const block of blocks) {
      if (block.getBoundingClientRect().top <= marker) current = block;
    }

    blocks.forEach(block => block.classList.toggle('is-current', block === current));
    links.forEach(link => {
      const target = link.getAttribute('href').slice(1);
      link.classList.toggle('is-active', target === current?.id);
    });

    if (index) {
      const page = document.documentElement;
      const total = Math.max(1, page.scrollHeight - innerHeight);
      const progress = Math.max(.04, Math.min(1, scrollY / total));
      index.style.setProperty('--rules-progress', progress);
    }
  };

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();

  document.querySelectorAll('.rules-summary-grid article').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--rx', `${e.clientX - r.left}px`);
      card.style.setProperty('--ry', `${e.clientY - r.top}px`);
    });
  });
})();