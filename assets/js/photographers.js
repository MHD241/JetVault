(async () => {
  const backend = window.ScottishAeroBackend;
  const grid = document.querySelector('[data-photographers-grid]');
  if (!backend || !grid) return;
  const data = await backend.getData();

  grid.innerHTML = data.photographers.map((person, i) => {
    const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
    const airports = new Set(shots.map(p => p.airport).filter(a => a && a !== 'Unknown')).size;
    const preview = shots.slice(0, 3);
    return `
      <article class="profile" data-reveal style="--delay:${i * 75}ms">
        <div class="profile__copy">
          <div class="profile__head">
            <div class="profile__avatar">${person.initials}</div>
            <div><span class="eyebrow">${person.role}</span><h2>${person.name}</h2></div>
          </div>
          <p>${person.bio}</p>
          <div class="profile__stats"><span><b>${shots.length}</b> photographs</span><span><b>${airports}</b> known airports</span></div>
        </div>
        <div class="profile__right">
          <div class="profile__strip">
            ${preview.length ? preview.map(p => `<img src="${p.src}" alt="${p.alt}" loading="lazy">`).join('') : '<div class="profile__empty">First upload coming soon.</div><div class="profile__empty">Scottish.aero</div><div class="profile__empty">Keep looking up.</div>'}
          </div>
          <div class="profile__actions"><a class="text-link" href="gallery.html?photographer=${encodeURIComponent(person.id)}">View ${person.name.split(' ')[0]}'s work <span>↗</span></a></div>
        </div>
      </article>`;
  }).join('');
  grid.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
})();
