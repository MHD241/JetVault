(async () => {
  const backend = window.ScottishAeroBackend;
  if (!backend) return;
  const data = await backend.getData();

  const hero = document.querySelector('[data-hero-image]');
  const gallery = document.querySelector('[data-home-gallery]');
  const potw = document.querySelector('[data-potw]');
  const people = document.querySelector('[data-home-people]');
  const featured = data.photos.find(p => p.featured) || data.photos[0];

  if (hero && featured) {
    hero.src = featured.src;
    hero.alt = featured.alt;
  }

  if (gallery) {
    gallery.innerHTML = data.photos.slice(0, 6).map((photo, index) => `
      <a class="home-shot" href="gallery.html#photo-${photo.id}" data-tilt data-reveal style="--delay:${index * 55}ms">
        <img src="${photo.src}" alt="${photo.alt}" loading="${index < 2 ? 'eager' : 'lazy'}">
        <span class="home-shot__meta">
          <b>${photo.reg}</b>
          <span>${photo.airline}<br>${photo.aircraft}</span>
        </span>
      </a>`).join('');
    gallery.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
  }

  if (potw && featured) {
    potw.innerHTML = `
      <div class="potw__image"><img src="${featured.src}" alt="${featured.alt}"></div>
      <div class="potw__content">
        <span class="eyebrow">Photo of the week · Scottish.aero</span>
        <h2>${featured.reg}</h2>
        <p>${featured.aircraft} — ${featured.airline}. ${featured.caption || ''}</p>
        <div class="potw__credit"><span>Photographed by</span><strong>${featured.photographerName || 'Unknown'}</strong></div>
        <a class="text-link" href="gallery.html#photo-${featured.id}">Open photograph <span>↗</span></a>
      </div>`;
  }

  if (people) {
    people.innerHTML = data.photographers.map((person, i) => {
      const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
      return `
        <a class="person-card" href="gallery.html?photographer=${encodeURIComponent(person.id)}" data-reveal style="--delay:${i * 80}ms">
          <div class="person-card__avatar">${person.initials}</div>
          <span class="eyebrow">${person.role}</span>
          <h3>${person.name}</h3>
          <p>${person.bio}</p>
          <span class="person-card__stats"><span>${shots.length} photograph${shots.length === 1 ? '' : 's'}</span><span>View work ↗</span></span>
        </a>`;
    }).join('');
    people.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
  }
})();
