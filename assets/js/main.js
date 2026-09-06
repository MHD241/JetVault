(() => {
  const JV=()=>window.JetVault;
  const page=document.body.dataset.page || '';
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const nav=[
    ['home','index.html','Home'],['gallery','gallery.html','Explore'],['airports','airports.html','Airports'],
    ['photographers','photographers.html','Creators'],['games','games.html','Games'],['missions','missions.html','Missions']
  ];

  function shell(){
    const h=document.querySelector('[data-site-header]');
    if(h) h.innerHTML=`<div class="site-header"><div class="container nav">
      <a class="brand" href="index.html"><span class="brand-mark">✈</span><span>JETVAULT <small>AVIATION ARCHIVE</small></span></a>
      <button class="nav-toggle" type="button" data-nav-toggle>Menu</button>
      <nav class="nav-links" data-nav-links>${nav.map(([k,u,t])=>`<a class="${page===k?'is-active':''}" href="${u}">${t}</a>`).join('')}</nav>
      <a class="account-link" data-account-link href="account.html">Account</a>
    </div></div>`;
    const f=document.querySelector('[data-site-footer]');
    if(f) f.innerHTML=`<footer class="site-footer"><div class="container footer-grid">
      <div><b>JetVault</b><div>Independent aviation photography archive and community.</div></div>
      <div class="footer-links"><a href="about.html">About</a><a href="rules.html">Rules</a><a href="credits.html">Credits</a><a href="aerocoins.html">AeroCoins</a><a href="passport.html">Passport</a></div>
    </div></footer>`;
    h?.querySelector('[data-nav-toggle]')?.addEventListener('click',()=>h.querySelector('[data-nav-links]')?.classList.toggle('is-open'));
  }

  window.JVUI={
    toast(text,kind=''){let n=document.querySelector('[data-global-toast]');if(!n){n=document.createElement('div');n.dataset.globalToast='';n.style.cssText='position:fixed;right:16px;bottom:16px;z-index:100;background:#0d1924;border:1px solid #294156;color:white;padding:12px 14px;border-radius:12px;box-shadow:0 15px 40px #0008;max-width:340px';document.body.append(n)}n.textContent=text;n.style.display='block';clearTimeout(n._t);n._t=setTimeout(()=>n.style.display='none',3200)},
    photoCard(p){return `<article class="photo-card"><button class="photo-card__open" data-open-photo="${esc(p.id)}" type="button"><div class="photo-card__image"><img src="${esc(p.thumbUrl||p.fullUrl)}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></div><span class="photo-card__badge">${esc(p.airport)}</span><div class="photo-card__body"><small>${esc(p.airline)}</small><strong>${esc(p.reg)}</strong><span>${esc(p.aircraft)} · ${esc(p.photographerName)}</span></div></button></article>`}
  };

  async function authLabel(){
    try{
      const [u,p]=await Promise.all([JV().currentUser(),JV().currentProfile()]);
      const a=document.querySelector('[data-account-link]');
      if(a&&u) a.textContent=p?.display_name || 'My account';
    }catch(_){}
  }

  async function home(){
    if(page!=='home') return;
    try{
      const [s,featured,recent]=await Promise.all([
        JV().stats(),JV().listPhotos({featured:true,pageSize:6}),JV().listPhotos({pageSize:6})
      ]);
      document.querySelector('[data-stat-photos]').textContent=s.photos.toLocaleString();
      document.querySelector('[data-stat-members]').textContent=s.members.toLocaleString();
      document.querySelector('[data-stat-crew]').textContent=s.crew.toLocaleString();
      const use=featured.items.length?featured.items:recent.items;
      const grid=document.querySelector('[data-home-photos]'); if(grid) grid.innerHTML=use.map(window.JVUI.photoCard).join('');
      grid?.addEventListener('click',e=>{const b=e.target.closest('[data-open-photo]');if(b)location.href=`gallery.html?photo=${encodeURIComponent(b.dataset.openPhoto)}`});
    }catch(e){console.warn(e)}
  }

  async function discover(){
    if(page!=='discover') return;
    try{
      const r=await JV().listPhotos({pageSize:36});
      const items=[...r.items].sort(()=>Math.random()-.5).slice(0,12);
      const grid=document.querySelector('[data-discover-grid]');
      grid.innerHTML=items.map(window.JVUI.photoCard).join('');
      grid.addEventListener('click',e=>{const b=e.target.closest('[data-open-photo]');if(b)location.href=`gallery.html?photo=${encodeURIComponent(b.dataset.openPhoto)}`});
    }catch(e){document.querySelector('[data-discover-grid]').innerHTML='<div class="empty">Could not load Discover.</div>'}
  }

  shell();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{authLabel();home();discover()},{once:true});
  else {authLabel();home();discover()}
})();
