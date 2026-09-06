(() => {
  // JetVault Blue Gallery Engine V13
  // ZERO visual redesign: original blue classes/markup, faster data architecture.
  window.__JETVAULT_GALLERY_VIEWS_V11__ = true;

  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  const local = window.SCOTTISH_AERO || { photos: [], photographers: [] };
  const grid = document.querySelector('[data-gallery-grid]');
  if (!backend || !grid) return;

  const search = document.querySelector('[data-gallery-search]');
  const scope = document.querySelector('[data-scope-filter]');
  const airportFilter = document.querySelector('[data-airport-filter]');
  const airlineFilter = document.querySelector('[data-airline-filter]');
  const photographerSearch = document.querySelector('[data-photographer-search]');
  const count = document.querySelector('[data-gallery-count]');
  const clear = document.querySelector('[data-clear-filters]');
  const modal = document.querySelector('[data-lightbox]');
  const modalInner = modal?.querySelector('[data-lightbox-inner]');
  const params = new URLSearchParams(location.search);

  const PAGE_SIZE = 24;
  const META_PROFILE = '__SA_PROFILE__';
  const META_POST = '__SA_POST__';
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
  const slugify = v => String(v || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const safeSearch = v => String(v || '').replace(/[(),]/g,' ').replace(/\s+/g,' ').trim();
  const fmtDate = v => {
    if (!v) return 'Unknown';
    try {
      const raw = String(v);
      return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'})
        .format(new Date(raw.includes('T') ? raw : `${raw}T12:00:00`));
    } catch (_) { return 'Unknown'; }
  };

  let db = null;
  let profiles = [];
  let profileByOwner = new Map();
  let crewIds = [];
  let loaded = [];
  let total = 0;
  let globalCrewCount = 0;
  let globalCommunityCount = 0;
  let page = 0;
  let hasMore = true;
  let loading = false;
  let queryToken = 0;
  let activePhoto = null;
  let searchTimer = null;
  let sentinel = null;
  let io = null;

  const socialCache = new Map();
  const viewCache = new Map();

  async function client() {
    if (db) return db;
    db = await backend.ensureClient();
    return db;
  }

  function decorate(row, position = 1) {
    const person = profileByOwner.get(String(row.owner_id || ''));
    const fullSrc = /^assets\/images\/photos\/arran-.*\.jpg$/i.test(row.image_url || '')
      ? row.image_url.replace(/\.jpg$/i,'.webp')
      : (row.image_url || '');
    const thumbSrc = String(row.thumbnail_url || '').trim() || fullSrc;
    return {
      id: row.id,
      ownerId: row.owner_id || null,
      photographerName: row.photographer_name || person?.display_name || 'Unknown',
      photographer: person?.username || slugify(row.photographer_name),
      isCrew: Boolean(person?.is_crew),
      src: thumbSrc,
      thumbSrc,
      fullSrc,
      alt: row.alt_text || `${row.airline || 'Aircraft'} ${row.aircraft_type || ''}`.trim(),
      reg: row.registration || 'Unknown',
      aircraft: row.aircraft_type || 'Unknown',
      airline: row.airline || 'Unknown',
      airport: row.airport || 'Unknown',
      date: fmtDate(row.taken_at),
      takenAt: row.taken_at || null,
      caption: row.caption || '',
      ratio: row.ratio || 'standard',
      featured: Boolean(row.featured),
      createdAt: row.created_at || null,
      archivePosition: position
    };
  }

  function archiveNo(p) {
    return `JV / ${String(Math.max(1, Number(p.archivePosition || 1))).padStart(5,'0')}`;
  }

  // Exactly the existing JetVault blue photo card structure/classes.
  function card(p) {
    return `<article class="photo-card ${p.isCrew?'photo-card--crew':'photo-card--community'}" id="photo-${esc(p.id)}">
      <button class="photo-card__open" type="button" data-photo-id="${esc(p.id)}" aria-label="Open ${esc(p.airline)} ${esc(p.aircraft)}">
        <img src="${esc(p.thumbSrc || p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async" fetchpriority="low">
        <span class="photo-card__shade"></span>
        <span class="archive-stamp">${archiveNo(p)}</span>
        <span class="gallery-origin-badge ${p.isCrew?'gallery-origin-badge--crew':'gallery-origin-badge--community'}">${p.isCrew?'CREW':'GLOBAL'}</span>
        <span class="photo-card__meta">
          <span class="photo-card__eyebrow">${esc(p.airport)} · ${esc(p.date)}</span>
          <strong>${esc(p.reg)}</strong>
          <span>${esc(p.airline)} · ${esc(p.aircraft)}</span>
          <small>by ${esc(p.photographerName)}</small>
        </span>
        <span class="photo-card__arrow">↗</span>
      </button>
      <div class="photo-card__social" data-card-social="${esc(p.id)}">
        <button class="photo-card__quick-like" type="button" data-quick-like="${esc(p.id)}"><span>♡</span><b data-quick-like-count>0</b></button>
        <span class="photo-card__comment-count"><span>◌</span><b data-quick-comment-count>0</b></span>
        <span class="photo-card__view-count" data-jv-view-count><i>◉</i><b>0</b></span>
      </div>
    </article>`;
  }

  function baseQuery(withCount = false) {
    let q = db.from('photos').select(
      'id,owner_id,photographer_name,image_url,thumbnail_url,registration,aircraft_type,airline,airport,taken_at,caption,alt_text,ratio,featured,sort_order,created_at,status',
      withCount ? { count:'exact' } : undefined
    )
      .eq('status','approved')
      .not('registration','in',`("${META_PROFILE}","${META_POST}")`);

    const qText = safeSearch(search?.value);
    const photographerText = safeSearch(photographerSearch?.value);
    const ap = airportFilter?.value || '';
    const air = airlineFilter?.value || '';
    const sc = scope?.value || '';

    if (qText) q = q.or(
      `registration.ilike.%${qText}%,aircraft_type.ilike.%${qText}%,airline.ilike.%${qText}%,airport.ilike.%${qText}%,photographer_name.ilike.%${qText}%`
    );
    if (photographerText) q = q.ilike('photographer_name', `%${photographerText}%`);
    if (ap) q = q.eq('airport', ap);
    if (air) q = q.eq('airline', air);
    if (sc === 'crew') {
      if (crewIds.length) q = q.in('owner_id', crewIds);
      else q = q.eq('owner_id','00000000-0000-0000-0000-000000000000');
    } else if (sc === 'community' && crewIds.length) {
      q = q.not('owner_id','in',`(${crewIds.join(',')})`);
    }

    return q.order('featured',{ascending:false})
      .order('sort_order',{ascending:true,nullsFirst:false})
      .order('created_at',{ascending:false});
  }

  async function loadProfilesAndFilterMeta() {
    const c = await client();
    if (!c) throw new Error('Database unavailable');

    const [p, meta] = await Promise.all([
      c.from('profiles').select('id,display_name,username,avatar_url,is_crew').limit(300),
      c.from('photos')
        .select('owner_id,airport,airline,photographer_name')
        .eq('status','approved')
        .not('registration','in',`("${META_PROFILE}","${META_POST}")`)
        .limit(1000)
    ]);

    profiles = p.data || [];
    profileByOwner = new Map(profiles.map(x => [String(x.id), x]));
    crewIds = profiles.filter(x => x.is_crew).map(x => x.id);

    const rows = meta.data || [];
    globalCrewCount = rows.filter(x => profileByOwner.get(String(x.owner_id || ''))?.is_crew).length;
    globalCommunityCount = Math.max(0, rows.length - globalCrewCount);

    const setOptions = (sel, vals, label) => {
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = `<option value="">${label}</option>`;
      [...new Set(vals.filter(v => v && v !== 'Unknown'))].sort((a,b)=>a.localeCompare(b)).forEach(v => {
        const o = document.createElement('option'); o.value=v; o.textContent=v; sel.append(o);
      });
      if ([...sel.options].some(o => o.value === current)) sel.value = current;
    };
    setOptions(airportFilter, rows.map(x=>x.airport), 'All airports');
    setOptions(airlineFilter, rows.map(x=>x.airline), 'All operators');
  }

  async function fetchViewCounts(ids) {
    const missing = [...new Set(ids.map(String))].filter(id => !viewCache.has(id));
    if (!missing.length) return;
    try {
      const {data,error} = await db.rpc('get_photo_view_counts',{p_photo_ids:missing});
      if (error) return;
      missing.forEach(id => viewCache.set(id,0));
      (data||[]).forEach(r => viewCache.set(String(r.photo_id),Number(r.views||0)));
    } catch (_) {}
  }

  async function hydrate(ids, token) {
    if (!ids.length || token !== queryToken) return;
    const jobs=[fetchViewCounts(ids)];
    if (social) {
      const missing=ids.filter(id=>!socialCache.has(String(id)));
      if (missing.length) jobs.push(
        social.getCounts(missing).then(r=>{
          Object.entries(r||{}).forEach(([id,v])=>socialCache.set(String(id),v));
        }).catch(()=>{})
      );
    }
    await Promise.all(jobs);
    if (token !== queryToken) return;

    ids.forEach(id=>{
      const key=String(id);
      const node=grid.querySelector(`[data-card-social="${CSS.escape(key)}"]`);
      if(!node)return;
      const s=socialCache.get(key)||{likes:0,comments:0,liked:false};
      const btn=node.querySelector('[data-quick-like]');
      const lc=node.querySelector('[data-quick-like-count]');
      const cc=node.querySelector('[data-quick-comment-count]');
      const vc=node.querySelector('[data-jv-view-count] b');
      if(lc)lc.textContent=Number(s.likes||0).toLocaleString('en-GB');
      if(cc)cc.textContent=Number(s.comments||0).toLocaleString('en-GB');
      if(vc)vc.textContent=Number(viewCache.get(key)||0).toLocaleString('en-GB');
      if(btn){
        btn.classList.toggle('is-active',Boolean(s.liked));
        const h=btn.querySelector('span'); if(h)h.textContent=s.liked?'♥':'♡';
      }
    });
  }

  function updateCount() {
    if(!count)return;
    count.textContent=`${total} photograph${total===1?'':'s'} · ${globalCrewCount} crew · ${globalCommunityCount} community`;
  }

  function ensureSentinel() {
    if(sentinel?.isConnected)return;
    sentinel=document.createElement('div');
    sentinel.setAttribute('aria-hidden','true');
    sentinel.style.cssText='height:1px;width:100%;pointer-events:none;';
    grid.insertAdjacentElement('afterend',sentinel);

    io?.disconnect();
    io=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)) loadNext();
    },{rootMargin:'900px 0px'});
    io.observe(sentinel);
  }

  function maybeContinue() {
    if(!sentinel||!hasMore||loading)return;
    const r=sentinel.getBoundingClientRect();
    if(r.top < innerHeight + 900) setTimeout(()=>loadNext(),35);
  }

  async function loadNext() {
    if(loading||!hasMore||!db)return;
    loading=true;
    const token=queryToken;
    const from=page*PAGE_SIZE, to=from+PAGE_SIZE-1;
    try {
      const {data:rows,error,count:exact}=await baseQuery(true).range(from,to);
      if(error)throw error;
      if(token!==queryToken)return;

      total=Number(exact||0);
      const items=(rows||[]).map((row,i)=>decorate(row,from+i+1));
      if(page===0)grid.innerHTML='';
      loaded.push(...items);
      if(items.length)grid.insertAdjacentHTML('beforeend',items.map(card).join(''));
      page++;
      hasMore=loaded.length<total && items.length>0;
      updateCount();
      hydrate(items.map(x=>x.id),token);

      if(!loaded.length)grid.innerHTML='<div class="gallery-empty">No photographs matched those filters.</div>';
    } catch(e) {
      console.warn('JetVault gallery page unavailable',e);
      if(page===0 && !loaded.length) fallbackLocal();
    } finally {
      loading=false;
      maybeContinue();
    }
  }

  async function reset() {
    queryToken++;
    page=0;total=0;hasMore=true;loading=false;loaded=[];
    grid.innerHTML='';
    updateCount();
    await loadNext();
  }

  function fallbackLocal() {
    const q=(search?.value||'').trim().toLowerCase();
    const ap=airportFilter?.value||'', air=airlineFilter?.value||'';
    const ph=(photographerSearch?.value||'').trim().toLowerCase(), sc=scope?.value||'';
    const list=(local.photos||[]).map((p,i)=>({
      ...p,isCrew:true,thumbSrc:p.thumbSrc||p.src,fullSrc:p.fullSrc||p.src,archivePosition:i+1
    })).filter(p=>{
      const hay=[p.reg,p.aircraft,p.airline,p.airport,p.date,p.photographerName,p.caption].join(' ').toLowerCase();
      return(!q||hay.includes(q))&&(!ap||p.airport===ap)&&(!air||p.airline===air)
        &&(!ph||String(p.photographerName||'').toLowerCase().includes(ph))
        &&(!sc||sc==='crew');
    });
    loaded=list.slice(0,PAGE_SIZE); total=list.length; hasMore=false;
    grid.innerHTML=loaded.length?loaded.map(card).join(''):'<div class="gallery-empty">Gallery temporarily unavailable.</div>';
    updateCount();
  }

  async function getPhoto(id) {
    const inMemory=loaded.find(p=>String(p.id)===String(id));
    if(inMemory)return inMemory;
    if(!db)return null;
    const {data,error}=await db.from('photos')
      .select('id,owner_id,photographer_name,image_url,thumbnail_url,registration,aircraft_type,airline,airport,taken_at,caption,alt_text,ratio,featured,sort_order,created_at,status')
      .eq('id',id).maybeSingle();
    if(error||!data)return null;
    return decorate(data,1);
  }

  async function openLightbox(id) {
    activePhoto=await getPhoto(id);
    if(!activePhoto||!modal||!modalInner)return;
    const link=`${location.origin}${location.pathname}?photo=${encodeURIComponent(activePhoto.id)}`;

    // Exact existing blue lightbox structure/classes.
    modalInner.innerHTML=`<div class="lightbox__media">
      <img src="${esc(activePhoto.fullSrc||activePhoto.src)}" alt="${esc(activePhoto.alt)}" decoding="async" fetchpriority="high">
      <span class="lightbox-origin">${activePhoto.isCrew?'JETVAULT CREW':'GLOBAL COMMUNITY'}</span>
    </div><div class="lightbox__info">
      <span class="eyebrow">${archiveNo(activePhoto)} · ${esc(activePhoto.airline)} · ${esc(activePhoto.airport)}</span>
      <h2>${esc(activePhoto.reg)}</h2>
      <p>${esc(activePhoto.caption||'A Jetvault community photograph.')}</p>
      <div class="detail-list">
        <div class="detail-row"><span>Aircraft</span><b>${esc(activePhoto.aircraft)}</b></div>
        <div class="detail-row"><span>Operator</span><b>${esc(activePhoto.airline)}</b></div>
        <div class="detail-row"><span>Registration</span><b>${esc(activePhoto.reg)}</b></div>
        <div class="detail-row"><span>Airport</span><b>${esc(activePhoto.airport)}</b></div>
        <div class="detail-row"><span>Date</span><b>${esc(activePhoto.date)}</b></div>
        <div class="detail-row"><span>Photographer</span><b><a class="detail-profile-link" href="profile.html?photographer=${encodeURIComponent(activePhoto.photographer)}">${esc(activePhoto.photographerName)} ${activePhoto.isCrew?'· CREW':''} ↗</a></b></div>
      </div>
      <div class="lightbox-share"><button class="mini-button" type="button" data-share-photo>Share photo ↗</button><span data-share-status></span></div>
      <div class="photo-social-panel" data-photo-social></div>
    </div>`;

    modal.showModal();
    document.body.classList.add('modal-open');
    backend.trackPhotoView(activePhoto.id);
    social?.mountContentSocial(modalInner.querySelector('[data-photo-social]'),activePhoto.id);

    await fetchViewCounts([activePhoto.id]);
    const host=modalInner.querySelector('[data-photo-social] .social-bar')||modalInner.querySelector('.lightbox-share');
    if(host&&!modalInner.querySelector('[data-jv-lightbox-views]')){
      const pill=document.createElement('span');
      pill.className='jv-lightbox-view';pill.dataset.jvLightboxViews='';
      pill.innerHTML=`<span>◉</span><b>${Number(viewCache.get(String(activePhoto.id))||0).toLocaleString('en-GB')}</b><span>views</span>`;
      host.append(pill);
    }

    const share=modalInner.querySelector('[data-share-photo]');
    if(share)share.onclick=async()=>{
      try{
        if(navigator.share)await navigator.share({title:`${activePhoto.airline} ${activePhoto.aircraft} — Jetvault`,url:link});
        else{await navigator.clipboard.writeText(link);modalInner.querySelector('[data-share-status]').textContent='Link copied';}
      }catch(_){}
    };
    history.replaceState(null,'',`gallery.html?photo=${encodeURIComponent(activePhoto.id)}`);
  }

  async function quickLike(btn) {
    if(!social)return;
    btn.disabled=true;
    try{
      const s=await social.toggleLike(btn.dataset.quickLike);
      if(!s)return;
      socialCache.set(String(btn.dataset.quickLike),s);
      btn.classList.toggle('is-active',Boolean(s.liked));
      const heart=btn.querySelector('span'),num=btn.querySelector('b');
      if(heart)heart.textContent=s.liked?'♥':'♡';
      if(num)num.textContent=Number(s.likes||0).toLocaleString('en-GB');
    }finally{btn.disabled=false}
  }

  async function shift(d) {
    if(!activePhoto)return;
    let i=loaded.findIndex(p=>String(p.id)===String(activePhoto.id));
    if(i<0)return;
    if(d>0 && i===loaded.length-1 && hasMore){await loadNext();i=loaded.findIndex(p=>String(p.id)===String(activePhoto.id))}
    const next=loaded[i+d];
    if(next)openLightbox(next.id);
  }

  grid.addEventListener('click',e=>{
    const like=e.target.closest('[data-quick-like]');
    if(like){e.preventDefault();e.stopPropagation();quickLike(like);return}
    const open=e.target.closest('[data-photo-id]');
    if(open)openLightbox(open.dataset.photoId);
  });

  [scope,airportFilter,airlineFilter].filter(Boolean).forEach(el=>el.addEventListener('change',reset));
  [search,photographerSearch].filter(Boolean).forEach(el=>el.addEventListener('input',()=>{
    clearTimeout(searchTimer);searchTimer=setTimeout(reset,180);
  }));
  clear?.addEventListener('click',()=>{
    if(search)search.value='';if(scope)scope.value='';if(airportFilter)airportFilter.value='';
    if(airlineFilter)airlineFilter.value='';if(photographerSearch)photographerSearch.value='';
    history.replaceState(null,'','gallery.html');reset();
  });

  modal?.querySelector('[data-lightbox-close]')?.addEventListener('click',()=>modal.close());
  modal?.querySelector('[data-lightbox-prev]')?.addEventListener('click',()=>shift(-1));
  modal?.querySelector('[data-lightbox-next]')?.addEventListener('click',()=>shift(1));
  modal?.addEventListener('close',()=>{document.body.classList.remove('modal-open');history.replaceState(null,'','gallery.html')});
  modal?.addEventListener('click',e=>{if(e.target===modal)modal.close()});
  addEventListener('keydown',e=>{
    if(!modal?.open)return;
    if(e.key==='ArrowLeft')shift(-1);if(e.key==='ArrowRight')shift(1);if(e.key==='Escape')modal.close();
  });

  async function boot() {
    document.body.classList.add('page-ready');
    ensureSentinel();
    try{
      db=await client();
      if(!db)throw new Error('No database client');
      await loadProfilesAndFilterMeta();

      if(params.get('airport')&&airportFilter)airportFilter.value=params.get('airport');
      if(params.get('photographer')&&photographerSearch){
        const key=params.get('photographer');
        const person=profiles.find(x=>String(x.username||x.id)===String(key)||String(x.id)===String(key));
        photographerSearch.value=person?.display_name||key;
      }
      if(params.get('scope')&&scope)scope.value=params.get('scope');

      await reset();
      const target=params.get('photo');if(target)setTimeout(()=>openLightbox(target),80);
    }catch(e){
      console.warn('JetVault fast gallery fallback',e);
      fallbackLocal();
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
