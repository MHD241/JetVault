(() => {
  const backend = window.ScottishAeroBackend;
  const local = window.SCOTTISH_AERO;
  if (!backend || !local) return;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const requested = new URLSearchParams(location.search).get('photographer') || local.photographers[0]?.id;
  const el = selector => document.querySelector(selector);
  const tabs = [...document.querySelectorAll('[data-profile-tab]')];
  const panels = [...document.querySelectorAll('[data-profile-panel]')];

  function avatarMarkup(person) {
    return person.avatar ? `<img src="${esc(person.avatar)}" alt="${esc(person.name)} profile photo">` : `<span>${esc(person.initials)}</span>`;
  }

  function render(data) {
    const person = data.photographers.find(p => p.id === requested) || data.photographers[0];
    if (!person) return;
    const shots = data.photos.filter(p => p.photographer === person.id || p.photographerName === person.name);
    const posts = (data.posts || []).filter(p => p.photographer === person.id || p.photographerName === person.name);
    const airports = new Set(shots.map(p => p.airport).filter(a => a && a !== 'Unknown')).size;
    const cover = shots[0]?.src || '';

    document.title = `${person.name} — Scottish.aero`;
    el('[data-profile-name]').textContent = person.name;
    el('[data-profile-role]').textContent = person.role || 'Scottish.aero photographer';
    el('[data-profile-bio]').textContent = person.bio || 'Scottish.aero photographer.';
    el('[data-profile-avatar]').innerHTML = avatarMarkup(person);
    el('[data-profile-photos]').textContent = shots.length;
    el('[data-profile-posts]').textContent = posts.length;
    el('[data-profile-airports]').textContent = airports;
    el('[data-tab-post-count]').textContent = posts.length;
    el('[data-tab-photo-count]').textContent = shots.length;
    const coverEl = el('[data-profile-cover]');
    coverEl.innerHTML = cover ? `<img src="${esc(cover)}" alt="${esc(person.name)} aviation photography" fetchpriority="high" decoding="async">` : '<div class="creator-profile-hero__fallback"></div>';

    const postFeed = el('[data-profile-posts]');
    postFeed.innerHTML = posts.length ? posts.map((post, i) => `
      <article class="crew-post" data-reveal style="--delay:${Math.min(i, 6) * 55}ms">
        <div class="crew-post__top"><div class="creator-avatar creator-avatar--sm">${avatarMarkup(person)}</div><div><b>${esc(person.name)}</b><span>${esc(post.date)}</span></div><em>POST / ${String(i + 1).padStart(2,'0')}</em></div>
        <div class="crew-post__copy"><h2>${esc(post.title)}</h2><p>${esc(post.body)}</p></div>
        ${post.image ? `<div class="crew-post__image"><img src="${esc(post.image)}" alt="${esc(post.imageAlt)}" loading="lazy" decoding="async"></div>` : ''}
      </article>`).join('') : `<div class="profile-empty-state" data-reveal><span>NO POSTS YET</span><h2>${esc(person.name.split(' ')[0])}'s flight log is quiet.</h2><p>When ${esc(person.name.split(' ')[0])} publishes an update from the crew dashboard, it will appear here automatically.</p></div>`;

    const photoGrid = el('[data-profile-photo-grid]');
    photoGrid.innerHTML = shots.length ? shots.map((photo, i) => `
      <a class="profile-photo-card" href="gallery.html#photo-${esc(photo.id)}" data-reveal style="--delay:${Math.min(i, 8) * 35}ms">
        <img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy" decoding="async"><span class="archive-stamp">SA / ${String(data.photos.indexOf(photo) + 1).padStart(5,'0')}</span>
        <div><b>${esc(photo.reg)}</b><span>${esc(photo.airline)} · ${esc(photo.aircraft)}</span></div>
      </a>`).join('') : `<div class="profile-empty-state"><span>ARCHIVE EMPTY</span><h2>First photograph coming soon.</h2></div>`;

    document.querySelectorAll('[data-reveal]').forEach(node => requestAnimationFrame(() => node.classList.add('is-visible')));
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(item => item.classList.toggle('is-active', item === tab));
    panels.forEach(panel => { panel.hidden = panel.dataset.profilePanel !== tab.dataset.profileTab; });
  }));

  render(local);
  if (backend.configured) backend.getData().then(render).catch(() => {});
})();
