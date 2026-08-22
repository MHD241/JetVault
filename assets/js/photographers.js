(() => {
  const data = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-photographers-grid]');
  if (!data || !grid) return;

  grid.innerHTML = data.photographers.map((person, i) => {
    const shots = data.photos.filter(p => p.photographer === person.id);
    const airportCount = new Set(shots.map(p => p.airport)).size;
    return `
      <article class="profile" data-reveal style="--delay:${i * 70}ms">
        <div class="profile__head">
          <div class="profile__avatar">${person.initials}</div>
          <div><span class="eyebrow">${person.base}</span><h2>${person.name}</h2></div>
        </div>
        <p>${person.bio}</p>
        <div class="profile__stats">
          <span><b>${shots.length}</b> photographs</span>
          <span><b>${airportCount}</b> airports</span>
        </div>
        <div class="profile__strip">
          ${shots.slice(0,3).map(photo => `<img src="${photo.src}" alt="${photo.alt}" loading="lazy">`).join('')}
        </div>
        <div class="profile__actions">
          <span>${person.instagram}</span>
          <a class="text-link" href="gallery.html?photographer=${encodeURIComponent(person.id)}">View work <span>↗</span></a>
        </div>
      </article>`;
  }).join('');
})();
