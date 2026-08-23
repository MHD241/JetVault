(() => {
  const fallback = window.SCOTTISH_AERO || { photographers: [], airports: [], photos: [] };
  const cfg = window.SCOTTISH_AERO_CONFIG || {};
  const configured = Boolean(
    cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes('PASTE_') &&
    !cfg.supabaseAnonKey.includes('PASTE_')
  );

  let client = null;
  let clientPromise = null;

  const slugify = value => String(value || '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const formatDate = value => {
    if (!value) return 'Unknown';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      }).format(new Date(`${value}T12:00:00`));
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

  async function getPhotos() {
    const db = await ensureClient();
    if (!db) return fallback.photos;
    try {
      const { data, error } = await db.from('photos').select('*')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(dbPhotoToSite);
    } catch (error) {
      console.warn('Scottish.aero: using local photo fallback.', error.message);
      return fallback.photos;
    }
  }

  async function getData() {
    return { photographers: fallback.photographers, airports: fallback.airports, photos: await getPhotos() };
  }

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
    getData,
    trackVisit,
    trackPhotoView,
    slugify,
    dbPhotoToSite,
    formatDate
  };
})();
