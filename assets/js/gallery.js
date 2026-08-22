(async () => {
  const backend = window.ScottishAeroBackend;
  const grid = document.querySelector('[data-gallery-grid]');
  if (!backend || !grid) return;

  const data = await backend.getData();
  const photos = data.photos;
  const search = document.querySelector('[data-gallery-search]');
  const airportFilter = document.querySelector('[data-airport-filter]');
  const airlineFilter = document.querySelector('[data-airline-filter]');
  const photographerFilter = document.querySelector('[data-photographer-filter]');
  const count = document.querySelector('[data-gallery-count]');
  const clear = document.querySelector('[data-clear-filters]');
  const modal = document.querySelector('[data-lightbox]');
  const modalInner = modal?.querySelector('[data-lightbox-inner]');
  const params = new URLSearchParams(location.search);
  let activePhoto = null;

  const unique = values => [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const fill = (select, values) => values.forEach(value => {
    const option = document.createElement('option');
    option.value = value; option.textContent = value; select.append(option);
  });

  fill(airportFilter, unique(photos.map(p => p.airport)));
  fill(airlineFilter, unique(photos.map(p => p.airline)));
  data.photographers.forEach(person => {
    const option = document.createElement('option'); option.value = person.id; option.textContent = person.name; photographerFilter.append(option);
  });

  if (params.get('airport')) airportFilter.value = params.get('airport');
  if (params.get('photographer')) photographerFilter.value = params.get('photographer');

  function card(photo) {
    return `
      <button class="photo-card" id="photo-${photo.id}" type="button" data-photo-id="${photo.id}" aria-label="Open ${photo.airline} ${photo.aircraft}">
        <img src="${photo.src}" alt="${photo.alt}" loading="lazy">
        <span class="photo-card__shade"></span>
        <span class="photo-card__meta">
          <span class="photo-card__eyebrow">${photo.airport} · ${photo.date}</span>
          <strong>${photo.reg}</strong>
          <span>${photo.airline} · ${photo.aircraft}</span>
        </span>
        <span class="photo-card__arrow">↗</span>
      </button>`;
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

  function render() {
    const list = filteredPhotos();
    grid.innerHTML = list.map(card).join('');
    count.textContent = `${list.length} photograph${list.length === 1 ? '' : 's'}`;
    grid.querySelectorAll('[data-photo-id]').forEach(el => el.addEventListener('click', () => openLightbox(el.dataset.photoId)));
  }

  function openLightbox(id) {
    activePhoto = photos.find(p => String(p.id) === String(id));
    if (!activePhoto || !modal || !modalInner) return;
    modalInner.innerHTML = `
      <div class="lightbox__media"><img src="${activePhoto.src}" alt="${activePhoto.alt}"></div>
      <div class="lightbox__info">
        <span class="eyebrow">${activePhoto.airline} · ${activePhoto.airport}</span>
        <h2>${activePhoto.reg}</h2>
        <p>${activePhoto.caption || 'A Scottish.aero photograph.'}</p>
        <div class="detail-list">
          <div class="detail-row"><span>Aircraft</span><b>${activePhoto.aircraft}</b></div>
          <div class="detail-row"><span>Operator</span><b>${activePhoto.airline}</b></div>
          <div class="detail-row"><span>Registration</span><b>${activePhoto.reg}</b></div>
          <div class="detail-row"><span>Airport</span><b>${activePhoto.airport}</b></div>
          <div class="detail-row"><span>Date</span><b>${activePhoto.date}</b></div>
          <div class="detail-row"><span>Photographer</span><b>${activePhoto.photographerName || 'Unknown'}</b></div>
        </div>
      </div>`;
    modal.showModal();
    document.body.classList.add('modal-open');
    backend.trackPhotoView(activePhoto.id);
  }

  function shift(delta) {
    if (!activePhoto) return;
    const index = photos.findIndex(p => String(p.id) === String(activePhoto.id));
    const next = (index + delta + photos.length) % photos.length;
    openLightbox(photos[next].id);
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
  });

  render();
  const hashId = location.hash.match(/^#photo-(.+)$/)?.[1];
  if (hashId) setTimeout(() => openLightbox(hashId), 180);
})();
