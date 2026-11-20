/* Jetvault Flight Sim countdown.
   Any element with data-countdown="<ISO date>" gets live days / hours / minutes / seconds.
   The target is midnight at the start of 25 February 2027 (UK time is GMT in February). */
(() => {
  const boxes = document.querySelectorAll('[data-countdown]');
  if (!boxes.length) return;
  const pad = (n, len) => String(n).padStart(len, '0');

  function paint(box) {
    const target = Date.parse(box.dataset.countdown);
    if (Number.isNaN(target)) return;
    const left = Math.max(0, target - Date.now());
    const total = Math.floor(left / 1000);
    const parts = {
      d: pad(Math.floor(total / 86400), 3),
      h: pad(Math.floor((total % 86400) / 3600), 2),
      m: pad(Math.floor((total % 3600) / 60), 2),
      s: pad(total % 60, 2)
    };
    for (const key in parts) {
      const el = box.querySelector('[data-cd="' + key + '"]');
      if (el) el.textContent = parts[key];
    }
    box.classList.toggle('is-done', left === 0);
  }

  const tick = () => boxes.forEach(paint);
  tick();
  setInterval(tick, 1000);
})();
