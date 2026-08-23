(() => {
  const backend = window.ScottishAeroBackend;
  const local = window.SCOTTISH_AERO;
  if (!backend || !local) return;

  const hero = document.querySelector('[data-hero-image]');
  const gallery = document.querySelector('[data-home-gallery]');
  const potw = document.querySelector('[data-potw]');
  const people = document.querySelector('[data-home-people]');

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function render(data) {
    const featured = data.photos.find(p => p.featured) || data.photos[0];
    if (hero && featured && hero.src !== new URL(featured.src, location.href).href) {
      hero.src = featured.src;
      hero.alt = featured.alt;
    }

    if (gallery) {
      gallery.innerHTML = data.photos.slice(0, 6).map((photo, index) => `
        <a class="home-shot" href="gallery.html#photo-${esc(photo.id)}" data-tilt data-reveal style="--delay:${index * 45}ms">
          <img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'low'}">
          <span class="archive-stamp">SA / ${String(data.photos.indexOf(photo) + 1).padStart(5,'0')}</span>
          <span class="home-shot__meta"><b>${esc(photo.reg)}</b><span>${esc(photo.airline)}<br>${esc(photo.aircraft)}</span></span>
        </a>`).join('');
      gallery.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
    }

    if (potw && featured) {
      potw.innerHTML = `
        <div class="potw__image"><img src="${esc(featured.src)}" alt="${esc(featured.alt)}" loading="lazy" decoding="async"></div>
        <div class="potw__content">
          <span class="eyebrow">Photo of the week · Scottish.aero</span>
          <h2>${esc(featured.reg)}</h2>
          <p>${esc(featured.aircraft)} — ${esc(featured.airline)}. ${esc(featured.caption || '')}</p>
          <div class="potw__credit"><span>Photographed by</span><strong>${esc(featured.photographerName || 'Unknown')}</strong></div>
          <a class="text-link" href="gallery.html#photo-${esc(featured.id)}">Open photograph <span>↗</span></a>
        </div>`;
    }

    if (people) {
      people.innerHTML = data.photographers.map((person, i) => {
        const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
        return `<a class="person-card" href="gallery.html?photographer=${encodeURIComponent(person.id)}" data-reveal style="--delay:${i * 70}ms">
          <div class="person-card__avatar">${esc(person.initials)}</div><span class="eyebrow">${esc(person.role)}</span>
          <h3>${esc(person.name)}</h3><p>${esc(person.bio)}</p>
          <span class="person-card__stats"><span>${shots.length} photograph${shots.length === 1 ? '' : 's'}</span><span>View work ↗</span></span>
        </a>`;
      }).join('');
      people.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
    }
  }

  // First paint uses bundled data instantly. The live archive refreshes quietly afterwards.
  render(local);
  if (backend.configured) backend.getData().then(data => render(data)).catch(() => {});
})();
