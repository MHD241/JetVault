(() => {
  const fallback = window.SCOTTISH_AERO || { photographers: [], airports: [], photos: [], posts: [] };
  const cfg = window.SCOTTISH_AERO_CONFIG || {};
  const META_PROFILE = '__SA_PROFILE__';
  const META_POST = '__SA_POST__';
  const configured = Boolean(
    cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes('PASTE_') &&
    !cfg.supabaseAnonKey.includes('PASTE_')
  );

  let client = null;
  let clientPromise = null;
  let contentPromise = null;

  const slugify = value => String(value || '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const formatDate = value => {
    if (!value) return 'Unknown';
    try {
      const raw = String(value);
      const date = raw.includes('T') ? new Date(raw) : new Date(`${raw}T12:00:00`);
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      }).format(date);
    } catch (_) { return 'Unknown'; }
  };

  const dbPhotoToSite = row => ({
    id: row.id,
    src: /^assets\/images\/photos\/arran-.*\.jpg$/i.test(row.image_url || '') ? row.image_url.replace(/\.jpg$/i, '.webp') : row.image_url,
    alt: row.alt_text || `${row.airline || 'Aircraft'} ${row.aircraft_type || ''}`.trim(),
    reg: row.registration || 'Unknown',
    aircraft: row.aircraft_type || 'Unknown',
    airline: row.airline || 'Unknown',
    airport: row.airport || 'Unknown',
    date: formatDate(row.taken_at),
    photographer: slugify(row.photographer_name),
    photographerName: row.photographer_name || 'Unknown',
    ratio: row.ratio || 'standard',
    caption: row.caption || '',
    featured: Boolean(row.featured),
    ownerId: row.owner_id || null,
    createdAt: row.created_at || null
  });

  const rowToPost = row => ({
    id: row.id,
    title: row.aircraft_type && row.aircraft_type !== 'Unknown' ? row.aircraft_type : 'Crew update',
    body: row.caption || '',
    image: row.image_url || '',
    imageAlt: row.alt_text || row.aircraft_type || 'Scottish.aero crew post',
    photographer: slugify(row.photographer_name),
    photographerName: row.photographer_name || 'Unknown',
    createdAt: row.created_at || null,
    date: formatDate(row.created_at),
    ownerId: row.owner_id || null
  });

  const rowToProfileMeta = row => ({
    photographer: slugify(row.photographer_name),
    photographerName: row.photographer_name || 'Unknown',
    bio: row.caption || '',
    avatar: row.image_url || '',
    updatedAt: row.updated_at || row.created_at || null,
    rowId: row.id,
    ownerId: row.owner_id || null
  });

  function buildClient() {
    if (client || !configured || !window.supabase?.createClient) return client;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    if (window.ScottishAeroBackend) window.ScottishAeroBackend.client = client;
    return client;
  }

  function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-scottish-aero-supabase]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.dataset.scottishAeroSupabase = 'true';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function ensureClient() {
    if (client) return client;
    if (!configured) return null;
    if (!clientPromise) {
      clientPromise = (async () => {
        await loadSupabaseLibrary();
        return buildClient();
      })().catch(error => {
        console.warn('Scottish.aero: backend library unavailable.', error);
        clientPromise = null;
        return null;
      });
    }
    return clientPromise;
  }

  async function getRows({ fresh = false } = {}) {
    if (!fresh && contentPromise) return contentPromise;
    const task = (async () => {
      const db = await ensureClient();
      if (!db) return null;
      const { data, error } = await db.from('photos').select('*')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    })().catch(error => {
      console.warn('Scottish.aero: using bundled content fallback.', error.message);
      return null;
    });
    if (!fresh) contentPromise = task;
    return task;
  }

  function mergePhotographers(profileRows = []) {
    const latestByPerson = new Map();
    for (const row of profileRows) {
      const slug = slugify(row.photographer_name);
      if (!latestByPerson.has(slug)) latestByPerson.set(slug, rowToProfileMeta(row));
    }
    return (fallback.photographers || []).map(person => {
      const meta = latestByPerson.get(person.id);
      return meta ? {
        ...person,
        bio: meta.bio || person.bio,
        avatar: meta.avatar || person.avatar || '',
        profileRowId: meta.rowId || null
      } : { ...person, avatar: person.avatar || '' };
    });
  }

  async function getData({ fresh = false } = {}) {
    const rows = await getRows({ fresh });
    if (!rows) return {
      photographers: fallback.photographers || [],
      airports: fallback.airports || [],
      photos: fallback.photos || [],
      posts: fallback.posts || []
    };

    const profileRows = rows.filter(row => row.registration === META_PROFILE);
    const postRows = rows.filter(row => row.registration === META_POST);
    const photoRows = rows.filter(row => row.registration !== META_PROFILE && row.registration !== META_POST);
    return {
      photographers: mergePhotographers(profileRows),
      airports: fallback.airports || [],
      photos: photoRows.map(dbPhotoToSite),
      posts: postRows.map(rowToPost)
    };
  }

  async function getPhotos(options) {
    return (await getData(options)).photos;
  }

  async function getPosts(options) {
    return (await getData(options)).posts;
  }

  async function getPhotographers(options) {
    return (await getData(options)).photographers;
  }

  function invalidateContent() { contentPromise = null; }

  function runIdle(task) {
    if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 1800 });
    else setTimeout(task, 500);
  }

  function trackVisit(path = location.pathname) {
    if (!configured) return;
    runIdle(async () => {
      const db = await ensureClient();
      if (!db) return;
      try { await db.from('site_visits').insert({ path }); } catch (_) {}
    });
  }

  function trackPhotoView(photoId) {
    if (!configured || !photoId) return;
    runIdle(async () => {
      const db = await ensureClient();
      if (!db) return;
      try { await db.from('photo_views').insert({ photo_id: photoId }); } catch (_) {}
    });
  }

  const api = window.ScottishAeroBackend = {
    configured,
    client: buildClient(),
    ensureClient,
    getPhotos,
    getPosts,
    getPhotographers,
    getData,
    getRows,
    invalidateContent,
    trackVisit,
    trackPhotoView,
    slugify,
    dbPhotoToSite,
    rowToPost,
    rowToProfileMeta,
    formatDate,
    META_PROFILE,
    META_POST
  };
})();
