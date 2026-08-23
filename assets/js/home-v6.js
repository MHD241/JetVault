(() => {
  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  const local = window.SCOTTISH_AERO;
  if (!backend || !local) return;

  const hero = document.querySelector('[data-hero-image]');
  const gallery = document.querySelector('[data-home-gallery]');
  const potw = document.querySelector('[data-potw]');
  const people = document.querySelector('[data-home-people]');
  const postsSection = document.querySelector('[data-home-posts-section]');
  const postsGrid = document.querySelector('[data-home-posts]');
  const heroCount = document.querySelector('[data-hero-photo-count]');

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const personHref = person => `profile.html?photographer=${encodeURIComponent(person.id)}`;

  function avatar(person) {
    return person.avatar ? `<img src="${esc(person.avatar)}" alt="${esc(person.name)} profile photo" loading="lazy" decoding="async">` : `<span>${esc(person.initials)}</span>`;
  }

  function render(data) {
    const featured = data.photos.find(p => p.featured) || data.photos[0];
    if (heroCount) heroCount.textContent = String(data.photos.length).padStart(2, '0');
    if (hero && featured && hero.src !== new URL(featured.src, location.href).href) {
      hero.src = featured.src;
      hero.alt = featured.alt;
    }

    if (gallery) {
      gallery.innerHTML = data.photos.slice(0, 6).map((photo, index) => `
        <a class="home-shot" href="gallery.html#photo-${esc(photo.id)}" data-tilt data-reveal style="--delay:${index * 45}ms">
          <img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'low'}">
          <span class="archive-stamp">SA / ${String(data.photos.indexOf(photo) + 1).padStart(5,'0')}</span><span class="home-shot__social" data-home-photo-social="${esc(photo.id)}">♥ 0 · ◌ 0</span>
          <span class="home-shot__meta"><b>${esc(photo.reg)}</b><span>${esc(photo.airline)}<br>${esc(photo.aircraft)}</span></span>
        </a>`).join('');
      gallery.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
      if (social && backend.configured) social.getCounts(data.photos.slice(0,6).map(p => p.id)).then(counts => { gallery.querySelectorAll('[data-home-photo-social]').forEach(node => { const c = counts[node.dataset.homePhotoSocial] || {likes:0,comments:0}; node.textContent = `♥ ${c.likes} · ◌ ${c.comments}`; }); }).catch(() => {});
    }

    if (potw && featured) {
      potw.innerHTML = `
        <div class="potw__image"><img src="${esc(featured.src)}" alt="${esc(featured.alt)}" loading="lazy" decoding="async"><span class="potw__grid" aria-hidden="true"></span></div>
        <div class="potw__content">
          <span class="eyebrow">Photo of the week · Scottish.aero</span>
          <h2>${esc(featured.reg)}</h2>
          <p>${esc(featured.aircraft)} — ${esc(featured.airline)}. ${esc(featured.caption || '')}</p>
          <div class="potw__credit"><span>Photographed by</span><strong>${esc(featured.photographerName || 'Unknown')}</strong></div>
          <div class="potw__actions"><a class="text-link" href="gallery.html#photo-${esc(featured.id)}">Open photograph <span>↗</span></a><a class="text-link text-link--muted" href="profile.html?photographer=${encodeURIComponent(featured.photographer)}">Photographer profile <span>↗</span></a></div>
        </div>`;
    }

    if (people) {
      people.innerHTML = data.photographers.map((person, i) => {
        const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
        const posts = (data.posts || []).filter(p => p.photographerName === person.name || p.photographer === person.id);
        const cover = shots[0]?.src || '';
        return `<a class="person-card person-card--v4" href="${personHref(person)}" data-reveal style="--delay:${i * 70}ms">
          <div class="person-card__cover">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ''}</div>
          <div class="person-card__avatar creator-avatar">${avatar(person)}</div>
          <span class="eyebrow">${esc(person.role)}</span>
          <h3>${esc(person.name)}</h3><p>${esc(person.bio)}</p>
          <span class="person-card__stats"><span>${shots.length} photos · ${posts.length} posts</span><span>Open profile ↗</span></span>
        </a>`;
      }).join('');
      people.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
    }

    const latestPosts = (data.posts || []).slice(0, 3);
    if (postsSection && postsGrid) {
      postsSection.hidden = latestPosts.length === 0;
      if (latestPosts.length) {
        postsGrid.innerHTML = latestPosts.map((post, i) => {
          const person = data.photographers.find(p => p.id === post.photographer) || { id: post.photographer, name: post.photographerName, initials: 'SA', avatar: '' };
          return `<a class="dispatch-card" href="profile.html?photographer=${encodeURIComponent(post.photographer)}" data-reveal style="--delay:${i * 60}ms">
            ${post.image ? `<div class="dispatch-card__image"><img src="${esc(post.image)}" alt="${esc(post.imageAlt)}" loading="lazy" decoding="async"></div>` : '<div class="dispatch-card__signal" aria-hidden="true"><i></i><i></i><i></i></div>'}
            <div class="dispatch-card__copy"><div class="dispatch-card__author"><div class="creator-avatar creator-avatar--xs">${avatar(person)}</div><span>${esc(post.photographerName)}<small>${esc(post.date)}</small></span></div><h3>${esc(post.title)}</h3><p>${esc(post.body)}</p><div class="dispatch-card__social" data-home-post-social="${esc(post.id)}"><span>♥ 0</span><span>◌ 0</span></div><b>Read on profile ↗</b></div>
          </a>`;
        }).join('');
        postsGrid.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
        if (social && backend.configured) social.getCounts(latestPosts.map(p => p.id)).then(counts => { postsGrid.querySelectorAll('[data-home-post-social]').forEach(node => { const c = counts[node.dataset.homePostSocial] || {likes:0,comments:0}; node.innerHTML = `<span>♥ ${c.likes}</span><span>◌ ${c.comments}</span>`; }); }).catch(() => {});
      }
    }
  }

  render(local);
  if (backend.configured) backend.getData().then(render).catch(() => {});
})();
