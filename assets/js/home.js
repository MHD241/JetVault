(() => {
  const data = window.SCOTTISH_AERO;
  if (!data) return;

  const featuredGrid = document.querySelector('[data-home-gallery]');
  const featured = data.photos.find(p => p.featured) || data.photos[0];
  const potw = document.querySelector('[data-potw]');
  const people = document.querySelector('[data-home-people]');

  if (featuredGrid) {
    featuredGrid.innerHTML = data.photos.slice(1, 7).map(photo => `
      <a class="home-shot home-shot--${photo.ratio || 'standard'}" href="gallery.html#photo-${photo.id}">
        <img src="${photo.src}" alt="${photo.alt}" loading="lazy">
        <span class="home-shot__meta"><b>${photo.reg}</b><span>${photo.airport} · ${photo.aircraft}</span></span>
      </a>`).join('');
  }

  if (potw && featured) {
    const photographer = data.photographers.find(p => p.id === featured.photographer);
    potw.innerHTML = `
      <div class="potw__image"><img src="${featured.src}" alt="${featured.alt}"></div>
      <div class="potw__content">
        <span class="eyebrow">Photo of the week · ${featured.airport}</span>
        <h2>${featured.reg}</h2>
        <p>${featured.aircraft} — ${featured.airline}. ${featured.caption}</p>
        <div class="potw__credit"><span>Photographed by</span><strong>${photographer?.name || ''}</strong></div>
        <a class="text-link" href="gallery.html">View in gallery <span>↗</span></a>
      </div>`;
  }

  if (people) {
    people.innerHTML = data.photographers.map(person => {
      const shots = data.photos.filter(p => p.photographer === person.id);
      return `
        <a class="person-card" href="gallery.html?photographer=${encodeURIComponent(person.id)}">
          <div class="person-card__avatar">${person.initials}</div>
          <span class="eyebrow">${person.base}</span>
          <h3>${person.name}</h3>
          <p>${person.bio}</p>
          <span class="person-card__stats">${shots.length} sample photographs <span>↗</span></span>
        </a>`;
    }).join('');
  }
})();
