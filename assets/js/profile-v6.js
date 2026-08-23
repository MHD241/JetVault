(() => {
  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
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

  async function renderFollow(person) {
    const wrap = el('[data-profile-social]');
    if (!wrap || !social || !person.accountId) {
      if (wrap) wrap.innerHTML = '<span class="profile-follow-note">Social profile syncing…</span>';
      return;
    }
    const state = await social.getFollowState(person.accountId).catch(() => null);
    if (!state) return;
    const self = state.user?.id === person.accountId;
    wrap.innerHTML = `<div class="profile-network"><span><b data-follower-count>${state.followers}</b> followers</span><span><b>${state.following}</b> following</span></div>${self ? '<span class="profile-you-badge">YOUR PROFILE</span>' : `<button class="follow-button ${state.followed ? 'is-following' : ''}" type="button" data-follow-button>${state.followed ? 'Following' : 'Follow'} <span>${state.followed ? '✓' : '+'}</span></button>`}`;
    const btn = wrap.querySelector('[data-follow-button]');
    btn?.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const next = await social.toggleFollow(person.accountId);
        if (next) {
          wrap.querySelector('[data-follower-count]').textContent = next.followers;
          btn.classList.toggle('is-following', next.followed);
          btn.innerHTML = `${next.followed ? 'Following' : 'Follow'} <span>${next.followed ? '✓' : '+'}</span>`;
        }
      } finally { btn.disabled = false; }
    });
  }

  async function enhancePostSocial(posts) {
    if (!social || !backend.configured) return;
    const counts = await social.getCounts(posts.map(p => p.id)).catch(() => ({}));
    posts.forEach(post => {
      const card = document.querySelector(`[data-post-id="${CSS.escape(String(post.id))}"]`);
      if (!card) return;
      const c = counts[post.id] || { likes: 0, comments: 0 };
      const summary = card.querySelector('[data-post-social-summary]');
      if (summary) summary.innerHTML = `<span>♥ ${c.likes}</span><span>◌ ${c.comments}</span>`;
      const mount = card.querySelector('[data-post-social]');
      if (mount) social.mountContentSocial(mount, post.id);
    });
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
      <article class="crew-post crew-post--social" data-post-id="${esc(post.id)}" data-reveal style="--delay:${Math.min(i, 6) * 55}ms">
        <div class="crew-post__top"><div class="creator-avatar creator-avatar--sm">${avatarMarkup(person)}</div><div><b>${esc(person.name)}</b><span>${esc(post.date)}</span></div><em>POST / ${String(i + 1).padStart(2,'0')}</em></div>
        <div class="crew-post__copy"><h2>${esc(post.title)}</h2><p>${esc(post.body)}</p></div>
        ${post.image ? `<div class="crew-post__image"><img src="${esc(post.image)}" alt="${esc(post.imageAlt)}" loading="lazy" decoding="async"></div>` : ''}
        <div class="crew-post__social-summary" data-post-social-summary><span>♥ 0</span><span>◌ 0</span></div>
        <div class="crew-post__social" data-post-social></div>
      </article>`).join('') : `<div class="profile-empty-state" data-reveal><span>NO POSTS YET</span><h2>${esc(person.name.split(' ')[0])}'s flight log is quiet.</h2><p>When ${esc(person.name.split(' ')[0])} publishes an update from the crew dashboard, it will appear here automatically.</p></div>`;

    const photoGrid = el('[data-profile-photo-grid]');
    photoGrid.innerHTML = shots.length ? shots.map((photo, i) => `
      <a class="profile-photo-card" href="gallery.html#photo-${esc(photo.id)}" data-reveal style="--delay:${Math.min(i, 8) * 35}ms">
        <img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy" decoding="async"><span class="archive-stamp">SA / ${String(data.photos.indexOf(photo) + 1).padStart(5,'0')}</span>
        <div><b>${esc(photo.reg)}</b><span>${esc(photo.airline)} · ${esc(photo.aircraft)}</span></div>
      </a>`).join('') : `<div class="profile-empty-state"><span>ARCHIVE EMPTY</span><h2>First photograph coming soon.</h2></div>`;

    document.querySelectorAll('[data-reveal]').forEach(node => requestAnimationFrame(() => node.classList.add('is-visible')));
    renderFollow(person);
    enhancePostSocial(posts);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(item => item.classList.toggle('is-active', item === tab));
    panels.forEach(panel => { panel.hidden = panel.dataset.profilePanel !== tab.dataset.profileTab; });
  }));

  render(local);
  if (backend.configured) backend.getData().then(render).catch(() => {});
})();
