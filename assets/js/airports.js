(() => {
  const J=window.JetVault, UI=window.JVUI; if(!J)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function list(){
    const n=document.querySelector('[data-airports-list]');if(!n)return;
    const db=await J.ensureClient();
    const [refs,photos]=await Promise.all([
      db.from('airport_reference').select('*').order('country').order('name'),
      db.from('photos').select('airport').eq('status','approved').not('registration','in','("__SA_PROFILE__","__SA_POST__")').limit(1000)
    ]);
    const counts={};(photos.data||[]).forEach(x=>counts[x.airport]=(counts[x.airport]||0)+1);
    n.innerHTML=(refs.data||[]).map(a=>`<a class="info-card" href="airport.html?code=${encodeURIComponent(a.code)}"><span>${esc(a.country)} · ${esc(a.kind)}</span><b>${esc(a.name)}</b><p>${esc(a.iata||a.code)} / ${esc(a.icao||'—')} · ${counts[a.code]||counts[a.iata]||0} photos</p></a>`).join('');
  }
  async function detail(){
    const host=document.querySelector('[data-airport-detail]');if(!host)return;
    const code=new URLSearchParams(location.search).get('code')||'EDI',db=await J.ensureClient();
    const {data:a}=await db.from('airport_reference').select('*').or(`code.eq.${code},slug.eq.${code.toLowerCase()}`).maybeSingle();
    if(!a){host.innerHTML='<div class="empty">Airport not found.</div>';return}
    document.querySelector('[data-airport-name]').textContent=a.name;
    document.querySelector('[data-airport-meta]').textContent=`${a.city||''} · ${a.country} · ${a.iata||a.code} / ${a.icao||'—'}`;
    let r=await J.listPhotos({airport:a.code,pageSize:36});if(!r.items.length&&a.iata&&a.iata!==a.code)r=await J.listPhotos({airport:a.iata,pageSize:36});
    const g=document.querySelector('[data-airport-photos]');g.innerHTML=r.items.length?r.items.map(UI.photoCard).join(''):'<div class="empty">No photographs from this airport yet.</div>';
    g.addEventListener('click',e=>{const b=e.target.closest('[data-open-photo]');if(b)location.href=`gallery.html?photo=${encodeURIComponent(b.dataset.openPhoto)}`});
  }
  list().catch(console.warn);detail().catch(console.warn);
})();
