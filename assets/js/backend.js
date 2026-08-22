(() => {
  const fallback = window.SCOTTISH_AERO || { photographers: [], airports: [], photos: [] };
  const cfg = window.SCOTTISH_AERO_CONFIG || {};
  const configured = Boolean(
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes('PASTE_') &&
    !cfg.supabaseAnonKey.includes('PASTE_') &&
    window.supabase?.createClient
  );

  const client = configured
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const slugify = value => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const formatDate = value => {
    if (!value) return 'Unknown';
    try {
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .format(new Date(`${value}T12:00:00`));
    } catch (_) {
      return 'Unknown';
    }
  };

  const dbPhotoToSite = row => ({
    id: row.id,
    src: row.image_url,
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

  async function getPhotos() {
    if (!client) return fallback.photos;
    try {
      const { data, error } = await client
        .from('photos')
        .select('*')
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
    return {
      photographers: fallback.photographers,
      airports: fallback.airports,
      photos: await getPhotos()
    };
  }

  async function trackVisit(path = location.pathname) {
    if (!client) return;
    try {
      await client.from('site_visits').insert({ path });
    } catch (_) {}
  }

  async function trackPhotoView(photoId) {
    if (!client || !photoId) return;
    try {
      await client.from('photo_views').insert({ photo_id: photoId });
    } catch (_) {}
  }

  window.ScottishAeroBackend = {
    configured,
    client,
    getPhotos,
    getData,
    trackVisit,
    trackPhotoView,
    slugify,
    dbPhotoToSite,
    formatDate
  };
})();
