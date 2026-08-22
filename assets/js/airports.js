(() => {
  const data = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-airports-grid]');
  if (!data || !grid) return;
  grid.innerHTML = data.airports.map((airport, i) => `
    <a class="airport-card" href="gallery.html?airport=${airport.code}" data-reveal style="--delay:${i * 55}ms">
      <div class="airport-card__top"><span>${airport.region}</span><span>Scotland</span></div>
      <strong>${airport.code}</strong><h3>${airport.name} Airport</h3><p>${airport.note}</p>
      <div class="airport-card__foot"><span>Explore photographs</span><span>↗</span></div>
    </a>`).join('');
  grid.querySelectorAll('[data-reveal]').forEach(el => requestAnimationFrame(() => el.classList.add('is-visible')));
})();
