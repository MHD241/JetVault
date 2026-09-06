(() => {
  const J=window.JetVault,UI=window.JVUI;if(!J)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function creators(){
    const g=document.querySelector('[data-creators]');if(!g)return;
    const rows=await J.listProfiles();
    g.innerHTML=rows.map(p=>`<a class="info-card" href="profile.html?photographer=${encodeURIComponent(p.username||J.slugify(p.display_name))}"><span>${p.is_crew?'JETVAULT CREW':'COMMUNITY CREATOR'}</span><b>${esc(p.display_name)}</b><p>${esc(p.location||'Aviation photographer')} · ${esc(p.favourite_aircraft||'Aircraft enthusiast')}</p></a>`).join('');
  }
  async function profile(){
    const host=document.querySelector('[data-profile]');if(!host)return;
    const key=new URLSearchParams(location.search).get('photographer')||'mhd241',p=await J.getProfile(key);
    if(!p){host.innerHTML='<div class="empty">Creator not found.</div>';return}
    const initial=(p.display_name||'?').trim()[0].toUpperCase();
    document.querySelector('[data-profile-avatar]').innerHTML=p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:initial;
    document.querySelector('[data-profile-name]').textContent=p.display_name;
    document.querySelector('[data-profile-bio]').textContent=p.bio||'Aviation photographer on JetVault.';
    document.querySelector('[data-profile-meta]').textContent=[p.location,p.favourite_airport&&`Favourite airport: ${p.favourite_airport}`,p.favourite_aircraft&&`Favourite aircraft: ${p.favourite_aircraft}`].filter(Boolean).join(' · ');
    const r=await J.listPhotos({ownerId:p.id,pageSize:48});
    document.querySelector('[data-profile-photo-count]').textContent=r.count;
    const g=document.querySelector('[data-profile-photos]');g.innerHTML=r.items.length?r.items.map(UI.photoCard).join(''):'<div class="empty">No approved photographs yet.</div>';
    g.addEventListener('click',e=>{const b=e.target.closest('[data-open-photo]');if(b)location.href=`gallery.html?photo=${encodeURIComponent(b.dataset.openPhoto)}`});
  }
  creators().catch(console.warn);profile().catch(console.warn);
})();
