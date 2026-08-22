(() => {
  const data = window.SCOTTISH_AERO;
  const grid = document.querySelector('[data-airports-grid]');
  if (!data || !grid) return;

  grid.innerHTML = data.airports.map((airport, i) => {
    const shots = data.photos.filter(p => p.airport === airport.code);
    const preview = shots[0]?.src || 'assets/images/photos/sample-01.svg';
    return `
      <a class="airport-card" href="gallery.html?airport=${airport.code}" data-reveal style="--delay:${i * 50}ms">
        <img src="${preview}" alt="${airport.name} aviation photography preview" loading="lazy">
        <span class="airport-card__veil"></span>
        <span class="airport-card__top"><span>${airport.region}</span><span>${String(shots.length).padStart(2,'0')} photos</span></span>
        <span class="airport-card__code">${airport.code}</span>
        <span class="airport-card__bottom"><strong>${airport.name}</strong><span>${airport.note}</span></span>
      </a>`;
  }).join('');
})();
