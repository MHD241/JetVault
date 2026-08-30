(() => {
  const backend=window.ScottishAeroBackend;
  const local=window.SCOTTISH_AERO || {photos:[],photographers:[]};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=n=>String(n||'JV').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

  function render(data){
    const photos=data.photos||[], people=data.photographers||[];
    const featured=photos.find(p=>p.featured)||photos[0];
    const hero=$('[data-jv-hero-image]');
    if(hero&&featured){hero.src=featured.src;hero.alt=featured.alt||featured.aircraft||'Aviation photograph';}
    const pc=$('[data-jv-photo-count]'); if(pc) pc.textContent=photos.length.toLocaleString('en-GB');
    const uc=$('[data-jv-people-count]'); if(uc) uc.textContent=people.length.toLocaleString('en-GB');

    const grid=$('[data-jv-photo-grid]');
    if(grid){
      const list=photos.slice(0,6);
      grid.innerHTML=list.length?list.map((p,i)=>`<a class="jv-photo-card" href="gallery.html?photo=${encodeURIComponent(p.id)}" data-reveal style="--delay:${i*45}ms"><img src="${esc(p.src)}" alt="${esc(p.alt||p.aircraft)}" loading="${i<2?'eager':'lazy'}" decoding="async"><div class="jv-photo-card__meta"><div><span>${esc(p.airline||'Aviation')}</span><h3>${esc(p.aircraft||'Aircraft')}</h3><p>${esc(p.reg||'Unknown')} · ${esc(p.airport||'Unknown')}</p></div><small>${esc(p.photographerName||'Photographer')}</small></div></a>`).join(''):'<div class="admin-empty">The archive is loading.</div>';
    }

    const pgrid=$('[data-jv-people-grid]');
    if(pgrid){
      const sorted=[...people].sort((a,b)=>Number(Boolean(a.isCrew))-Number(Boolean(b.isCrew)) || Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
      const list=sorted.slice(0,4);
      pgrid.innerHTML=list.length?list.map(p=>{
        const count=photos.filter(x=>x.ownerId===p.accountId||x.photographerName===p.name).length;
        const av=p.avatar?`<img src="${esc(p.avatar)}" alt="${esc(p.name)}" loading="lazy">`:`<span>${esc(initials(p.name))}</span>`;
        return `<a class="jv-person" href="profile.html?photographer=${encodeURIComponent(p.username||p.id)}" data-reveal><div class="jv-person__top"><div class="jv-person__avatar">${av}</div><div><span>@${esc(p.username||p.id)}</span><h3>${esc(p.name)}</h3></div></div><p>${esc(p.location||p.bio||'Aviation photographer')}</p><span class="jv-person__foot"><span>${count} approved frame${count===1?'':'s'}</span><span>Open profile ↗</span></span></a>`;
      }).join(''):'<div class="admin-empty">Photographer profiles are loading.</div>';
    }
    document.querySelectorAll('[data-reveal]').forEach(n=>requestAnimationFrame(()=>n.classList.add('is-visible')));
  }

  async function founding(){
    const remaining=[...document.querySelectorAll('[data-jv-founding-remaining]')];
    const claimed=[...document.querySelectorAll('[data-jv-founding-claimed]')];
    const setAll=(nodes,value)=>nodes.forEach(n=>n.textContent=value);
    if(!backend?.configured){setAll(remaining,'100');setAll(claimed,'0');return;}
    try{
      const db=await backend.ensureClient();
      const r=await db.from('founding_100').select('user_id',{count:'exact',head:true});
      const used=r.count||0;
      setAll(remaining,String(Math.max(0,100-used)));
      setAll(claimed,String(used));
    }catch(_){setAll(remaining,'—');setAll(claimed,'—');}
  }

  render({...local,photographers:(local.photographers||[]).map(p=>({...p,isCrew:true,username:p.id}))});
  if(backend?.configured) backend.getData().then(render).catch(()=>{});
  founding();
})();
