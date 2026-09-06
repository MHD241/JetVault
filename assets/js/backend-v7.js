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
  const fullImageById = new Map();

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
    if (!clientPromise) clientPromise = (async () => { await loadSupabaseLibrary(); return buildClient(); })().catch(error => { console.warn('Jetvault backend unavailable.', error); clientPromise = null; return null; });
    return clientPromise;
  }

  const dbPhotoToSite = row => {
    const fullSrc = /^assets\/images\/photos\/arran-.*\.jpg$/i.test(row.image_url || '') ? row.image_url.replace(/\.jpg$/i, '.webp') : row.image_url;
    const thumbSrc = String(row.thumbnail_url || '').trim() || fullSrc;
    if (row.id && fullSrc) fullImageById.set(String(row.id), fullSrc);
    return {
      id: row.id,
      // JetVault V1 image pipeline: cards use thumbnails; fullSrc is preserved for the viewer.
      src: thumbSrc,
      thumbSrc,
      fullSrc,
      alt: row.alt_text || `${row.airline || 'Aircraft'} ${row.aircraft_type || ''}`.trim(),
      reg: row.registration || 'Unknown', aircraft: row.aircraft_type || 'Unknown', airline: row.airline || 'Unknown', airport: row.airport || 'Unknown',
      date: formatDate(row.taken_at), takenAt: row.taken_at || null, photographer: slugify(row.photographer_name), photographerName: row.photographer_name || 'Unknown',
      ratio: row.ratio || 'standard', caption: row.caption || '', featured: Boolean(row.featured), ownerId: row.owner_id || null,
      createdAt: row.created_at || null, status: row.status || 'approved', moderationNote: row.moderation_note || ''
    };
  };

  const rowToPost = row => ({ id: row.id, title: row.aircraft_type && row.aircraft_type !== 'Unknown' ? row.aircraft_type : 'Crew update', body: row.caption || '', image: row.image_url || '', imageAlt: row.alt_text || row.aircraft_type || 'Jetvault post', photographer: slugify(row.photographer_name), photographerName: row.photographer_name || 'Unknown', createdAt: row.created_at || null, date: formatDate(row.created_at), ownerId: row.owner_id || null, status: row.status || 'approved' });
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
    })().catch(error => { console.warn('Jetvault: using bundled content fallback.', error.message); return null; });
    if (!fresh) contentPromise = task; return task;
  }

  async function getProfiles({ fresh = false } = {}) {
    if (!fresh && profilesPromise) return profilesPromise;
    const task = (async () => {
      const db = await ensureClient(); if (!db) return [];
      const { data, error } = await db.from('profiles').select('id,display_name,username,bio,avatar_url,location,favourite_airport,favourite_aircraft,is_manager,is_crew,created_at,updated_at').order('is_crew', { ascending: false }).order('created_at', { ascending: true });
      if (error) throw error; return data || [];
    })().catch(error => { console.warn('Jetvault profiles unavailable.', error.message); return []; });
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

  // ---------------------------------------------------------------------------
  // JetVault Image Pipeline V1
  // One-file compatibility layer: real WebP conversion, thumbnails, old-archive
  // background migration, and full-resolution lightbox upgrades.
  // ---------------------------------------------------------------------------

  async function makeWebpVariant(source, { maxSide = 2400, quality = .84, square = false } = {}) {
    const bitmap = await createImageBitmap(source);
    let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
    if (square) {
      const side = Math.min(sw, sh);
      sx = Math.floor((sw - side) / 2); sy = Math.floor((sh - side) / 2); sw = sh = side;
    }
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('This browser could not create a real WebP image.');
    return { blob, width, height };
  }

  async function uploadPrepared(db, userId, path, blob) {
    const up = await db.storage.from('photos').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (up.error) throw up.error;
    return db.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }

  async function uploadPhotoPair(db, userId, file, prefix = 'photo') {
    if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Please keep photographs below 25 MB.');
    const id = crypto.randomUUID();
    // Never rename an original fallback to .webp. Both outputs must be genuine WebP blobs.
    const [full, thumb] = await Promise.all([
      makeWebpVariant(file, { maxSide: 2560, quality: .84 }),
      makeWebpVariant(file, { maxSide: 1100, quality: .72 })
    ]);
    const base = `${userId}/${prefix}-${id}`;
    const [imageUrl, thumbnailUrl] = await Promise.all([
      uploadPrepared(db, userId, `${base}-full.webp`, full.blob),
      uploadPrepared(db, userId, `${base}-thumb.webp`, thumb.blob)
    ]);
    const ratioValue = full.width / full.height;
    const ratio = ratioValue > 1.55 ? 'wide' : ratioValue < .9 ? 'tall' : 'standard';
    return { imageUrl, thumbnailUrl, ratio };
  }

  function showPipelineMessage(node, text, ok = false) {
    if (!node) return;
    node.textContent = text || '';
    node.classList.add('show');
    node.classList.toggle('form-success', ok);
    node.classList.toggle('form-error', !ok);
  }

  async function currentUserAndProfile(db) {
    const { data } = await db.auth.getSession();
    const user = data?.session?.user || null;
    if (!user) return { user: null, profile: null };
    const p = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return { user, profile: p.data || null };
  }

  function installUploadInterceptors() {
    const communityForm = document.querySelector('[data-community-upload-form]');
    if (communityForm && !communityForm.dataset.jvImagePipeline) {
      communityForm.dataset.jvImagePipeline = '1';
      communityForm.addEventListener('submit', async e => {
        e.preventDefault(); e.stopImmediatePropagation();
        if (communityForm.dataset.jvBusy === '1') return;
        communityForm.dataset.jvBusy = '1';
        const node = document.querySelector('[data-upload-message]');
        const button = communityForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Optimising & uploading…'; }
        try {
          const db = await ensureClient(); if (!db) throw new Error('Backend unavailable.');
          const { user, profile } = await currentUserAndProfile(db); if (!user) throw new Error('Please sign in again.');
          const file = communityForm.elements.photo?.files?.[0]; if (!file) throw new Error('Choose a photograph first.');
          const pair = await uploadPhotoPair(db, user.id, file, 'submission');
          const f = communityForm.elements;
          const payload = {
            image_url: pair.imageUrl,
            thumbnail_url: pair.thumbnailUrl,
            registration: f.registration.value.trim() || 'Unknown',
            aircraft_type: f.aircraft_type.value.trim() || 'Unknown',
            airline: f.airline.value.trim() || 'Unknown',
            airport: f.airport.value.trim() || 'Unknown',
            taken_at: f.taken_at.value || null,
            caption: f.caption.value.trim(),
            alt_text: f.alt_text.value.trim(),
            ratio: pair.ratio
          };
          const r = await db.from('photos').insert(payload).select().single();
          if (r.error) throw r.error;
          invalidateContent();
          showPipelineMessage(node, profile?.is_crew ? 'Published to the archive.' : 'Submitted for review.', true);
          setTimeout(() => location.reload(), 650);
        } catch (err) {
          showPipelineMessage(node, err.message || 'Upload failed.');
          communityForm.dataset.jvBusy = '0';
          if (button) { button.disabled = false; button.textContent = 'Submit for review'; }
        }
      }, true);
    }

    const crewForm = document.querySelector('[data-upload-form]');
    if (crewForm && !crewForm.dataset.jvImagePipeline) {
      crewForm.dataset.jvImagePipeline = '1';
      crewForm.addEventListener('submit', async e => {
        e.preventDefault(); e.stopImmediatePropagation();
        if (crewForm.dataset.jvBusy === '1') return;
        crewForm.dataset.jvBusy = '1';
        const errorNode = document.querySelector('[data-upload-error]');
        const successNode = document.querySelector('[data-upload-success]');
        const button = crewForm.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Optimising full + thumbnail…'; }
        try {
          const db = await ensureClient(); if (!db) throw new Error('Backend unavailable.');
          const { user, profile } = await currentUserAndProfile(db); if (!user || !profile?.is_crew) throw new Error('Crew session required.');
          const file = crewForm.querySelector('[data-upload-file]')?.files?.[0]; if (!file) throw new Error('Choose a photograph first.');
          const pair = await uploadPhotoPair(db, user.id, file, 'crew');
          const f = new FormData(crewForm);
          const payload = {
            image_url: pair.imageUrl,
            thumbnail_url: pair.thumbnailUrl,
            registration: String(f.get('registration') || 'Unknown').trim() || 'Unknown',
            aircraft_type: String(f.get('aircraft_type') || 'Unknown').trim() || 'Unknown',
            airline: String(f.get('airline') || 'Unknown').trim() || 'Unknown',
            airport: String(f.get('airport') || 'Unknown').trim().toUpperCase() || 'Unknown',
            taken_at: f.get('taken_at') || null,
            caption: String(f.get('caption') || '').trim(),
            alt_text: String(f.get('alt_text') || '').trim(),
            ratio: pair.ratio
          };
          const r = await db.from('photos').insert(payload).select().single();
          if (r.error) throw r.error;
          invalidateContent();
          showPipelineMessage(successNode, `Published as ${profile.display_name}'s photograph.`, true);
          setTimeout(() => location.reload(), 650);
        } catch (err) {
          showPipelineMessage(errorNode, err.message || 'Upload failed.');
          crewForm.dataset.jvBusy = '0';
          if (button) { button.disabled = false; button.textContent = 'Publish photograph'; }
        }
      }, true);
    }
  }

  function upgradeLightboxToFull() {
    const dialog = document.querySelector('[data-lightbox]');
    if (!dialog?.open) return;
    const id = new URLSearchParams(location.search).get('photo');
    if (!id) return;
    const full = fullImageById.get(String(id));
    const img = dialog.querySelector('.lightbox__media img');
    if (!full || !img) return;
    const absolute = new URL(full, location.href).href;
    if (img.src !== absolute) img.src = full;
  }

  function installLightboxUpgrade() {
    const root = document.querySelector('[data-lightbox-inner]');
    if (!root || root.dataset.jvFullUpgrade) return;
    root.dataset.jvFullUpgrade = '1';
    const observer = new MutationObserver(() => requestAnimationFrame(upgradeLightboxToFull));
    observer.observe(root, { childList: true, subtree: true });
    document.querySelector('[data-lightbox]')?.addEventListener('click', () => setTimeout(upgradeLightboxToFull, 0));
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function migrateExistingThumbnails() {
    if (!document.querySelector('[data-admin-app]')) return;
    const db = await ensureClient(); if (!db) return;
    const { user, profile } = await currentUserAndProfile(db);
    if (!user || !profile?.is_manager) return;

    const result = await db.from('photos')
      .select('id,image_url,thumbnail_url,registration,created_at')
      .neq('registration', META_PROFILE)
      .neq('registration', META_POST)
      .order('created_at', { ascending: true });
    if (result.error) return console.warn('Jetvault thumbnail migration query failed', result.error.message);

    // Filtering client-side is deliberately boring/reliable: empty string and NULL both count as missing.
    const rows = (result.data || []).filter(row => row.image_url && !String(row.thumbnail_url || '').trim());
    if (!rows.length) return;
    console.info(`Jetvault Image Pipeline: ${rows.length} archive thumbnails left to generate.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const response = await fetch(new URL(row.image_url, location.href).href, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
        const source = await response.blob();
        const thumb = await makeWebpVariant(source, { maxSide: 1100, quality: .72 });
        const path = `${user.id}/migrated-thumb-${row.id}.webp`;
        const thumbnailUrl = await uploadPrepared(db, user.id, path, thumb.blob);
        const updated = await db.from('photos').update({ thumbnail_url: thumbnailUrl }).eq('id', row.id);
        if (updated.error) throw updated.error;
        console.info(`Jetvault thumbnail ${i + 1}/${rows.length}`);
      } catch (err) {
        console.warn(`Jetvault thumbnail skipped for ${row.id}:`, err.message || err);
      }
      // Keep Safari responsive while the one-time archive migration runs.
      await sleep(180);
    }
    invalidateContent();
    console.info('Jetvault Image Pipeline: archive thumbnail migration finished.');
  }

  function bootImagePipeline() {
    installUploadInterceptors();
    installLightboxUpgrade();
    // Delay the one-time manager migration so normal Studio loading wins first.
    setTimeout(() => migrateExistingThumbnails().catch(() => {}), 2200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootImagePipeline, { once: true });
  else bootImagePipeline();

  window.ScottishAeroBackend = { configured, client: buildClient(), ensureClient, getRows, getProfiles, getData, getPhotos, getPosts, getPhotographers, getCurrentProfile, getProfileByKey, invalidateContent, trackVisit, trackPhotoView, slugify, formatDate, dbPhotoToSite, rowToPost, rowToProfileMeta, profileToSite, META_PROFILE, META_POST };
})();
