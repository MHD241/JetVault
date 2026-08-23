(() => {
  const backend = window.ScottishAeroBackend;
  const local = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-photographers-grid]');
  if (!backend || !local || !grid) return;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const profileHref = person => `profile.html?photographer=${encodeURIComponent(person.id)}`;

  function render(data) {
    grid.innerHTML = data.photographers.map((person, i) => {
      const shots = data.photos.filter(p => p.photographerName === person.name || p.photographer === person.id);
      const posts = (data.posts || []).filter(p => p.photographerName === person.name || p.photographer === person.id);
      const airports = new Set(shots.map(p => p.airport).filter(a => a && a !== 'Unknown')).size;
      const cover = shots[0]?.src || '';
      const avatar = person.avatar ? `<img src="${esc(person.avatar)}" alt="${esc(person.name)} profile photo" loading="lazy" decoding="async">` : `<span>${esc(person.initials)}</span>`;
      const previews = shots.slice(0, 3);
      return `<a class="creator-card" href="${profileHref(person)}" data-reveal data-tilt style="--delay:${i * 70}ms">
        <div class="creator-card__cover">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ''}<span class="creator-card__scan"></span></div>
        <div class="creator-card__body">
          <div class="creator-card__identity"><div class="creator-avatar">${avatar}</div><div><span class="eyebrow">${esc(person.role)}</span><h2>${esc(person.name)}</h2></div></div>
          <p>${esc(person.bio)}</p>
          <div class="creator-card__stats"><span><b>${shots.length}</b> photos</span><span><b>${posts.length}</b> posts</span><span><b>${airports}</b> airports</span></div>
          <div class="creator-card__previews">${previews.length ? previews.map(p => `<span><img src="${esc(p.src)}" alt="" loading="lazy" decoding="async"></span>`).join('') : '<span></span><span></span><span></span>'}</div>
          <div class="creator-card__open"><span>Open profile</span><b>↗</b></div>
        </div>
      </a>`;
    }).join('');
    grid.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
  }

  render(local);
  if (backend.configured) backend.getData().then(render).catch(() => {});
})();
