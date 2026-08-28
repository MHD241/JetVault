(() => {
  const fallback = window.SCOTTISH_AERO || { photographers: [], airports: [], photos: [], posts: [] };
  const cfg = window.SCOTTISH_AERO_CONFIG || {};
  const META_PROFILE = '__SA_PROFILE__';
  const META_POST = '__SA_POST__';
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes('PASTE_') && !cfg.supabaseAnonKey.includes('PASTE_'));
  let client = null;
  let clientPromise = null;
  let contentPromise = null;
  let profilesPromise = null;

  const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const formatDate = value => {
    if (!value) return 'Unknown';
    try {
      const raw = String(value);
      const date = raw.includes('T') ? new Date(raw) : new Date(`${raw}T12:00:00`);
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    } catch (_) { return 'Unknown'; }
  };

  function buildClient() {
    if (client || !configured || !window.supabase?.createClient) return client;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    if (window.ScottishAeroBackend) window.ScottishAeroBackend.client = client;
    return client;
  }

  function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-scottish-aero-supabase]');
      if (existing) {
        if (window.supabase?.createClient) return resolve();
        existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; script.async = true; script.dataset.scottishAeroSupabase = 'true';
      script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
  }

  async function ensureClient() {
    if (client) return client;
    if (!configured) return null;
    if (!clientPromise) clientPromise = (async () => { await loadSupabaseLibrary(); return buildClient(); })().catch(error => { console.warn('Scottish.aero backend unavailable.', error); clientPromise = null; return null; });
    return clientPromise;
  }

  const dbPhotoToSite = row => ({
    id: row.id,
    src: /^assets\/images\/photos\/arran-.*\.jpg$/i.test(row.image_url || '') ? row.image_url.replace(/\.jpg$/i, '.webp') : row.image_url,
    alt: row.alt_text || `${row.airline || 'Aircraft'} ${row.aircraft_type || ''}`.trim(),
    reg: row.registration || 'Unknown', aircraft: row.aircraft_type || 'Unknown', airline: row.airline || 'Unknown', airport: row.airport || 'Unknown',
    date: formatDate(row.taken_at), takenAt: row.taken_at || null, photographer: slugify(row.photographer_name), photographerName: row.photographer_name || 'Unknown',
    ratio: row.ratio || 'standard', caption: row.caption || '', featured: Boolean(row.featured), ownerId: row.owner_id || null,
    createdAt: row.created_at || null, status: row.status || 'approved', moderationNote: row.moderation_note || ''
  });
  const rowToPost = row => ({ id: row.id, title: row.aircraft_type && row.aircraft_type !== 'Unknown' ? row.aircraft_type : 'Crew update', body: row.caption || '', image: row.image_url || '', imageAlt: row.alt_text || row.aircraft_type || 'Scottish.aero post', photographer: slugify(row.photographer_name), photographerName: row.photographer_name || 'Unknown', createdAt: row.created_at || null, date: formatDate(row.created_at), ownerId: row.owner_id || null, status: row.status || 'approved' });
  const rowToProfileMeta = row => ({ photographer: slugify(row.photographer_name), photographerName: row.photographer_name || 'Unknown', bio: row.caption || '', avatar: row.image_url || '', updatedAt: row.updated_at || row.created_at || null, rowId: row.id, ownerId: row.owner_id || null });
  const profileToSite = row => ({
    id: row.username || slugify(row.display_name), username: row.username || slugify(row.display_name), name: row.display_name || 'Aviation photographer', bio: row.bio || '', avatar: row.avatar_url || '',
    location: row.location || '', favouriteAirport: row.favourite_airport || '', favouriteAircraft: row.favourite_aircraft || '', accountId: row.id, isManager: Boolean(row.is_manager), isCrew: Boolean(row.is_crew), createdAt: row.created_at || null, updatedAt: row.updated_at || row.created_at || null
  });

  async function getRows({ fresh = false } = {}) {
    if (!fresh && contentPromise) return contentPromise;
    const task = (async () => {
      const db = await ensureClient(); if (!db) return null;
      const { data, error } = await db.from('photos').select('*').order('featured', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      if (error) throw error; return data || [];
    })().catch(error => { console.warn('Scottish.aero: using bundled content fallback.', error.message); return null; });
    if (!fresh) contentPromise = task; return task;
  }

  async function getProfiles({ fresh = false } = {}) {
    if (!fresh && profilesPromise) return profilesPromise;
    const task = (async () => {
      const db = await ensureClient(); if (!db) return [];
      const { data, error } = await db.from('profiles').select('id,display_name,username,bio,avatar_url,location,favourite_airport,favourite_aircraft,is_manager,is_crew,created_at,updated_at').order('is_crew', { ascending: false }).order('created_at', { ascending: true });
      if (error) throw error; return data || [];
    })().catch(error => { console.warn('Scottish.aero profiles unavailable.', error.message); return []; });
    if (!fresh) profilesPromise = task; return task;
  }

  function mergePhotographers(profileRows = [], metaRows = []) {
    const metaByOwner = new Map();
    for (const row of metaRows) if (row.owner_id && !metaByOwner.has(row.owner_id)) metaByOwner.set(row.owner_id, rowToProfileMeta(row));
    const fallbackByName = new Map((fallback.photographers || []).map(p => [p.name, p]));
    const mapped = profileRows.map(row => {
      const base = profileToSite(row); const local = fallbackByName.get(row.display_name) || {}; const meta = metaByOwner.get(row.id);
      const profileStamp = Date.parse(base.updatedAt || 0) || 0, metaStamp = Date.parse(meta?.updatedAt || 0) || 0;
      const preferMeta = Boolean(meta && metaStamp > profileStamp);
      return { ...local, ...base, id: base.username, bio: preferMeta ? (meta.bio || base.bio || local.bio || '') : (base.bio || meta?.bio || local.bio || ''), avatar: preferMeta ? (meta.avatar || base.avatar || local.avatar || '') : (base.avatar || meta?.avatar || local.avatar || '') };
    });
    if (!mapped.length) return (fallback.photographers || []).map(p => ({ ...p, username: p.id, isCrew: true, isManager: false, accountId: null }));
    return mapped.sort((a,b) => Number(b.isCrew) - Number(a.isCrew) || a.name.localeCompare(b.name));
  }

  async function getData({ fresh = false } = {}) {
    const [rows, profileRows] = await Promise.all([getRows({ fresh }), getProfiles({ fresh })]);
    if (!rows) return { photographers: mergePhotographers(profileRows, []), airports: fallback.airports || [], photos: fallback.photos || [], posts: fallback.posts || [] };
    const metaRows = rows.filter(row => row.registration === META_PROFILE);
    const postRows = rows.filter(row => row.registration === META_POST && (row.status || 'approved') === 'approved');
    const publicPhotoRows = rows.filter(row => row.registration !== META_PROFILE && row.registration !== META_POST && (row.status || 'approved') === 'approved');
    const photographers = mergePhotographers(profileRows, metaRows);
    const byAccount = new Map(photographers.filter(p => p.accountId).map(p => [p.accountId, p]));
    const byName = new Map(photographers.map(p => [p.name, p]));
    const decorate = photo => {
      const person = byAccount.get(photo.ownerId) || byName.get(photo.photographerName);
      return { ...photo, photographer: person?.username || person?.id || photo.photographer, isCrew: Boolean(person?.isCrew), photographerAvatar: person?.avatar || '' };
    };
    return { photographers, airports: fallback.airports || [], photos: publicPhotoRows.map(dbPhotoToSite).map(decorate), posts: postRows.map(rowToPost).map(decorate) };
  }

  async function getPhotos(options) { return (await getData(options)).photos; }
  async function getPosts(options) { return (await getData(options)).posts; }
  async function getPhotographers(options) { return (await getData(options)).photographers; }
  async function getCurrentProfile() {
    const db = await ensureClient(); if (!db) return null;
    const { data: session } = await db.auth.getSession(); const user = session?.session?.user; if (!user) return null;
    const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle(); if (error) throw error; return data || null;
  }
  async function getProfileByKey(key, options) {
    const people = await getPhotographers(options); const wanted = String(key || '').toLowerCase();
    return people.find(p => String(p.username || p.id).toLowerCase() === wanted || slugify(p.name) === wanted) || null;
  }
  function invalidateContent() { contentPromise = null; profilesPromise = null; }
  function runIdle(task) { if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 1800 }); else setTimeout(task, 500); }
  function getActiveVisitorId() {
    const key = 'sa_active_visitor_v10';
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
      return id;
    } catch (_) {
      try {
        let id = sessionStorage.getItem(key);
        if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
        return id;
      } catch (_) { return crypto.randomUUID(); }
    }
  }
  function trackVisit(path = location.pathname) {
    if (!configured) return;
    runIdle(async () => {
      const db = await ensureClient(); if (!db) return;
      try { await db.rpc('touch_active_user', { p_visitor_id: getActiveVisitorId(), p_path: String(path || location.pathname).slice(0,300) }); } catch (_) {}
    });
  }
  function trackPhotoView(photoId) { if (!configured || !photoId) return; runIdle(async () => { const db = await ensureClient(); if (!db) return; try { await db.from('photo_views').insert({ photo_id: photoId }); } catch (_) {} }); }

  window.ScottishAeroBackend = { configured, client: buildClient(), ensureClient, getRows, getProfiles, getData, getPhotos, getPosts, getPhotographers, getCurrentProfile, getProfileByKey, invalidateContent, trackVisit, trackPhotoView, slugify, formatDate, dbPhotoToSite, rowToPost, rowToProfileMeta, profileToSite, META_PROFILE, META_POST };
})();
