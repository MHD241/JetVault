(() => {
  if (window.__SA_CREDITS_V751__) return;
  window.__SA_CREDITS_V751__ = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  document.querySelectorAll('[data-proof-card]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--px', `${e.clientX-r.left}px`);
      card.style.setProperty('--py', `${e.clientY-r.top}px`);
    });
  });

  const device = document.querySelector('[data-demo-device]');
  document.querySelectorAll('[data-size]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('is-active', b === button));
      device?.classList.remove('is-desktop','is-tablet','is-mobile');
      device?.classList.add(`is-${button.dataset.size}`);
    });
  });

  const motion = document.querySelector('[data-motion-stage]');
  const panel = document.querySelector('[data-motion-panel]');
  const magnetic = document.querySelector('[data-magnetic]');
  if (motion && panel && !reduce && !coarse) {
    motion.addEventListener('pointermove', e => {
      const r = motion.getBoundingClientRect();
      const x = e.clientX-r.left, y=e.clientY-r.top;
      motion.style.setProperty('--mx', `${x}px`);
      motion.style.setProperty('--my', `${y}px`);
      panel.style.setProperty('--ry', `${(x/r.width-.5)*8}deg`);
      panel.style.setProperty('--rx', `${(.5-y/r.height)*7}deg`);

      if (magnetic) {
        const b = magnetic.getBoundingClientRect();
        const dx=e.clientX-(b.left+b.width/2), dy=e.clientY-(b.top+b.height/2);
        if (Math.hypot(dx,dy)<105) {
          magnetic.style.setProperty('--bx', `${dx*.13}px`);
          magnetic.style.setProperty('--by', `${dy*.13}px`);
        } else {
          magnetic.style.setProperty('--bx','0px'); magnetic.style.setProperty('--by','0px');
        }
      }
    });
    motion.addEventListener('pointerleave', () => {
      motion.style.setProperty('--mx','50%'); motion.style.setProperty('--my','50%');
      panel.style.setProperty('--rx','0deg'); panel.style.setProperty('--ry','0deg');
      magnetic?.style.setProperty('--bx','0px'); magnetic?.style.setProperty('--by','0px');
    });
  }

  const dashboard = document.querySelector('[data-dashboard-demo]');
  let ran = false;
  const runDashboard = () => {
    if (!dashboard || ran) return;
    ran = true;
    dashboard.classList.add('is-running');
    dashboard.querySelectorAll('[data-counter]').forEach(node => {
      const end = Number(node.dataset.counter || 0);
      const decimals = Number(node.dataset.decimals || 0);
      const suffix = node.dataset.suffix || '';
      if (reduce) {
        node.textContent = end.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) + suffix;
        return;
      }
      const start = performance.now();
      const duration = 1200;
      const tick = now => {
        const p = Math.min(1,(now-start)/duration);
        const eased = 1-Math.pow(1-p,3);
        const val = end*eased;
        node.textContent = val.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) + suffix;
        if (p<1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  if (dashboard && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(e=>e.isIntersecting)) runDashboard();
    },{threshold:.35}).observe(dashboard);
  } else runDashboard();

  const sequence = document.querySelector('[data-sequence]');
  if (sequence) {
    const slides = [
      ['01 · FIRST IMPRESSION','Make them<br>stop scrolling.','Strong hierarchy, cinematic motion and an interface with a point of view.','DESIGN','01'],
      ['02 · INTERACTION','Make every tap<br>feel intentional.','Useful feedback, responsive controls and motion that reacts to the person using it.','MOTION','02'],
      ['03 · RELIABILITY','Make it work<br>when it matters.','Responsive layouts, accessible fallbacks and product behaviour behind the visuals.','SYSTEM','03']
    ];
    const kicker=sequence.querySelector('[data-seq-kicker]'), title=sequence.querySelector('[data-seq-title]'),
          copy=sequence.querySelector('[data-seq-copy]'), code=sequence.querySelector('[data-seq-code]'),
          number=sequence.querySelector('[data-seq-number]'), progress=sequence.querySelector('[data-sequence-progress]');
    const dots=[...sequence.querySelectorAll('[data-seq-step]')];
    let current=0, timer, started=performance.now();

    const render = n => {
      current=n;
      const s=slides[n];
      kicker.textContent=s[0]; title.innerHTML=s[1]; copy.textContent=s[2]; code.textContent=s[3]; number.textContent=s[4];
      dots.forEach((d,i)=>d.classList.toggle('is-active',i===n));
      started=performance.now();
    };
    dots.forEach(d=>d.addEventListener('click',()=>render(Number(d.dataset.seqStep))));

    if (!reduce) {
      const loop = now => {
        const p=Math.min(1,(now-started)/4200);
        if(progress) progress.style.width=`${p*100}%`;
        if(p>=1) render((current+1)%slides.length);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else if(progress) progress.style.width='100%';
  }
})();