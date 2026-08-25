(() => {
  if (window.__SCOTTISH_AERO_DISCOVER_V802__) return;
  window.__SCOTTISH_AERO_DISCOVER_V802__ = true;

  // Safari repaint safety: Discover is dynamic, so disable shared content-visibility containment.
  document.querySelectorAll('.discover-page .section').forEach(el=>{ el.style.contentVisibility='visible'; el.style.contain='none'; });

  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  if (!backend) return;

  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  let data = { photos: [], photographers: [] };
  let counts = {};

  const code = (photo, i) => `SA / ${String(i + 1).padStart(5, '0')}`;

  // Dynamic Discover cards are created AFTER main.js registers its IntersectionObserver.
  // Therefore we explicitly reveal newly inserted cards here.
  function revealDynamic(root) {
    if (!root) return;
    const nodes = [];
    if (root.matches?.('[data-reveal]')) nodes.push(root);
    nodes.push(...root.querySelectorAll?.('[data-reveal]') || []);
    requestAnimationFrame(() => {
      nodes.forEach((node, i) => {
        if (!node.style.getPropertyValue('--delay')) {
          node.style.setProperty('--delay', `${Math.min(i, 8) * 35}ms`);
        }
        node.classList.add('is-visible');
      });
    });
  }

  function setHTML(holder, markup) {
    if (!holder) return;
    holder.innerHTML = markup;
    revealDynamic(holder);
  }

  const photoCard = (p, { large = false } = {}) => `
    <a class="discover-photo ${large ? 'discover-photo--large' : ''} is-visible"
       href="gallery.html?photo=${encodeURIComponent(p.id)}" data-reveal>
      <div class="discover-photo__image">
        <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">
        <span>${esc(code(p, data.photos.indexOf(p)))}</span>
        ${p.isCrew ? '<b>SCOTTISH.AERO CREW</b>' : '<b>COMMUNITY</b>'}
      </div>
      <div class="discover-photo__copy">
        <small>${esc(p.airport)} · ${esc(p.date)}</small>
        <h3>${esc(p.aircraft)}</h3>
        <p>${esc(p.airline)} · ${esc(p.reg)}</p>
        <div>
          <span>by ${esc(p.photographerName)}</span>
          <em>♥ ${counts[p.id]?.likes || 0} · ◌ ${counts[p.id]?.comments || 0}</em>
        </div>
      </div>
    </a>`;

  const avatar = p => p.avatar
    ? `<img src="${esc(p.avatar)}" alt="${esc(p.name)}">`
    : `<span>${esc(String(p.name || 'SA').split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase())}</span>`;

  const personCard = p => `
    <a class="community-creator is-visible"
       href="profile.html?photographer=${encodeURIComponent(p.username || p.id)}" data-reveal>
      <div class="creator-avatar creator-avatar--lg">${avatar(p)}</div>
      <div>
        <span>${p.isCrew ? 'SCOTTISH.AERO CREW' : 'GLOBAL PHOTOGRAPHER'}</span>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.location || p.bio || 'Aviation photographer')}</p>
      </div>
      <b>View profile ↗</b>
    </a>`;

  function score(p) {
    const c = counts[p.id] || {};
    const age = Math.max(0, (Date.now() - new Date(p.createdAt || 0)) / 86400000);
    return (c.likes || 0) * 3 + (c.comments || 0) * 2 + (p.featured ? 8 : 0) + Math.max(0, 7 - age);
  }

  function renderTrending() {
    const holder = $('[data-trending-grid]');
    const ranked = [...data.photos].sort((a,b) => score(b) - score(a)).slice(0,5);
    setHTML(holder, ranked.length
      ? ranked.map((p,i) => photoCard(p, { large: i === 0 })).join('')
      : '<div class="admin-empty">The archive is warming up.</div>');
  }

  function renderLatest() {
    const holder = $('[data-latest-grid]');
    const list = [...data.photos]
      .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0,8);
    setHTML(holder, list.length
      ? list.map(p => photoCard(p)).join('')
      : '<div class="admin-empty">No approved photography yet.</div>');
  }

  function renderCrew() {
    const holder = $('[data-crew-strip]');
    const crew = data.photographers.filter(p => p.isCrew);
    setHTML(holder, crew.length
      ? crew.map(personCard).join('')
      : '<div class="admin-empty">Crew profiles are temporarily unavailable.</div>');
  }

  function renderCommunity() {
    const holder = $('[data-community-creators]');
    const people = data.photographers.filter(p => !p.isCrew).slice(0,8);
    setHTML(holder, people.length
      ? people.map(personCard).join('')
      : `<article class="community-empty is-visible" data-reveal>
          <span class="eyebrow">Boarding now</span>
          <h3>The global gallery has just opened.</h3>
          <p>Be one of the first photographers outside the founding Scottish.aero Crew.</p>
          <a class="solid-button" href="account.html?mode=signup">Create a profile</a>
        </article>`);
  }

  function renderAll(list) {
    const holder = $('[data-discover-all]');
    setHTML(holder, list.length
      ? list.slice(0,30).map((p,i) => `
          <a class="photo-card photo-card--discover is-visible"
             href="gallery.html?photo=${encodeURIComponent(p.id)}"
             data-reveal style="--delay:${Math.min(i,6)*35}ms">
            <div class="photo-card__image">
              <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">
              <span class="archive-stamp">${code(p, data.photos.indexOf(p))}</span>
              ${p.isCrew ? '<span class="crew-photo-badge">CREW</span>' : ''}
            </div>
            <div class="photo-card__meta">
              <span>${esc(p.airline)}</span>
              <b>${esc(p.aircraft)}</b>
              <small>${esc(p.photographerName)} · ♥ ${counts[p.id]?.likes || 0}</small>
            </div>
          </a>`).join('')
      : '<div class="admin-empty">No matching frames.</div>');
  }

  async function renderFollowing() {
    const section = $('[data-following-section]');
    const holder = $('[data-following-feed]');
    if (!section || !holder || !social) return;

    const user = await social.getUser().catch(() => null);
    if (!user) return;

    const db = await backend.ensureClient();
    if (!db) return;

    const { data: follows, error } = await db
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    if (error) {
      console.warn('Discover following feed failed', error);
      return;
    }

    const ids = (follows || []).map(x => x.following_id);
    if (!ids.length) return;

    const list = data.photos.filter(p => ids.includes(p.ownerId)).slice(0,10);
    if (!list.length) return;

    section.hidden = false;
    setHTML(holder, list.map(p => photoCard(p)).join(''));
    revealDynamic(section);
  }

  function renderFailure(err) {
    console.warn('Discover failed', err);
    const holders = [
      $('[data-trending-grid]'),
      $('[data-crew-strip]'),
      $('[data-latest-grid]'),
      $('[data-community-creators]'),
      $('[data-discover-all]')
    ];
    holders.forEach(holder => {
      if (holder && !holder.children.length) {
        holder.innerHTML = '<div class="admin-empty">Could not load this section. Refresh the page to try again.</div>';
      }
    });
    const following = $('[data-following-section]');
    if (following) following.hidden = true;
  }

  async function boot() {
    data = await backend.getData();

    if (!data || !Array.isArray(data.photos) || !Array.isArray(data.photographers)) {
      throw new Error('Discover received invalid archive data.');
    }

    counts = social
      ? await social.getCounts(data.photos.map(p => p.id)).catch(() => ({}))
      : {};

    const photoCount = $('[data-discover-photo-count]');
    const creatorCount = $('[data-discover-creator-count]');
    if (photoCount) photoCount.textContent = data.photos.length;
    if (creatorCount) creatorCount.textContent = data.photographers.length;

    renderTrending();
    renderLatest();
    renderCrew();
    renderCommunity();
    renderAll(data.photos);
    await renderFollowing();

    // Final safety pass: no dynamically created Discover card may remain invisible.
    revealDynamic(document.querySelector('main'));
  }

  $('[data-discover-search]')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const list = !q ? data.photos : data.photos.filter(p =>
      [p.aircraft,p.airline,p.reg,p.airport,p.photographerName]
        .some(v => String(v || '').toLowerCase().includes(q))
    );
    renderAll(list);
  });

  boot().catch(renderFailure);
})();