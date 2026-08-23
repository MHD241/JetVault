(() => {
  const backend = window.ScottishAeroBackend;
  const local = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-gallery-grid]');
  if (!backend || !local || !grid) return;

  const search = document.querySelector('[data-gallery-search]');
  const airportFilter = document.querySelector('[data-airport-filter]');
  const airlineFilter = document.querySelector('[data-airline-filter]');
  const photographerFilter = document.querySelector('[data-photographer-filter]');
  const count = document.querySelector('[data-gallery-count]');
  const clear = document.querySelector('[data-clear-filters]');
  const modal = document.querySelector('[data-lightbox]');
  const modalInner = modal?.querySelector('[data-lightbox-inner]');
  const params = new URLSearchParams(location.search);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  let data = local;
  let photos = local.photos;
  let activePhoto = null;

  const unique = values => [...new Set(values.filter(v => v && v !== 'Unknown'))].sort((a,b) => a.localeCompare(b));

  function setOptions(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
    });
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function syncFilters() {
    setOptions(airportFilter, unique(photos.map(p => p.airport)), 'All airports');
    setOptions(airlineFilter, unique(photos.map(p => p.airline)), 'All airlines');
    const current = photographerFilter.value;
    photographerFilter.innerHTML = '<option value="">All photographers</option>';
    data.photographers.forEach(person => {
      const option = document.createElement('option'); option.value = person.id; option.textContent = person.name; photographerFilter.append(option);
    });
    if ([...photographerFilter.options].some(o => o.value === current)) photographerFilter.value = current;
  }

  function filteredPhotos() {
    const q = search.value.trim().toLowerCase();
    const airport = airportFilter.value;
    const airline = airlineFilter.value;
    const photographer = photographerFilter.value;
    return photos.filter(photo => {
      const haystack = [photo.reg, photo.aircraft, photo.airline, photo.airport, photo.date, photo.photographerName, photo.caption].join(' ').toLowerCase();
      const personMatches = !photographer || photo.photographer === photographer || backend.slugify(photo.photographerName) === photographer;
      return (!q || haystack.includes(q)) && (!airport || photo.airport === airport) && (!airline || photo.airline === airline) && personMatches;
    });
  }

  function archiveNo(photo) {
    const n = Math.max(1, photos.findIndex(p => String(p.id) === String(photo.id)) + 1);
    return `SA / ${String(n).padStart(5, '0')}`;
  }

  function card(photo) {
    return `<button class="photo-card" id="photo-${esc(photo.id)}" type="button" data-photo-id="${esc(photo.id)}" aria-label="Open ${esc(photo.airline)} ${esc(photo.aircraft)}">
      <img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy" decoding="async" fetchpriority="low">
      <span class="photo-card__shade"></span><span class="archive-stamp">${archiveNo(photo)}</span>
      <span class="photo-card__meta"><span class="photo-card__eyebrow">${esc(photo.airport)} · ${esc(photo.date)}</span><strong>${esc(photo.reg)}</strong><span>${esc(photo.airline)} · ${esc(photo.aircraft)}</span></span>
      <span class="photo-card__arrow">↗</span></button>`;
  }

  function render() {
    const list = filteredPhotos();
    grid.innerHTML = list.map(card).join('');
    count.textContent = `${list.length} photograph${list.length === 1 ? '' : 's'} · ${photos.length} in archive`;
    grid.querySelectorAll('[data-photo-id]').forEach(el => el.addEventListener('click', () => openLightbox(el.dataset.photoId)));
  }

  function openLightbox(id) {
    activePhoto = photos.find(p => String(p.id) === String(id));
    if (!activePhoto || !modal || !modalInner) return;
    modalInner.innerHTML = `<div class="lightbox__media"><img src="${esc(activePhoto.src)}" alt="${esc(activePhoto.alt)}" decoding="async" fetchpriority="high"></div>
      <div class="lightbox__info"><span class="eyebrow">${archiveNo(activePhoto)} · ${esc(activePhoto.airline)} · ${esc(activePhoto.airport)}</span>
      <h2>${esc(activePhoto.reg)}</h2><p>${esc(activePhoto.caption || 'A Scottish.aero photograph.')}</p>
      <div class="detail-list"><div class="detail-row"><span>Aircraft</span><b>${esc(activePhoto.aircraft)}</b></div><div class="detail-row"><span>Operator</span><b>${esc(activePhoto.airline)}</b></div><div class="detail-row"><span>Registration</span><b>${esc(activePhoto.reg)}</b></div><div class="detail-row"><span>Airport</span><b>${esc(activePhoto.airport)}</b></div><div class="detail-row"><span>Date</span><b>${esc(activePhoto.date)}</b></div><div class="detail-row"><span>Photographer</span><b><a class="detail-profile-link" href="profile.html?photographer=${encodeURIComponent(activePhoto.photographer)}">${esc(activePhoto.photographerName || 'Unknown')} ↗</a></b></div></div></div>`;
    modal.showModal();
    document.body.classList.add('modal-open');
    backend.trackPhotoView(activePhoto.id);
  }

  function shift(delta) {
    if (!activePhoto || !photos.length) return;
    const index = photos.findIndex(p => String(p.id) === String(activePhoto.id));
    openLightbox(photos[(index + delta + photos.length) % photos.length].id);
  }

  function applyData(nextData) {
    data = nextData; photos = nextData.photos || [];
    syncFilters();
    if (params.get('airport')) airportFilter.value = params.get('airport');
    if (params.get('photographer')) photographerFilter.value = params.get('photographer');
    render();
  }

  [search, airportFilter, airlineFilter, photographerFilter].forEach(el => el.addEventListener('input', render));
  clear.addEventListener('click', () => {
    search.value = ''; airportFilter.value = ''; airlineFilter.value = ''; photographerFilter.value = '';
    history.replaceState(null, '', 'gallery.html'); render();
  });
  modal?.querySelector('[data-lightbox-close]')?.addEventListener('click', () => modal.close());
  modal?.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => shift(-1));
  modal?.querySelector('[data-lightbox-next]')?.addEventListener('click', () => shift(1));
  modal?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  addEventListener('keydown', e => {
    if (!modal?.open) return;
    if (e.key === 'ArrowLeft') shift(-1);
    if (e.key === 'ArrowRight') shift(1);
    if (e.key === 'Escape') modal.close();
  });

  applyData(local);
  if (backend.configured) backend.getData().then(applyData).catch(() => {});
  const hashId = location.hash.match(/^#photo-(.+)$/)?.[1];
  if (hashId) setTimeout(() => openLightbox(hashId), 80);
})();
