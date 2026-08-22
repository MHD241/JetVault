(() => {
  const data = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-gallery-grid]');
  if (!data || !grid) return;

  const search = document.querySelector('[data-gallery-search]');
  const airportFilter = document.querySelector('[data-airport-filter]');
  const airlineFilter = document.querySelector('[data-airline-filter]');
  const count = document.querySelector('[data-gallery-count]');
  const clear = document.querySelector('[data-clear-filters]');
  const modal = document.querySelector('[data-lightbox]');
  const modalInner = modal?.querySelector('[data-lightbox-inner]');

  const params = new URLSearchParams(location.search);
  let activePhoto = null;

  const personName = id => data.photographers.find(p => p.id === id)?.name || id;

  const unique = (items) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

  unique(data.photos.map(p => p.airport)).forEach(code => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    airportFilter.append(option);
  });
  unique(data.photos.map(p => p.airline)).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    airlineFilter.append(option);
  });

  if (params.get('airport')) airportFilter.value = params.get('airport');
  if (params.get('photographer')) search.value = personName(params.get('photographer'));

  function card(photo) {
    return `
      <button class="photo-card photo-card--${photo.ratio || 'standard'}" type="button" data-photo-id="${photo.id}" aria-label="Open ${photo.aircraft} ${photo.reg}">
        <img src="${photo.src}" alt="${photo.alt}" loading="lazy">
        <span class="photo-card__shade"></span>
        <span class="photo-card__meta">
          <span class="photo-card__eyebrow">${photo.airport} · ${photo.date}</span>
          <strong>${photo.reg}</strong>
          <span>${photo.aircraft}</span>
        </span>
        <span class="photo-card__arrow">↗</span>
      </button>`;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const airport = airportFilter.value;
    const airline = airlineFilter.value;

    const filtered = data.photos.filter(photo => {
      const haystack = [photo.reg, photo.aircraft, photo.airline, photo.airport, photo.date, personName(photo.photographer), photo.caption].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (!airport || photo.airport === airport) && (!airline || photo.airline === airline);
    });

    grid.innerHTML = filtered.map(card).join('');
    count.textContent = `${filtered.length} photograph${filtered.length === 1 ? '' : 's'}`;

    grid.querySelectorAll('[data-photo-id]').forEach(el => {
      el.addEventListener('click', () => openLightbox(Number(el.dataset.photoId)));
    });
  }

  function openLightbox(id) {
    activePhoto = data.photos.find(p => p.id === id);
    if (!activePhoto || !modal || !modalInner) return;
    const photographer = data.photographers.find(p => p.id === activePhoto.photographer);
    modalInner.innerHTML = `
      <div class="lightbox__media"><img src="${activePhoto.src}" alt="${activePhoto.alt}"></div>
      <div class="lightbox__details">
        <div>
          <span class="eyebrow">${activePhoto.airport} · ${activePhoto.date}</span>
          <h2>${activePhoto.reg}</h2>
          <p class="lightbox__caption">${activePhoto.caption}</p>
        </div>
        <dl class="spec-list">
          <div><dt>Aircraft</dt><dd>${activePhoto.aircraft}</dd></div>
          <div><dt>Operator</dt><dd>${activePhoto.airline}</dd></div>
          <div><dt>Airport</dt><dd>${activePhoto.airport}</dd></div>
          <div><dt>Photographer</dt><dd>${photographer?.name || ''}</dd></div>
        </dl>
      </div>`;
    modal.showModal();
    document.body.classList.add('modal-open');
  }

  function shift(direction) {
    if (!activePhoto) return;
    const index = data.photos.findIndex(p => p.id === activePhoto.id);
    const next = (index + direction + data.photos.length) % data.photos.length;
    openLightbox(data.photos[next].id);
  }

  [search, airportFilter, airlineFilter].forEach(el => el.addEventListener('input', render));
  clear.addEventListener('click', () => {
    search.value = '';
    airportFilter.value = '';
    airlineFilter.value = '';
    history.replaceState(null, '', 'gallery.html');
    render();
  });

  modal?.querySelector('[data-lightbox-close]')?.addEventListener('click', () => modal.close());
  modal?.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => shift(-1));
  modal?.querySelector('[data-lightbox-next]')?.addEventListener('click', () => shift(1));
  modal?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  modal?.addEventListener('click', event => {
    if (event.target === modal) modal.close();
  });

  window.addEventListener('keydown', event => {
    if (!modal?.open) return;
    if (event.key === 'ArrowLeft') shift(-1);
    if (event.key === 'ArrowRight') shift(1);
  });

  render();
})();
