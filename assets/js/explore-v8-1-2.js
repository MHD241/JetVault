(() => {
  if (window.__SCOTTISH_AERO_EXPLORE_V812__) return;
  window.__SCOTTISH_AERO_EXPLORE_V812__ = true;

  const backend = window.ScottishAeroBackend;
  const PAGE_SIZE = 1000;
  const esc = value => String(value ?? '').replace(/[&<>\'\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const norm = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ');
  const slug = value => norm(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const fmt = value => Number(value || 0).toLocaleString();
  const validValue = value => {
    const v = norm(value);
    return v && !['unknown','n/a','na','none','-'].includes(v);
  };

  let dbPromise;
  let airportPromise;
  let photoPromise;
  let profilePromise;

  async function dbReady() {
    if (!backend?.configured) return null;
    if (!dbPromise) dbPromise = backend.ensureClient().catch(() => null);
    return dbPromise;
  }

  async function getSessionUser(db) {
    if (!db) return null;
    const {data} = await db.auth.getSession();
    return data?.session?.user || null;
  }

  async function getAirports(db) {
    if (!airportPromise) airportPromise = db.from('airport_reference').select('*').order('name').then(({data,error}) => {
      if (error) throw error;
      return data || [];
    });
    return airportPromise;
  }

  async function getProfiles(db) {
    if (!profilePromise) profilePromise = db.from('profiles').select('id,username,display_name,avatar_url,is_crew,location').then(({data,error}) => {
      if (error) throw error;
      return data || [];
    });
    return profilePromise;
  }

  async function getAllApprovedPhotos(db) {
    if (!photoPromise) photoPromise = (async () => {
      const rows = [];
      let from = 0;
      while (true) {
        const {data,error} = await db.from('photos')
          .select('id,owner_id,photographer_name,image_url,registration,aircraft_type,airline,airport,taken_at,caption,created_at,approved_at')
          .eq('status','approved')
          .neq('registration','__SA_PROFILE__')
          .neq('registration','__SA_POST__')
          .order('created_at',{ascending:false})
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (from > 20000) break;
      }
      return rows;
    })();
    return photoPromise;
  }

  function airportMatcher(refs) {
    const index = new Map();
    refs.forEach(ref => {
      const values = [ref.code, ref.iata, ref.icao, ref.name, ...(ref.aliases || [])];
      values.filter(Boolean).forEach(value => index.set(norm(value), ref));
    });
    return value => index.get(norm(value)) || null;
  }

  const AIRCRAFT_RULES = [
    [/beluga|a330-?743l/i, 'AIRBUS BELUGAXL', 'Airbus', 'Special Transport'],
    [/\ba\s*220|airbus\s*a-?220/i, 'AIRBUS A220', 'Airbus', 'A220 Family'],
    [/\ba\s*318|airbus\s*a-?318/i, 'AIRBUS A318', 'Airbus', 'A320 Family'],
    [/\ba\s*319|airbus\s*a-?319/i, 'AIRBUS A319', 'Airbus', 'A320 Family'],
    [/\ba\s*320|airbus\s*a-?320/i, 'AIRBUS A320', 'Airbus', 'A320 Family'],
    [/\ba\s*321|airbus\s*a-?321/i, 'AIRBUS A321', 'Airbus', 'A320 Family'],
    [/\ba\s*330|airbus\s*a-?330/i, 'AIRBUS A330', 'Airbus', 'A330 Family'],
    [/\ba\s*350|airbus\s*a-?350/i, 'AIRBUS A350', 'Airbus', 'A350 Family'],
    [/\ba\s*380|airbus\s*a-?380/i, 'AIRBUS A380', 'Airbus', 'A380 Family'],
    [/\b737\b|boeing\s*737/i, 'BOEING 737', 'Boeing', '737 Family'],
    [/\b757\b|boeing\s*757/i, 'BOEING 757', 'Boeing', '757 Family'],
    [/\b767\b|boeing\s*767/i, 'BOEING 767', 'Boeing', '767 Family'],
    [/\b777\b|boeing\s*777/i, 'BOEING 777', 'Boeing', '777 Family'],
    [/\b787\b|boeing\s*787/i, 'BOEING 787', 'Boeing', '787 Dreamliner'],
    [/c-?17|globemaster/i, 'BOEING C-17', 'Boeing', 'Military Airlift'],
    [/a400m|atlas/i, 'AIRBUS A400M', 'Airbus', 'Military Airlift'],
    [/concorde/i, 'CONCORDE', 'BAC / Aérospatiale', 'Supersonic'],
    [/eurofighter|typhoon/i, 'EUROFIGHTER TYPHOON', 'Eurofighter', 'Fast Jet'],
    [/f-?15|strike eagle/i, 'F-15 EAGLE', 'McDonnell Douglas', 'Fast Jet'],
    [/f-?35|lightning ii/i, 'F-35 LIGHTNING II', 'Lockheed Martin', 'Fast Jet'],
    [/spitfire/i, 'SUPERMARINE SPITFIRE', 'Supermarine', 'Warbird'],
    [/chinook/i, 'CH-47 CHINOOK', 'Boeing', 'Helicopter'],
    [/s\s*-?92|s92/i, 'SIKORSKY S-92', 'Sikorsky', 'Helicopter'],
    [/ec\s*-?135|h135/i, 'AIRBUS H135 / EC135', 'Airbus Helicopters', 'Helicopter'],
    [/ec\s*-?145|h145/i, 'AIRBUS H145 / EC145', 'Airbus Helicopters', 'Helicopter'],
    [/as\s*-?365|dauphin/i, 'AS365 DAUPHIN', 'Aérospatiale', 'Helicopter'],
    [/as\s*-?332|super puma/i, 'AS332 SUPER PUMA', 'Aérospatiale', 'Helicopter'],
    [/\bh125\b/i, 'AIRBUS H125', 'Airbus Helicopters', 'Helicopter'],
    [/hawk\s*t?2|hawk/i, 'BAE HAWK', 'BAE Systems', 'Fast Jet'],
    [/atr\s*-?42/i, 'ATR 42', 'ATR', 'Regional'],
    [/atr\s*-?72/i, 'ATR 72', 'ATR', 'Regional'],
    [/king air|b-?200/i, 'BEECHCRAFT KING AIR', 'Beechcraft', 'Turboprop'],
    [/challenger\s*650/i, 'CHALLENGER 650', 'Bombardier', 'Business Jet'],
    [/\bpc\s*-?12\b/i, 'PILATUS PC-12', 'Pilatus', 'Turboprop'],
    [/\bpc\s*-?24\b/i, 'PILATUS PC-24', 'Pilatus', 'Business Jet'],
    [/cessna\s*152/i, 'CESSNA 152', 'Cessna', 'General Aviation'],
    [/cessna\s*208|grand caravan/i, 'CESSNA 208', 'Cessna', 'Turboprop'],
    [/pa-?28|piper warrior|cherokee/i, 'PIPER PA-28', 'Piper', 'General Aviation'],
    [/k21|ask21/i, 'SCHLEICHER ASK 21', 'Schleicher', 'Glider'],
    [/perkoz/i, 'SZD-54 PERKOZ', 'Allstar PZL', 'Glider'],
    [/glider/i, 'GLIDER', 'Various', 'Glider']
  ];

  function aircraftMeta(raw) {
    const source = String(raw || '').trim();
    for (const [regex,name,maker,family] of AIRCRAFT_RULES) {
      if (regex.test(source)) return {key:slug(name),name,maker,family};
    }
    const cleaned = source || 'Unknown aircraft';
    const maker = /^airbus/i.test(cleaned) ? 'Airbus' : /^boeing/i.test(cleaned) ? 'Boeing' : /^cessna/i.test(cleaned) ? 'Cessna' : /^piper/i.test(cleaned) ? 'Piper' : 'Other';
    return {key:slug(cleaned),name:cleaned.toUpperCase(),maker,family:'Archive Type'};
  }

  function groupAircraft(photos) {
    const map = new Map();
    photos.filter(p => validValue(p.aircraft_type)).forEach(photo => {
      const meta = aircraftMeta(photo.aircraft_type);
      const row = map.get(meta.key) || {...meta,count:0,firstSeen:null,lastSeen:null,photo:null};
      row.count += 1;
      const date = photo.taken_at || photo.created_at || null;
      if (date && (!row.firstSeen || date < row.firstSeen)) row.firstSeen = date;
      if (date && (!row.lastSeen || date > row.lastSeen)) row.lastSeen = date;
      if (!row.photo) row.photo = photo.image_url || null;
      map.set(meta.key,row);
    });
    return [...map.values()].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  function groupAirports(photos, refs) {
    const match = airportMatcher(refs);
    const map = new Map();
    const unmapped = new Map();
    photos.forEach(photo => {
      if (!validValue(photo.airport)) return;
      const ref = match(photo.airport);
      if (!ref) {
        const key = norm(photo.airport);
        const row = unmapped.get(key) || {name:photo.airport,count:0};
        row.count += 1;
        unmapped.set(key,row);
        return;
      }
      const row = map.get(ref.code) || {ref,count:0,photos:[],photographers:new Set(),aircraft:new Set(),airlines:new Set(),rawNames:new Map(),latest:null};
      row.count += 1;
      row.photos.push(photo);
      if (photo.owner_id) row.photographers.add(photo.owner_id);
      if (validValue(photo.aircraft_type)) row.aircraft.add(aircraftMeta(photo.aircraft_type).key);
      if (validValue(photo.airline)) row.airlines.add(norm(photo.airline));
      row.rawNames.set(photo.airport,(row.rawNames.get(photo.airport)||0)+1);
      if (!row.latest) row.latest = photo;
      map.set(ref.code,row);
    });
    return {mapped:[...map.values()].sort((a,b)=>b.count-a.count),unmapped:[...unmapped.values()].sort((a,b)=>b.count-a.count)};
  }

  function passportData(userPhotos, allPhotos, refs) {
    const airports = groupAirports(userPhotos,refs).mapped;
    const countriesMap = new Map();
    airports.forEach(item => {
      const key = item.ref.country;
      const row = countriesMap.get(key) || {name:key,locations:0,frames:0};
      row.locations += 1;
      row.frames += item.count;
      countriesMap.set(key,row);
    });
    const airlinesMap = new Map();
    userPhotos.filter(p=>validValue(p.airline)).forEach(p=>{
      const key=norm(p.airline);
      if (['private'].includes(key)) return;
      const row=airlinesMap.get(key)||{name:p.airline,count:0}; row.count+=1; airlinesMap.set(key,row);
    });
    const allAircraft = groupAircraft(allPhotos);
    const ownAircraft = groupAircraft(userPhotos);
    const ownKeys = new Set(ownAircraft.map(x=>x.key));
    const ownMap = new Map(ownAircraft.map(x=>[x.key,x]));
    const collection = allAircraft.map(global => ({...global,unlocked:ownKeys.has(global.key),own:ownMap.get(global.key)||null}));
    const unlocked = collection.filter(x=>x.unlocked).length;
    return {
      approved:userPhotos.length,
      airports,
      countries:[...countriesMap.values()].sort((a,b)=>b.frames-a.frames),
      airlines:[...airlinesMap.values()].sort((a,b)=>b.count-a.count),
      collection,
      unlocked,
      total:collection.length,
      completion:collection.length ? Math.round(unlocked/collection.length*100) : 0
    };
  }

  function formatDate(value) {
    if (!value) return 'Archive logged';
    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? 'Archive logged' : date.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
  }

  function passportCover(profile,data) {
    const handle = profile?.username ? `@${profile.username}` : 'SCOTTISH.AERO';
    return `<article class="v812-passport-cover">
      <div class="v812-passport-cover__top"><span>SCOTTISH.AERO / SPOTTER PASSPORT</span><span>ISSUED 2026</span></div>
      <div class="v812-passport-cover__id"><small>AVIATION PHOTOGRAPHER</small><h2>${esc(profile?.display_name || 'Spotter')}</h2><p>${esc(handle)} · ${fmt(data.approved)} approved frames</p></div>
      <div class="v812-passport-cover__mark">SA<br>PASSPORT</div>
    </article>`;
  }

  function passportStats(data) {
    return `<div class="v812-passport-stats">
      <article><b>${fmt(data.approved)}</b><span>Approved frames</span></article>
      <article><b>${fmt(data.airports.length)}</b><span>Mapped locations</span></article>
      <article><b>${fmt(data.countries.length)}</b><span>Countries</span></article>
      <article><b>${fmt(data.unlocked)} / ${fmt(data.total)}</b><span>Aircraft unlocked</span></article>
      <article><b>${data.completion}%</b><span>Collection complete</span></article>
    </div>`;
  }

  function airportStamps(data) {
    if (!data.airports.length) return '<div class="v812-empty"><b>No airport stamps yet.</b><span>Your first approved upload with a mapped location will stamp the passport.</span></div>';
    return `<div class="v812-stamp-grid">${data.airports.map(item => `<article class="v812-stamp">
      <span>${esc(item.ref.code)} / ${esc(item.ref.region || item.ref.country)}</span><em>${fmt(item.count)} FRAME${item.count===1?'':'S'}</em>
      <b>${esc(item.ref.name)}</b><small>${esc(item.ref.city || item.ref.region)} · ${esc(item.ref.country)}</small>
    </article>`).join('')}</div>`;
  }

  function countryStamps(data) {
    if (!data.countries.length) return '<div class="v812-empty"><b>No country stamps yet.</b><span>Mapped approved photos unlock countries automatically.</span></div>';
    return `<div class="v812-country-row">${data.countries.map(c=>`<article class="v812-country"><b>${esc(c.name)}</b><span>${fmt(c.locations)} location${c.locations===1?'':'s'} · ${fmt(c.frames)} frame${c.frames===1?'':'s'}</span></article>`).join('')}</div>`;
  }

  function airlineLog(data) {
    if (!data.airlines.length) return '<div class="v812-empty"><b>No airline log yet.</b><span>Approved photography will build it automatically.</span></div>';
    return `<ul class="v812-airline-log">${data.airlines.slice(0,60).map(a=>`<li><b>${esc(a.name)}</b><span>${fmt(a.count)}</span></li>`).join('')}</ul>`;
  }

  function aircraftCollection(data) {
    if (!data.collection.length) return '<div class="v812-empty"><b>The collection book is waiting for archive data.</b></div>';
    const cards = data.collection.map(item => {
      const own = item.own;
      return `<article class="v812-aircraft ${item.unlocked?'is-unlocked':'is-locked'}" data-aircraft-state="${item.unlocked?'unlocked':'locked'}">
        <span class="v812-aircraft__maker">${esc(item.maker)} / ${esc(item.family)}</span>
        <h4>${esc(item.name)}</h4>
        <p>${item.unlocked ? `${fmt(own.count)} approved · first ${esc(formatDate(own.firstSeen))}` : `Seen in the global archive · ${fmt(item.count)} frame${item.count===1?'':'s'}`}</p>
        <em>${item.unlocked?'UNLOCKED ✓':'LOCKED'}</em>
      </article>`;
    }).join('');
    return `<div class="v812-collection-toolbar"><button class="is-active" type="button" data-v812-filter="all">All ${data.total}</button><button type="button" data-v812-filter="unlocked">Unlocked ${data.unlocked}</button><button type="button" data-v812-filter="locked">Locked ${data.total-data.unlocked}</button></div><div class="v812-aircraft-grid">${cards}</div>`;
  }

  function bindCollectionFilters(root) {
    root.querySelectorAll('[data-v812-filter]').forEach(button => button.addEventListener('click',()=>{
      root.querySelectorAll('[data-v812-filter]').forEach(b=>b.classList.toggle('is-active',b===button));
      const mode=button.dataset.v812Filter;
      root.querySelectorAll('[data-aircraft-state]').forEach(card=>{card.hidden=mode!=='all' && card.dataset.aircraftState!==mode;});
    }));
  }

  function fullPassportMarkup(profile,data) {
    return `<div class="v812-passport-shell">
      ${passportCover(profile,data)}
      ${passportStats(data)}
      <section class="v812-module"><div class="v812-module__head"><div><span>Spotter Passport / Stamps</span><h3>Places you've logged.</h3></div><p>Location stamps appear only from approved archive photography and are matched against the Scottish.aero airport reference.</p></div>${airportStamps(data)}</section>
      <section class="v812-module"><div class="v812-module__head"><div><span>Countries</span><h3>Across borders.</h3></div><p>One approved mapped frame is enough to unlock a country stamp.</p></div>${countryStamps(data)}</section>
      <section class="v812-module" data-v812-collection><div class="v812-module__head"><div><span>Aircraft Collection Book</span><h3>${data.unlocked} of ${data.total} archive types unlocked.</h3></div><p>The global archive defines the collection. Your approved photographs turn the silhouettes into permanent unlocks.</p></div>${aircraftCollection(data)}</section>
      <section class="v812-module"><div class="v812-module__head"><div><span>Operator log</span><h3>Airlines & operators.</h3></div><p>A running record built from the operator metadata on approved uploads.</p></div>${airlineLog(data)}</section>
    </div>`;
  }

  function compactPassportMarkup(profile,data) {
    return `<div class="v812-passport-compact">
      ${passportCover(profile,data)}
      <div class="v812-passport-compact__right">
        ${passportStats(data)}
        <a class="v812-passport-open" href="passport.html?photographer=${encodeURIComponent(profile.username||'')}"><div><b>Open full Spotter Passport</b><span>Airport stamps · countries · aircraft collection · operator log</span></div><strong>↗</strong></a>
      </div>
    </div>`;
  }

  async function findProfile(db, usernameOrId) {
    if (!usernameOrId) return null;
    if (/^[0-9a-f-]{36}$/i.test(usernameOrId)) {
      const {data}=await db.from('profiles').select('id,username,display_name,avatar_url,is_crew,location').eq('id',usernameOrId).maybeSingle();
      return data || null;
    }
    const key=String(usernameOrId).replace(/^@/,'').toLowerCase();
    let {data}=await db.from('profiles').select('id,username,display_name,avatar_url,is_crew,location').eq('username',key).maybeSingle();
    if (data) return data;
    const profiles=await getProfiles(db);
    return profiles.find(p=>slug(p.display_name)===key) || null;
  }

  async function renderPassportFor(holder, profile, compact=false) {
    const db=await dbReady();
    if (!db || !profile) return;
    const [allPhotos,refs]=await Promise.all([getAllApprovedPhotos(db),getAirports(db)]);
    const own=allPhotos.filter(p=>p.owner_id===profile.id);
    const data=passportData(own,allPhotos,refs);
    holder.innerHTML=compact ? compactPassportMarkup(profile,data) : fullPassportMarkup(profile,data);
    bindCollectionFilters(holder);
    return data;
  }

  async function mountPassportPage(db) {
    const holder=document.querySelector('[data-v812-passport-page]');
    if(!holder) return;
    const params=new URLSearchParams(location.search);
    let profile=null;
    const requested=params.get('photographer');
    if(requested) profile=await findProfile(db,requested);
    if(!profile){
      const user=await getSessionUser(db);
      if(user) profile=await findProfile(db,user.id);
    }
    const title=document.querySelector('[data-passport-owner]');
    if(!profile){
      holder.innerHTML='<div class="v812-empty"><b>Open your Spotter Passport.</b><span>Sign in, or open a photographer profile and choose Passport.</span><div class="v812-share-row"><a href="account.html?mode=login">Sign in ↗</a><a href="photographers.html">Browse photographers ↗</a></div></div>';
      return;
    }
    if(title) title.textContent=profile.display_name;
    const data=await renderPassportFor(holder,profile,false);
    const share=document.querySelector('[data-passport-share]');
    if(share){
      share.hidden=false;
      share.addEventListener('click',async()=>{
        const url=new URL('passport.html',location.href); url.searchParams.set('photographer',profile.username||'');
        const payload={title:`${profile.display_name} — Scottish.aero Spotter Passport`,text:`${data?.unlocked||0}/${data?.total||0} aircraft unlocked on Scottish.aero.`,url:url.href};
        try{if(navigator.share) await navigator.share(payload); else {await navigator.clipboard.writeText(url.href);share.textContent='Link copied ✓';}}catch(_){}
      });
    }
  }

  async function mountAccountPassport(db) {
    const tabs=document.querySelector('.account-tabs');
    const dashboard=document.querySelector('[data-account-dashboard]');
    if(!tabs || !dashboard || document.querySelector('[data-v812-account-passport]')) return;
    const button=document.createElement('button');
    button.type='button';button.className='v812-tab-button';button.dataset.v812AccountPassport='';button.textContent='Passport / Hangar';
    tabs.append(button);
    const panel=document.createElement('div');panel.className='account-panel v812-injected-panel';panel.hidden=true;panel.dataset.v812AccountPassportPanel='';
    panel.innerHTML='<div class="studio-section-head"><span class="eyebrow">V8.1 / Spotter Passport</span><h2>Your archive becomes a collection.</h2><p>Approved frames unlock airports, countries and aircraft automatically.</p></div><div data-v812-account-passport-content><div class="v8-panel-loading">Opening passport…</div></div>';
    const existingPanels=[...dashboard.querySelectorAll('[data-account-panel]')];
    const last=existingPanels.at(-1); if(last) last.insertAdjacentElement('afterend',panel); else dashboard.append(panel);
    button.addEventListener('click',async()=>{
      tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b===button));
      dashboard.querySelectorAll('[data-account-panel]').forEach(p=>p.hidden=true); panel.hidden=false;
      if(panel.dataset.loaded==='1') return;
      const user=await getSessionUser(db); if(!user){panel.querySelector('[data-v812-account-passport-content]').innerHTML='<div class="v812-empty"><b>Sign in to open your passport.</b></div>';return;}
      const profile=await findProfile(db,user.id); if(!profile)return;
      await renderPassportFor(panel.querySelector('[data-v812-account-passport-content]'),profile,true); panel.dataset.loaded='1';
    });
    tabs.querySelectorAll('[data-account-tab]').forEach(b=>b.addEventListener('click',()=>{button.classList.remove('is-active');panel.hidden=true;}));
  }

  async function mountProfilePassport(db) {
    const tabs=document.querySelector('.profile-tabs');
    const shell=document.querySelector('.profile-feed-section .site-shell');
    if(!tabs || !shell || document.querySelector('[data-v812-profile-passport]')) return;
    const button=document.createElement('button');button.type='button';button.className='profile-tab v812-tab-button';button.dataset.v812ProfilePassport='';button.textContent='Passport';tabs.append(button);
    const panel=document.createElement('div');panel.className='v812-injected-panel';panel.hidden=true;panel.dataset.v812ProfilePassportPanel='';panel.innerHTML='<div data-v812-profile-passport-content><div class="v8-panel-loading">Opening Spotter Passport…</div></div>';
    const lastPanel=[...shell.querySelectorAll('[data-profile-panel]')].at(-1); if(lastPanel) lastPanel.insertAdjacentElement('afterend',panel); else shell.append(panel);
    button.addEventListener('click',async()=>{
      tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b===button));
      shell.querySelectorAll('[data-profile-panel]').forEach(p=>p.hidden=true); panel.hidden=false;
      if(panel.dataset.loaded==='1')return;
      const requested=new URLSearchParams(location.search).get('photographer')||'arran';
      const profile=await findProfile(db,requested); if(!profile)return;
      await renderPassportFor(panel.querySelector('[data-v812-profile-passport-content]'),profile,true); panel.dataset.loaded='1';
    });
    tabs.querySelectorAll('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>{button.classList.remove('is-active');panel.hidden=true;}));
  }

  function airportCard(item) {
    const ref=item.ref;
    const image=item.latest?.image_url||'';
    return `<a class="v812-airport-card" data-world-airport-card="${esc(ref.code)}" href="airport.html?airport=${encodeURIComponent(ref.code)}">
      <div class="v812-airport-card__image" style="${image?`background-image:url('${esc(image)}')`:''}"></div><div class="v812-airport-card__veil"></div>
      <div class="v812-airport-card__content"><div class="v812-airport-card__top"><span>${esc(ref.code)} · ${esc(ref.kind.replace('_',' '))}</span><span>${esc(ref.country)}</span></div><div><h3>${esc(ref.name)}</h3><p>${esc(ref.city || ref.region)}</p><div class="v812-airport-card__stats"><span>${fmt(item.count)} FRAMES</span><span>${fmt(item.photographers.size)} SPOTTERS</span><span>${fmt(item.aircraft.size)} TYPES</span></div></div></div>
    </a>`;
  }

  function initLeafletMap(node, grouped, refs) {
    if(!node) return null;
    if(!window.L){node.innerHTML='<div class="v812-empty" style="margin:24px"><b>Interactive map unavailable.</b><span>The live location board below still contains the full mapped archive.</span></div>';return null;}
    const map=L.map(node,{worldCopyJump:true,minZoom:2,zoomControl:true,attributionControl:true}).setView([45,2],3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const markers=new Map();
    const bounds=[];
    grouped.forEach(item=>{
      const r=item.ref;
      const icon=L.divIcon({className:'sa-world-marker-wrap',html:`<span class="sa-world-marker"><b>${esc(r.code)}</b></span>`,iconSize:[34,34],iconAnchor:[17,30]});
      const marker=L.marker([r.latitude,r.longitude],{icon}).addTo(map);
      marker.bindPopup(`<div class="v812-map-popup"><b>${esc(r.name)}</b><span>${fmt(item.count)} frames · ${fmt(item.photographers.size)} photographers</span><a href="airport.html?airport=${encodeURIComponent(r.code)}">Open Airport Command ↗</a></div>`);
      markers.set(r.code,marker);bounds.push([r.latitude,r.longitude]);
    });
    if(bounds.length>1) map.fitBounds(bounds,{padding:[45,45],maxZoom:5});
    return {map,markers};
  }

  async function mountWorld(db) {
    const root=document.querySelector('[data-v82-world]'); if(!root)return;
    const [photos,refs]=await Promise.all([getAllApprovedPhotos(db),getAirports(db)]);
    const grouped=groupAirports(photos,refs);
    const countries=new Set(grouped.mapped.map(x=>x.ref.country));
    const photographers=new Set(photos.map(p=>p.owner_id).filter(Boolean));
    const stats=document.querySelector('[data-world-stats]');
    if(stats) stats.innerHTML=`<article><b>${fmt(grouped.mapped.reduce((n,x)=>n+x.count,0))}</b><span>Mapped frames</span></article><article><b>${fmt(grouped.mapped.length)}</b><span>Archive locations</span></article><article><b>${fmt(countries.size)}</b><span>Countries</span></article><article><b>${fmt(photographers.size)}</b><span>Photographers</span></article>`;
    const status=document.querySelector('[data-world-status]'); if(status) status.textContent=`${fmt(grouped.mapped.length)} LIVE LOCATIONS · ${fmt(grouped.unmapped.reduce((n,x)=>n+x.count,0))} UNMAPPED FRAMES`;
    const board=document.querySelector('[data-world-list]'); if(board) board.innerHTML=grouped.mapped.map(airportCard).join('');
    const countrySelect=document.querySelector('[data-world-country]');
    if(countrySelect){[...countries].sort().forEach(country=>countrySelect.insertAdjacentHTML('beforeend',`<option value="${esc(country)}">${esc(country)}</option>`));}
    const mapBundle=initLeafletMap(document.querySelector('[data-world-map]'),grouped.mapped,refs);
    const search=document.querySelector('[data-world-search]');
    const filter=()=>{
      const q=norm(search?.value||''); const country=countrySelect?.value||'';
      board?.querySelectorAll('[data-world-airport-card]').forEach(card=>{
        const item=grouped.mapped.find(x=>x.ref.code===card.dataset.worldAirportCard); if(!item)return;
        const hay=norm(`${item.ref.code} ${item.ref.name} ${item.ref.city} ${item.ref.region} ${item.ref.country}`);
        card.hidden=Boolean((q&&!hay.includes(q)) || (country&&item.ref.country!==country));
      });
    };
    search?.addEventListener('input',filter); countrySelect?.addEventListener('change',filter);
    board?.querySelectorAll('[data-world-airport-card]').forEach(card=>card.addEventListener('mouseenter',()=>{
      const marker=mapBundle?.markers.get(card.dataset.worldAirportCard); if(marker){marker.openPopup();}
    }));
  }

  function tally(list,keyFn,labelFn=x=>x) {
    const map=new Map(); list.forEach(item=>{const key=keyFn(item);if(!key)return;const row=map.get(key)||{key,label:labelFn(item),count:0};row.count++;map.set(key,row);});
    return [...map.values()].sort((a,b)=>b.count-a.count||String(a.label).localeCompare(String(b.label)));
  }

  function rankList(rows,linker) {
    if(!rows.length)return '<div class="v812-empty"><b>No archive data yet.</b></div>';
    return `<div class="v812-rank-list">${rows.slice(0,10).map((row,index)=>{
      const inner=`<em>${String(index+1).padStart(2,'0')}</em><b>${esc(row.label)}</b><span>${fmt(row.count)}</span>`;
      return linker?`<a href="${esc(linker(row))}">${inner}</a>`:`<article>${inner}</article>`;
    }).join('')}</div>`;
  }

  async function mountAirportCommand(db) {
    const root=document.querySelector('[data-v82-airport-command]'); if(!root)return;
    const [photos,refs,profiles]=await Promise.all([getAllApprovedPhotos(db),getAirports(db),getProfiles(db)]);
    const requested=norm(new URLSearchParams(location.search).get('airport')||'edi');
    const ref=refs.find(r=>[r.code,r.slug,r.iata,r.icao].filter(Boolean).some(v=>norm(v)===requested));
    if(!ref){root.innerHTML='<section class="section"><div class="site-shell"><div class="v812-empty"><b>Airport not found.</b><span>Return to the World Map and choose a mapped archive location.</span><div class="v812-share-row"><a href="airports.html">Open World Map ↗</a></div></div></div></section>';return;}
    const match=airportMatcher(refs);
    const subset=photos.filter(p=>match(p.airport)?.code===ref.code);
    const profileMap=new Map(profiles.map(p=>[p.id,p]));
    const latest=subset[0]||null;
    const media=document.querySelector('[data-airport-hero-media]');if(media&&latest?.image_url)media.style.backgroundImage=`url('${latest.image_url.replace(/'/g,"\\'")}')`;
    const code=document.querySelector('[data-airport-code]');if(code)code.textContent=`${ref.code}${ref.iata&&ref.iata!==ref.code?` / ${ref.iata}`:''}`;
    const name=document.querySelector('[data-airport-name]');if(name)name.textContent=ref.name;
    const copy=document.querySelector('[data-airport-copy]');if(copy)copy.textContent=`${ref.city || ref.region} · ${ref.country}. A live command page built from approved Scottish.aero archive photography.`;
    const meta=document.querySelector('[data-airport-meta]');if(meta)meta.innerHTML=`<span>${esc(ref.kind.replace('_',' ').toUpperCase())}</span><span>${esc(ref.region||ref.country)}</span><span>${ref.latitude.toFixed(4)}° · ${ref.longitude.toFixed(4)}°</span>`;
    const aircraft=groupAircraft(subset);
    const airlines=tally(subset.filter(p=>validValue(p.airline)),p=>norm(p.airline),p=>p.airline);
    const photographerRows=tally(subset.filter(p=>p.owner_id),p=>p.owner_id,p=>profileMap.get(p.owner_id)?.display_name||p.photographer_name||'Photographer');
    const stats=document.querySelector('[data-airport-stats]');if(stats)stats.innerHTML=`<article><b>${fmt(subset.length)}</b><span>Approved frames</span></article><article><b>${fmt(new Set(subset.map(p=>p.owner_id).filter(Boolean)).size)}</b><span>Photographers</span></article><article><b>${fmt(aircraft.length)}</b><span>Aircraft types</span></article><article><b>${fmt(airlines.length)}</b><span>Operators</span></article>`;
    const gallery=document.querySelector('[data-airport-photos]');if(gallery)gallery.innerHTML=subset.length?subset.slice(0,12).map(photo=>`<a class="v812-photo" href="gallery.html?photo=${encodeURIComponent(photo.id)}"><img src="${esc(photo.image_url)}" alt="${esc(photo.aircraft_type||'Aviation photograph')}" loading="lazy" decoding="async"><div class="v812-photo__meta"><b>${esc(photo.aircraft_type||'Aircraft')}</b><span>${esc(photo.airline||photo.registration||'Archive frame')} · ${esc(photo.photographer_name||'Scottish.aero')}</span></div></a>`).join(''):'<div class="v812-empty"><b>No approved frames here yet.</b></div>';
    const aircraftHolder=document.querySelector('[data-airport-aircraft]');if(aircraftHolder)aircraftHolder.innerHTML=rankList(aircraft.map(x=>({key:x.key,label:x.name,count:x.count})));
    const airlineHolder=document.querySelector('[data-airport-airlines]');if(airlineHolder)airlineHolder.innerHTML=rankList(airlines);
    const spotterHolder=document.querySelector('[data-airport-spotters]');if(spotterHolder)spotterHolder.innerHTML=rankList(photographerRows,row=>{const p=profileMap.get(row.key);return p?.username?`profile.html?photographer=${encodeURIComponent(p.username)}`:'photographers.html';});
    const commonRaw=[...tally(subset.filter(p=>validValue(p.airport)),p=>norm(p.airport),p=>p.airport)][0]?.label;
    const galleryLink=document.querySelector('[data-airport-gallery-link]');if(galleryLink)galleryLink.href=commonRaw?`gallery.html?airport=${encodeURIComponent(commonRaw)}`:'gallery.html';
    const airportMapNode=document.querySelector('[data-airport-map]');
    if(window.L && airportMapNode){const mini=L.map(airportMapNode,{zoomControl:false,attributionControl:true,scrollWheelZoom:false}).setView([ref.latitude,ref.longitude],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(mini);const icon=L.divIcon({className:'sa-world-marker-wrap',html:`<span class="sa-world-marker"><b>${esc(ref.code)}</b></span>`,iconSize:[34,34],iconAnchor:[17,30]});L.marker([ref.latitude,ref.longitude],{icon}).addTo(mini);}
    else if(airportMapNode){airportMapNode.innerHTML='<div class="v812-empty" style="margin:18px"><b>Map tiles unavailable.</b><span>Location data is still live.</span></div>';}
  }

  async function mountHome(db) {
    const anchor=document.querySelector('.v8-home'); if(!anchor || document.querySelector('[data-v812-home]'))return;
    const section=document.createElement('section');section.className='section v812-home';section.dataset.v812Home='';
    section.innerHTML=`<div class="site-shell"><div class="v812-home__head"><div><span class="eyebrow">V8.1 + V8.2 / Explore update</span><h2>COLLECT IT.<br><span>MAP IT.</span></h2></div><div><span class="v812-version-chip"><i></i> PASSPORT + WORLD LIVE</span><p>Your approved archive now builds a Spotter Passport and Aircraft Collection Book. Every mapped location also feeds the live Scottish.aero World Map and its own Airport Command page.</p></div></div><div class="v812-home__grid"><article class="v812-feature v812-feature--passport"><div class="v812-mini-passport"><span>SPOTTER PASSPORT</span><b data-v812-home-unlocks>— / —</b><i></i></div><div class="v812-feature__top"><span>V8.1 / COLLECTION</span><h3>YOUR HANGAR.<br>YOUR HISTORY.</h3><p>Approved photography unlocks aircraft types, airports, countries and operators automatically.</p></div><div class="v812-feature__bottom"><div class="v812-feature__metric"><b data-v812-home-passport>LIVE</b><span>Spotter Passport</span></div><a class="v812-feature__link" href="passport.html">Open Passport ↗</a></div></article><article class="v812-feature"><div class="v812-mini-map"><i></i><i></i><i></i><i></i><i></i></div><div class="v812-feature__top"><span>V8.2 / WORLD</span><h3>THE ARCHIVE<br>HAS A MAP.</h3><p>Browse every mapped Scottish.aero location, then open live airport pages built from the photography itself.</p></div><div class="v812-feature__bottom"><div class="v812-feature__metric"><b data-v812-home-locations>—</b><span>Mapped locations</span></div><a class="v812-feature__link" href="airports.html">Explore World ↗</a></div></article></div></div>`;
    anchor.insertAdjacentElement('afterend',section);
    const [photos,refs]=await Promise.all([getAllApprovedPhotos(db),getAirports(db)]);
    const grouped=groupAirports(photos,refs);
    const locations=section.querySelector('[data-v812-home-locations]');if(locations)locations.textContent=fmt(grouped.mapped.length);
    const user=await getSessionUser(db);
    if(user){const own=photos.filter(p=>p.owner_id===user.id);const data=passportData(own,photos,refs);const u=section.querySelector('[data-v812-home-unlocks]');if(u)u.textContent=`${data.unlocked} / ${data.total}`;const p=section.querySelector('[data-v812-home-passport]');if(p)p.textContent=`${data.completion}%`;}
    else {const global=groupAircraft(photos);const u=section.querySelector('[data-v812-home-unlocks]');if(u)u.textContent=`${global.length} TYPES`;}
  }

  function updateVersionRibbon(){
    const ribbon=document.querySelector('[data-development-ribbon]');if(!ribbon)return;
    const b=ribbon.querySelector('b');if(b)b.textContent='V8.2 · PASSPORT + WORLD';
  }

  async function boot() {
    updateVersionRibbon();
    const db=await dbReady(); if(!db)return;
    await Promise.allSettled([
      mountHome(db),
      mountAccountPassport(db),
      mountProfilePassport(db),
      mountPassportPage(db),
      mountWorld(db),
      mountAirportCommand(db)
    ]);
  }

  window.ScottishAeroExploreV812={aircraftMeta,groupAircraft,passportData};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(console.error),{once:true});
  else boot().catch(console.error);
})();
