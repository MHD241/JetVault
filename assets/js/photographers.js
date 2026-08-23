(() => {
  const backend = window.ScottishAeroBackend;
  const local = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-photographers-grid]');
  if (!backend || !local || !grid) return;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function render(data) {
    grid.innerHTML = data.photographers.map((person, i) => {
      const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
      const airports = new Set(shots.map(p => p.airport).filter(a => a && a !== 'Unknown')).size;
      const preview = shots.slice(0, 3);
      return `<article class="profile" data-reveal style="--delay:${i * 65}ms">
        <div class="profile__copy"><div class="profile__head"><div class="profile__avatar">${esc(person.initials)}</div>
        <div><span class="eyebrow">${esc(person.role)}</span><h2>${esc(person.name)}</h2></div></div>
        <p>${esc(person.bio)}</p><div class="profile__stats"><span><b>${shots.length}</b> photographs</span><span><b>${airports}</b> known airports</span></div></div>
        <div class="profile__right"><div class="profile__strip">
          ${preview.length ? preview.map(p => `<img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">`).join('') : '<div class="profile__empty">First upload coming soon.</div><div class="profile__empty">Scottish.aero</div><div class="profile__empty">Keep looking up.</div>'}
        </div><div class="profile__actions"><a class="text-link" href="gallery.html?photographer=${encodeURIComponent(person.id)}">View ${esc(person.name.split(' ')[0])}'s work <span>↗</span></a></div></div>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
  }

  render(local);
  if (backend.configured) backend.getData().then(render).catch(() => {});
})();
