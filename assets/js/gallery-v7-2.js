(() => {
  // JetVault Fast Gallery V12
  // Prevent the legacy body-wide MutationObserver from installing.
  window.__JETVAULT_GALLERY_VIEWS_V11__ = true;

  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  const local = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-gallery-grid]');
  if (!backend || !local || !grid) return;

  const search = document.querySelector('[data-gallery-search]');
  const scope = document.querySelector('[data-scope-filter]');
  const airportFilter = document.querySelector('[data-airport-filter]');
  const airlineFilter = document.querySelector('[data-airline-filter]');
  const photographerSearch = document.querySelector('[data-photographer-search]');
  const count = document.querySelector('[data-gallery-count]');
  const clear = document.querySelector('[data-clear-filters]');
  const modal = document.querySelector('[data-lightbox]');
  const modalInner = modal?.querySelector('[data-lightbox-inner]');
  const params = new URLSearchParams(location.search);

  const PAGE_SIZE = 24;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  let data = local;
  let photos = (local.photos || []).map(p => ({
    ...p,
    isCrew: true,
    fullSrc: p.fullSrc || p.src,
    thumbSrc: p.thumbSrc || p.src
  }));
  let activePhoto = null;
  let visibleCount = PAGE_SIZE;
  let currentList = [];
  let sentinel = null;
  let io = null;
  let renderToken = 0;
  let searchTimer = null;

  const archiveIndex = new Map();
  const socialCache = new Map();
  const viewCache = new Map();

  const unique = vals => [...new Set(vals.filter(v => v && v !== 'Unknown'))]
    .sort((a,b) => a.localeCompare(b));

  function rebuildArchiveIndex() {
    archiveIndex.clear();
    photos.forEach((p, i) => archiveIndex.set(String(p.id), i + 1));
  }

  function archiveNo(p) {
    const n = archiveIndex.get(String(p.id)) || 1;
    return `JV / ${String(n).padStart(5,'0')}`;
  }

  function setOptions(sel, vals, label) {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${label}</option>`;
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.append(o);
    });
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }

  function syncFilters() {
    setOptions(airportFilter, unique(photos.map(p => p.airport)), 'All airports');
    setOptions(airlineFilter, unique(photos.map(p => p.airline)), 'All airlines');
  }

  function filtered() {
    const q = search?.value.trim().toLowerCase() || '';
    const ap = airportFilter?.value || '';
    const air = airlineFilter?.value || '';
    const ph = photographerSearch?.value.trim().toLowerCase() || '';
    const sc = scope?.value || '';

    return photos.filter(p => {
      const hay = [p.reg,p.aircraft,p.airline,p.airport,p.date,p.photographerName,p.caption]
        .join(' ').toLowerCase();
      const photographerHay = [p.photographerName,p.photographer].join(' ').toLowerCase();
      return (!q || hay.includes(q))
        && (!ap || p.airport === ap)
        && (!air || p.airline === air)
        && (!ph || photographerHay.includes(ph))
        && (!sc || (sc === 'crew' ? p.isCrew : !p.isCrew));
    });
  }

  function card(p) {
    const src = p.thumbSrc || p.src || p.fullSrc || '';
    return `<article class="photo-card ${p.isCrew?'photo-card--crew':'photo-card--community'}" id="photo-${esc(p.id)}">
      <button class="photo-card__open" type="button" data-photo-id="${esc(p.id)}" aria-label="Open ${esc(p.airline)} ${esc(p.aircraft)}">
        <img src="${esc(src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async" fetchpriority="low">
        <span class="photo-card__shade"></span>
        <span class="archive-stamp">${archiveNo(p)}</span>
        <span class="gallery-origin-badge ${p.isCrew?'gallery-origin-badge--crew':'gallery-origin-badge--community'}">${p.isCrew?'CREW':'GLOBAL'}</span>
        <span class="photo-card__meta">
          <span class="photo-card__eyebrow">${esc(p.airport)} · ${esc(p.date)}</span>
          <strong>${esc(p.reg)}</strong>
          <span>${esc(p.airline)} · ${esc(p.aircraft)}</span>
          <small>by ${esc(p.photographerName)}</small>
        </span>
        <span class="photo-card__arrow">↗</span>
      </button>
      <div class="photo-card__social" data-card-social="${esc(p.id)}">
        <button class="photo-card__quick-like" type="button" data-quick-like="${esc(p.id)}">
          <span>♡</span><b data-quick-like-count>0</b>
        </button>
        <span class="photo-card__comment-count"><span>◌</span><b data-quick-comment-count>0</b></span>
        <span class="photo-card__view-count" data-jv-view-count><i>◉</i><b>0</b></span>
      </div>
    </article>`;
  }

  async function getViewCounts(ids) {
    const missing = [...new Set(ids.filter(Boolean))].filter(id => !viewCache.has(String(id)));
    if (missing.length && backend.configured) {
      try {
        const db = await backend.ensureClient();
        if (db) {
          const { data, error } = await db.rpc('get_photo_view_counts', { p_photo_ids: missing });
          if (!error) {
            missing.forEach(id => viewCache.set(String(id), 0));
            (data || []).forEach(row => viewCache.set(String(row.photo_id), Number(row.views || 0)));
          }
        }
      } catch (_) {}
    }
    return viewCache;
  }

  async function hydrateCards(ids, token) {
    if (token !== renderToken || !ids.length) return;

    const tasks = [];

    if (social && backend.configured) {
      const missingSocial = ids.filter(id => !socialCache.has(String(id)));
      if (missingSocial.length) {
        tasks.push(
          social.getCounts(missingSocial).then(result => {
            Object.entries(result || {}).forEach(([id, value]) => socialCache.set(String(id), value));
          }).catch(() => {})
        );
      }
    }

    tasks.push(getViewCounts(ids));
    await Promise.all(tasks);
    if (token !== renderToken) return;

    ids.forEach(id => {
      const node = grid.querySelector(`[data-card-social="${CSS.escape(String(id))}"]`);
      if (!node) return;

      const s = socialCache.get(String(id)) || { likes: 0, comments: 0, liked: false };
      const likeBtn = node.querySelector('[data-quick-like]');
      const likeCount = node.querySelector('[data-quick-like-count]');
      const commentCount = node.querySelector('[data-quick-comment-count]');
      if (likeCount) likeCount.textContent = Number(s.likes || 0).toLocaleString('en-GB');
      if (commentCount) commentCount.textContent = Number(s.comments || 0).toLocaleString('en-GB');
      if (likeBtn) {
        likeBtn.classList.toggle('is-active', Boolean(s.liked));
        const heart = likeBtn.querySelector('span');
        if (heart) heart.textContent = s.liked ? '♥' : '♡';
      }

      const view = node.querySelector('[data-jv-view-count] b');
      if (view) view.textContent = Number(viewCache.get(String(id)) || 0).toLocaleString('en-GB');
    });
  }

  function ensureSentinel() {
    if (sentinel?.isConnected) return sentinel;
    sentinel = document.createElement('div');
    sentinel.dataset.gallerySentinel = '';
    sentinel.style.cssText = 'grid-column:1/-1;height:1px;width:100%;pointer-events:none;';
    grid.append(sentinel);

    io?.disconnect();
    io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      if (visibleCount >= currentList.length) return;
      visibleCount = Math.min(currentList.length, visibleCount + PAGE_SIZE);
      appendNextBatch();
    }, { rootMargin: '900px 0px' });
    io.observe(sentinel);
    return sentinel;
  }

  function appendNextBatch() {
    const already = grid.querySelectorAll('.photo-card').length;
    const next = currentList.slice(already, visibleCount);
    if (!next.length) return;

    const marker = sentinel?.isConnected ? sentinel : null;
    const wrap = document.createElement('div');
    wrap.innerHTML = next.map(card).join('');
    const frag = document.createDocumentFragment();
    [...wrap.children].forEach(node => frag.append(node));
    if (marker) grid.insertBefore(frag, marker);
    else grid.append(frag);

    const ids = next.map(p => p.id);
    hydrateCards(ids, renderToken);
  }

  function updateCount() {
    if (!count) return;
    const crew = photos.filter(p => p.isCrew).length;
    const community = photos.length - crew;
    count.textContent = `${currentList.length} photograph${currentList.length===1?'':'s'} · ${crew} crew · ${community} community`;
  }

  function render({ reset = true } = {}) {
    renderToken++;
    if (reset) visibleCount = PAGE_SIZE;
    currentList = filtered();

    grid.replaceChildren();
    sentinel = null;
    appendNextBatch();
    ensureSentinel();
    updateCount();

    const target = params.get('photo');
    if (target && photos.some(p => String(p.id) === String(target)) && !modal?.open) {
      setTimeout(() => openLightbox(target), 50);
    }
  }

  async function quickLike(btn) {
    if (!social) return;
    btn.disabled = true;
    try {
      const state = await social.toggleLike(btn.dataset.quickLike);
      if (!state) return;
      socialCache.set(String(btn.dataset.quickLike), state);
      btn.classList.toggle('is-active', state.liked);
      const heart = btn.querySelector('span');
      const total = btn.querySelector('b');
      if (heart) heart.textContent = state.liked ? '♥' : '♡';
      if (total) total.textContent = Number(state.likes || 0).toLocaleString('en-GB');
      btn.classList.remove('just-liked');
      void btn.offsetWidth;
      btn.classList.add('just-liked');
    } finally {
      btn.disabled = false;
    }
  }

  function openLightbox(id) {
    activePhoto = photos.find(p => String(p.id) === String(id));
    if (!activePhoto || !modal || !modalInner) return;

    const fullSrc = activePhoto.fullSrc || activePhoto.src || activePhoto.thumbSrc || '';
    const link = `${location.origin}${location.pathname}?photo=${encodeURIComponent(activePhoto.id)}`;

    modalInner.innerHTML = `<div class="lightbox__media">
      <img src="${esc(fullSrc)}" alt="${esc(activePhoto.alt)}" decoding="async" fetchpriority="high">
      <span class="lightbox-origin">${activePhoto.isCrew?'JETVAULT CREW':'GLOBAL COMMUNITY'}</span>
    </div>
    <div class="lightbox__info">
      <span class="eyebrow">${archiveNo(activePhoto)} · ${esc(activePhoto.airline)} · ${esc(activePhoto.airport)}</span>
      <h2>${esc(activePhoto.reg)}</h2>
      <p>${esc(activePhoto.caption || 'A JetVault community photograph.')}</p>
      <div class="detail-list">
        <div class="detail-row"><span>Aircraft</span><b>${esc(activePhoto.aircraft)}</b></div>
        <div class="detail-row"><span>Operator</span><b>${esc(activePhoto.airline)}</b></div>
        <div class="detail-row"><span>Registration</span><b>${esc(activePhoto.reg)}</b></div>
        <div class="detail-row"><span>Airport</span><b>${esc(activePhoto.airport)}</b></div>
        <div class="detail-row"><span>Date</span><b>${esc(activePhoto.date)}</b></div>
        <div class="detail-row"><span>Photographer</span><b><a class="detail-profile-link" href="profile.html?photographer=${encodeURIComponent(activePhoto.photographer)}">${esc(activePhoto.photographerName)} ${activePhoto.isCrew?'· CREW':''} ↗</a></b></div>
      </div>
      <div class="lightbox-share">
        <button class="mini-button" type="button" data-share-photo>Share photo ↗</button>
        <span data-share-status></span>
        <span class="jv-lightbox-view" data-jv-lightbox-views><span>◉</span><b>${Number(viewCache.get(String(activePhoto.id)) || 0).toLocaleString('en-GB')}</b><span>views</span></span>
      </div>
      <div class="photo-social-panel" data-photo-social></div>
    </div>`;

    modal.showModal();
    document.body.classList.add('modal-open');
    backend.trackPhotoView(activePhoto.id);
    social?.mountContentSocial(modalInner.querySelector('[data-photo-social]'), activePhoto.id);

    getViewCounts([activePhoto.id]).then(() => {
      const b = modalInner.querySelector('[data-jv-lightbox-views] b');
      if (b) b.textContent = Number(viewCache.get(String(activePhoto.id)) || 0).toLocaleString('en-GB');
    });

    const share = modalInner.querySelector('[data-share-photo]');
    if (share) {
      share.onclick = async () => {
        try {
          if (navigator.share) {
            await navigator.share({
              title: `${activePhoto.airline} ${activePhoto.aircraft} — JetVault`,
              url: link
            });
          } else {
            await navigator.clipboard.writeText(link);
            modalInner.querySelector('[data-share-status]').textContent = 'Link copied';
          }
        } catch (_) {}
      };
    }

    history.replaceState(null, '', `gallery.html?photo=${encodeURIComponent(activePhoto.id)}`);
  }

  function shift(direction) {
    if (!activePhoto || !photos.length) return;
    const i = photos.findIndex(p => String(p.id) === String(activePhoto.id));
    openLightbox(photos[(i + direction + photos.length) % photos.length].id);
  }

  function applyData(next) {
    data = next;
    photos = (next.photos || []).map(p => ({
      ...p,
      fullSrc: p.fullSrc || p.src,
      thumbSrc: p.thumbSrc || p.src
    }));
    rebuildArchiveIndex();
    syncFilters();

    if (params.get('airport') && airportFilter) airportFilter.value = params.get('airport');
    if (params.get('photographer') && photographerSearch) {
      const key = params.get('photographer');
      const person = (data.photographers || []).find(x =>
        String(x.username || x.id) === String(key) || String(x.id) === String(key)
      );
      photographerSearch.value = person?.name || key;
    }
    if (params.get('scope') && scope) scope.value = params.get('scope');

    render({ reset: true });
  }

  function queueRender() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render({ reset: true }), 120);
  }

  grid.addEventListener('click', e => {
    const like = e.target.closest('[data-quick-like]');
    if (like) {
      e.preventDefault();
      e.stopPropagation();
      quickLike(like);
      return;
    }
    const opener = e.target.closest('[data-photo-id]');
    if (opener) openLightbox(opener.dataset.photoId);
  });

  [search, photographerSearch].filter(Boolean).forEach(el => el.addEventListener('input', queueRender));
  [scope, airportFilter, airlineFilter].filter(Boolean).forEach(el => el.addEventListener('change', () => render({ reset: true })));

  clear?.addEventListener('click', () => {
    if (search) search.value = '';
    if (scope) scope.value = '';
    if (airportFilter) airportFilter.value = '';
    if (airlineFilter) airlineFilter.value = '';
    if (photographerSearch) photographerSearch.value = '';
    history.replaceState(null, '', 'gallery.html');
    render({ reset: true });
  });

  modal?.querySelector('[data-lightbox-close]')?.addEventListener('click', () => modal.close());
  modal?.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => shift(-1));
  modal?.querySelector('[data-lightbox-next]')?.addEventListener('click', () => shift(1));
  modal?.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    history.replaceState(null, '', 'gallery.html');
  });
  modal?.addEventListener('click', e => {
    if (e.target === modal) modal.close();
  });

  addEventListener('keydown', e => {
    if (!modal?.open) return;
    if (e.key === 'ArrowLeft') shift(-1);
    if (e.key === 'ArrowRight') shift(1);
    if (e.key === 'Escape') modal.close();
  });

  rebuildArchiveIndex();
  applyData({ ...local, photos });

  if (backend.configured) {
    backend.getData().then(applyData).catch(() => {});
  }
})();