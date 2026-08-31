(() => {
  if (window.__JETVAULT_PUBLIC_SHELL__) return;
  window.__JETVAULT_PUBLIC_SHELL__ = true;

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const ADVANCED_EXPLORE = new Set(['airports.html','airport.html','passport.html']);
  const ADVANCED_ECONOMY = new Set(['aerocoins.html']);

  function ensureStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=href; document.head.append(link);
  }
  function ensureScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s=document.createElement('script'); s.src=src; s.defer=true; document.body.append(s);
  }

  function brandText(value) {
    if (!value) return value;
    return String(value)
      .replace(/SCOTTISH\.AERO CREW/g,'JETVAULT CREW')
      .replace(/Scottish\.aero Crew/g,'Jetvault Crew')
      .replace(/Scottish\.aero crew/g,'Jetvault crew')
      .replace(/SCOTTISH\.AERO/g,'JETVAULT')
      .replace(/Scottish\.aero/g,'Jetvault')
      .replace(/scottish\.aero/g,'Jetvault')
      .replace(/born in Scotland/gi,'built for aviation people')
      .replace(/Made in Scotland · for aviation people\.?/gi,'Built for aviation people.')
      .replace(/Born in Scotland · open to aviation people everywhere\.?/gi,'Built for aviation people everywhere.')
      .replace(/Scottish aviation group/gi,'aviation community');
  }

  function rewriteText(root=document.body) {
    if (!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      return /scottish\.aero|born in scotland|made in scotland|scottish aviation group/i.test(node.nodeValue||'') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{n.nodeValue=brandText(n.nodeValue);});
  }

  function setBrandMarks() {
    document.querySelectorAll('a.brand').forEach(a=>{
      const href=a.getAttribute('href')||'';
      if(href && !/index\.html|^\.?\/?$/.test(href)) return;
      a.setAttribute('aria-label','Jetvault home');
      if(!a.querySelector('img.jv-wordmark')) a.innerHTML='<img class="jv-wordmark" src="assets/images/ui/jetvault-wordmark.png" alt="Jetvault">';
    });
    let icon=document.querySelector('link[rel="icon"]');
    if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon);}
    icon.href='assets/images/ui/jetvault-icon.png'; icon.type='image/png';
  }

  function syncNav() {
    const current = page==='discover.html' ? 'gallery.html' : page;
    document.querySelectorAll('.site-nav').forEach(nav=>{
      const desired=[
        ['index.html','Home'],
        ['gallery.html','Explore'],
        ['photographers.html','Photographers'],
        ['account.html?mode=signup','Join']
      ];
      const sig=[...nav.querySelectorAll(':scope > a')].map(a=>`${a.getAttribute('href')}|${(a.textContent||'').trim()}`).join(';;');
      const wanted=desired.map(([href,label])=>`${href}|${label}`).join(';;');
      if(sig!==wanted){
        nav.innerHTML=desired.map(([href,label])=>{const target=href.split('?')[0];return `<a href="${href}"${current===target?' aria-current="page"':''}>${label}</a>`;}).join('');
      } else {
        nav.querySelectorAll('a').forEach(a=>{const target=(a.getAttribute('href')||'').split('?')[0];if(target===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
      }
    });
    document.querySelectorAll('.header-action a.pill-button').forEach(a=>{
      const identity = a.closest('[data-auth-identity]') || /profile|account/i.test(a.textContent||'') && /profile\.html/.test(a.href||'');
      if(identity) return;
      if(!/account\.html/.test(a.getAttribute('href')||'') || !/Join Jetvault/.test(a.textContent||'')){
        a.href='account.html?mode=signup'; a.innerHTML='Join Jetvault <span>↗</span>';
      }
    });
  }

  function simplifyFooter() {
    document.querySelectorAll('.site-footer').forEach(footer=>{
      const shell=footer.querySelector('.site-shell'); if(!shell) return;
      const top=footer.querySelector('.footer-top');
      if(top){
        top.innerHTML=`
          <div class="footer-brand"><a class="brand" href="index.html"><img class="jv-wordmark" src="assets/images/ui/jetvault-wordmark.png" alt="Jetvault"></a><p>A home for aviation photography and the people behind it.</p></div>
          <div class="footer-col"><h3>Explore</h3><a href="gallery.html">Photography</a><a href="photographers.html">Photographers</a><a href="rules.html">Photo standards</a></div>
          <div class="footer-col"><h3>Jetvault</h3><a href="account.html?mode=signup">Join / sign in</a><a href="about.html">About</a><a href="credits.html">Built by Mohammed</a></div>`;
      }
      const bottom=footer.querySelector('.footer-bottom');
      if(bottom) bottom.innerHTML='<span>© <span data-year></span> Jetvault</span><span>Aviation. Shared.</span>';
      if(!shell.querySelector('[data-build-credit]')){
        const row=document.createElement('div'); row.className='sa-build-credit'; row.dataset.buildCredit='';
        row.innerHTML='<span>Design &amp; development by <b>Mohammed</b></span><a href="credits.html">Build credits ↗</a><small class="jv-launch-disclosure">During launch, some site-curated content and promotional engagement may be used to demonstrate Jetvault features.</small>';
        shell.append(row);
      }
    });
  }

  function removeClutter() {
    document.querySelectorAll('[data-development-ribbon]').forEach(n=>n.remove());
    const candidates=[...document.querySelectorAll('button,a')];
    candidates.forEach(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      if(t==='report a bug'||t==='help & rate'||t==='help and rate'){
        const fixed=el.closest('[class*="bug"],[class*="help"],[class*="rate"]');
        (fixed||el).style.display='none';
      }
    });
    document.querySelectorAll('.eyebrow').forEach(n=>{
      if(/^v\d+(?:\.\d+)*\s*\//i.test((n.textContent||'').trim())){
        const clean=(n.textContent||'').replace(/^v\d+(?:\.\d+)*\s*\/\s*/i,'').trim();
        n.textContent=clean || 'Jetvault';
      }
    });
  }

  function updateMeta(){
    document.title=brandText(document.title||'Jetvault');
    const desc=document.querySelector('meta[name="description"]'); if(desc) desc.content=brandText(desc.content);
    document.documentElement.dataset.brand='jetvault';
  }

  function mount(){
    ensureStyle('assets/css/jetvault-clean.css');
    ensureStyle('assets/css/jetvault-v11-hotfix.css');
    if(page==='gallery.html') ensureScript('assets/js/gallery-views-v11.js');
    if(ADVANCED_EXPLORE.has(page)){
      ensureStyle('assets/css/styles-v8-1-2.css');
      ensureScript('assets/js/explore-v8-1-2.js');
    }
    if(ADVANCED_ECONOMY.has(page)){
      ensureStyle('assets/css/styles-v10.css');
      ensureScript('assets/js/economy-v10.js');
    }
    updateMeta(); setBrandMarks(); syncNav(); simplifyFooter(); rewriteText(); removeClutter();
    const year=document.querySelector('[data-year]'); if(year) year.textContent=new Date().getFullYear();

    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued) return; queued=true;
      requestAnimationFrame(()=>{queued=false; setBrandMarks(); syncNav(); rewriteText(); removeClutter();});
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{setBrandMarks();syncNav();rewriteText();removeClutter();},700);
    setTimeout(()=>{setBrandMarks();syncNav();rewriteText();removeClutter();},1800);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
