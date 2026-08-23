(() => {
  const backend = window.ScottishAeroBackend;
  const accountEmails = {
    mohammed: 'mohammed@scottish.aero',
    ellis: 'ellis@scottish.aero',
    arran: 'arran@scottish.aero'
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  const loginCard = $('[data-login-card]');
  const loginForm = $('[data-login-form]');
  const loginError = $('[data-login-error]');
  const adminApp = $('[data-admin-app]');
  const signOutButton = $('[data-sign-out]');
  const backendStatus = $('[data-backend-status]');
  const backendWarning = $('[data-backend-warning]');
  const profileName = $('[data-profile-name]');
  const adminAvatar = $('[data-admin-avatar]');
  const overviewName = $('[data-overview-profile-name]');
  const overviewBio = $('[data-overview-bio]');

  const uploadForm = $('[data-upload-form]');
  const uploadFile = $('[data-upload-file]');
  const uploadPreview = $('[data-upload-preview]');
  const uploadError = $('[data-upload-error]');
  const uploadSuccess = $('[data-upload-success]');

  const postForm = $('[data-post-form]');
  const postFile = $('[data-post-file]');
  const postPreview = $('[data-post-preview]');
  const postError = $('[data-post-error]');
  const postSuccess = $('[data-post-success]');
  const postList = $('[data-admin-post-list]');
  const postCount = $('[data-post-count]');

  const profileForm = $('[data-profile-form]');
  const avatarFile = $('[data-avatar-file]');
  const profileError = $('[data-profile-error]');
  const profileSuccess = $('[data-profile-success]');
  const bioCount = $('[data-bio-count]');
  const previewAvatar = $('[data-preview-avatar]');
  const previewName = $('[data-preview-name]');
  const previewBio = $('[data-preview-bio]');
  const previewCover = $('[data-preview-cover]');

  const photoList = $('[data-admin-photo-list]');
  const photoCount = $('[data-photo-count]');
  const editDialog = $('[data-edit-dialog]');
  const editForm = $('[data-edit-form]');
  const editError = $('[data-edit-error]');
  const postEditDialog = $('[data-post-edit-dialog]');
  const postEditForm = $('[data-post-edit-form]');
  const postEditError = $('[data-post-edit-error]');

  const passwordForm = $('[data-password-form]');
  const passwordMessage = $('[data-password-message]');

  let client = null;
  let sessionUser = null;
  let profile = null;
  let rows = [];
  let adminPhotos = [];
  let adminPosts = [];
  let profileRecord = null;
  let uploadRatio = 'standard';

  function clearMessage(node) { if (node) { node.textContent = ''; node.classList.remove('show'); } }
  function showMessage(node, message, success = false) {
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    node.classList.toggle('form-success', success);
    node.classList.toggle('form-error', !success);
  }

  function setBackendState() {
    const live = Boolean(backend?.configured);
    backendStatus?.classList.toggle('is-live', live);
    if (backendStatus) backendStatus.textContent = live ? 'Backend live' : 'Backend offline';
    if (backendWarning) backendWarning.hidden = live;
  }
  setBackendState();

  async function connect() {
    if (!backend?.configured) return null;
    client = await backend.ensureClient();
    return client;
  }

  function initials(name) {
    return String(name || 'SA').split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  }

  function avatarMarkup(src, name, fallbackInitials = '') {
    return src ? `<img src="${esc(src)}" alt="${esc(name)} profile photo">` : `<span>${esc(fallbackInitials || initials(name))}</span>`;
  }

  function canEdit(row) {
    if (!row || !profile || !sessionUser) return false;
    return Boolean(profile.is_manager || row.owner_id === sessionUser.id || row.photographer_name === profile.display_name);
  }

  async function getProfile(userId) {
    const result = await client.from('profiles').select('*').eq('id', userId).single();
    if (result.error) throw result.error;
    return result.data;
  }

  function splitRows() {
    const p = backend.META_PROFILE;
    const post = backend.META_POST;
    adminPhotos = rows.filter(row => row.registration !== p && row.registration !== post);
    adminPosts = rows.filter(row => row.registration === post);
    const mine = rows.filter(row => row.registration === p && row.photographer_name === profile?.display_name);
    profileRecord = mine[0] || null;
  }

  async function loadRows() {
    const result = await client.from('photos').select('*').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    rows = result.data || [];
    splitRows();
    renderArchive();
    renderPosts();
    renderProfileEditor();
  }

  async function loadStats() {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [visits, week, views] = await Promise.all([
      client.from('site_visits').select('id', { count: 'exact', head: true }),
      client.from('site_visits').select('id', { count: 'exact', head: true }).gte('visited_at', weekAgo),
      client.from('photo_views').select('id', { count: 'exact', head: true })
    ]);
    $('[data-stat-visits]').textContent = visits.count ?? '—';
    $('[data-stat-week]').textContent = week.count ?? '—';
    $('[data-stat-views]').textContent = views.count ?? '—';
    $('[data-stat-photos]').textContent = adminPhotos.length;
  }

  function renderArchive() {
    if (!photoList) return;
    const visible = adminPhotos.filter(canEdit);
    photoCount.textContent = `${visible.length} photograph${visible.length === 1 ? '' : 's'}`;
    photoList.innerHTML = visible.length ? visible.map(photo => `
      <article class="admin-photo">
        <img src="${esc(photo.image_url)}" alt="${esc(photo.alt_text || photo.airline || 'Aircraft')}">
        <div><h3>${esc(photo.registration || 'Unknown')} · ${esc(photo.aircraft_type || 'Unknown')}</h3><p>${esc(photo.airline || 'Unknown')} · ${esc(photo.airport || 'Unknown')} · ${esc(photo.photographer_name || '')}</p></div>
        <div class="admin-photo__actions"><button class="mini-button" type="button" data-edit-photo="${esc(photo.id)}">Edit</button><button class="mini-button danger" type="button" data-delete-photo="${esc(photo.id)}">Delete</button></div>
      </article>`).join('') : '<div class="admin-empty">No photographs available to this account yet.</div>';
    $$('[data-edit-photo]').forEach(btn => btn.addEventListener('click', () => openEditor(btn.dataset.editPhoto)));
    $$('[data-delete-photo]').forEach(btn => btn.addEventListener('click', () => deleteRecord(btn.dataset.deletePhoto, 'photograph')));
  }

  function renderPosts() {
    if (!postList) return;
    const mine = adminPosts.filter(canEdit);
    postCount.textContent = `${mine.length} post${mine.length === 1 ? '' : 's'}`;
    postList.innerHTML = mine.length ? mine.map(row => `
      <article class="admin-post">
        ${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : '<div class="admin-post__signal">SA</div>'}
        <div><span>${esc(backend.formatDate(row.created_at))} · ${esc(row.photographer_name)}</span><h3>${esc(row.aircraft_type || 'Crew update')}</h3><p>${esc(row.caption || '')}</p></div>
        <div class="admin-photo__actions"><button class="mini-button" type="button" data-edit-post="${esc(row.id)}">Edit</button><button class="mini-button danger" type="button" data-delete-post="${esc(row.id)}">Delete</button></div>
      </article>`).join('') : '<div class="admin-empty">No posts yet. Publish the first update from the form beside this list.</div>';
    $$('[data-edit-post]').forEach(btn => btn.addEventListener('click', () => openPostEditor(btn.dataset.editPost)));
    $$('[data-delete-post]').forEach(btn => btn.addEventListener('click', () => deleteRecord(btn.dataset.deletePost, 'post')));
  }

  function renderProfileEditor() {
    if (!profile) return;
    const localPerson = window.SCOTTISH_AERO?.photographers?.find(p => p.name === profile.display_name);
    const bio = profileRecord?.caption || localPerson?.bio || 'Scottish.aero photographer.';
    const avatar = profileRecord?.image_url || localPerson?.avatar || '';
    const myPhoto = adminPhotos.find(row => row.photographer_name === profile.display_name)?.image_url || '';
    if (profileForm) profileForm.elements.bio.value = bio;
    if (bioCount) bioCount.textContent = bio.length;
    if (overviewName) overviewName.textContent = profile.display_name;
    if (overviewBio) overviewBio.textContent = bio;
    if (previewName) previewName.textContent = profile.display_name;
    if (previewBio) previewBio.textContent = bio;
    if (previewAvatar) previewAvatar.innerHTML = avatarMarkup(avatar, profile.display_name);
    if (adminAvatar) adminAvatar.innerHTML = avatarMarkup(avatar, profile.display_name);
    if (previewCover) previewCover.innerHTML = myPhoto ? `<img src="${esc(myPhoto)}" alt="">` : '';
  }

  function showStudioTab(name) {
    $$('[data-studio-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.studioTab === name));
    $$('[data-studio-panel]').forEach(panel => { panel.hidden = panel.dataset.studioPanel !== name; });
    if (name !== 'overview') scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-studio-tab]').forEach(btn => btn.addEventListener('click', () => showStudioTab(btn.dataset.studioTab)));
  $$('[data-jump-tab]').forEach(btn => btn.addEventListener('click', () => showStudioTab(btn.dataset.jumpTab)));

  async function enterDashboard(user) {
    sessionUser = user;
    try { profile = await getProfile(user.id); }
    catch (error) {
      showMessage(loginError, `Profile error: ${error.message}`);
      await client.auth.signOut();
      return;
    }
    loginCard.hidden = true;
    adminApp.hidden = false;
    profileName.textContent = profile.display_name.split(' ')[0];
    $('[data-profile-role]').textContent = profile.is_manager ? 'Site manager · Photographer' : 'Scottish.aero photographer';
    await loadRows();
    await loadStats();
  }

  async function leaveDashboard() {
    sessionUser = null; profile = null; rows = []; adminPhotos = []; adminPosts = []; profileRecord = null;
    adminApp.hidden = true; loginCard.hidden = false;
    loginForm?.reset();
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(loginError);
    if (!client) client = await connect();
    if (!client) return showMessage(loginError, 'The Scottish.aero backend is not connected on this deployment.');
    const form = new FormData(loginForm);
    const username = String(form.get('username') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const email = accountEmails[username];
    if (!email) return showMessage(loginError, 'Unknown Scottish.aero account.');
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Signing in…';
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    submit.disabled = false; submit.textContent = 'Enter studio';
    if (error) return showMessage(loginError, error.message);
    await enterDashboard(data.user);
  });

  signOutButton?.addEventListener('click', async () => {
    if (client) await client.auth.signOut();
    await leaveDashboard();
  });

  function previewFile(input, preview) {
    clearMessage(uploadError); clearMessage(uploadSuccess);
    const file = input?.files?.[0];
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Upload preview">`;
    preview.classList.add('show');
    const img = new Image();
    img.onload = () => {
      if (input === uploadFile) {
        const ratio = img.width / img.height;
        uploadRatio = ratio > 1.55 ? 'wide' : ratio < .9 ? 'tall' : 'standard';
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  uploadFile?.addEventListener('change', () => previewFile(uploadFile, uploadPreview));
  postFile?.addEventListener('change', () => previewFile(postFile, postPreview));

  async function optimiseUpload(file, { maxSide = 2200, quality = 0.82, square = false } = {}) {
    try {
      const bitmap = await createImageBitmap(file);
      let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
      if (square) {
        const side = Math.min(bitmap.width, bitmap.height);
        sx = Math.floor((bitmap.width - side) / 2); sy = Math.floor((bitmap.height - side) / 2); sw = sh = side;
      }
      const scale = Math.min(1, maxSide / Math.max(sw, sh));
      const width = Math.max(1, Math.round(sw * scale));
      const height = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height); bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob) throw new Error('WebP conversion unavailable');
      return { blob, type: 'image/webp', ext: 'webp' };
    } catch (error) {
      console.warn('Scottish.aero: using original upload.', error);
      return { blob: file, type: file.type || 'image/jpeg', ext: (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() };
    }
  }

  async function uploadAsset(file, options = {}) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('The selected file is not an image.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Please keep individual images below 20 MB.');
    const optimised = await optimiseUpload(file, options);
    const objectName = `${sessionUser.id}/${crypto.randomUUID()}.${optimised.ext}`;
    const upload = await client.storage.from('photos').upload(objectName, optimised.blob, { cacheControl: '31536000', upsert: false, contentType: optimised.type });
    if (upload.error) throw upload.error;
    const { data } = client.storage.from('photos').getPublicUrl(objectName);
    return data.publicUrl;
  }

  uploadForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(uploadError); clearMessage(uploadSuccess);
    if (!client || !sessionUser) return;
    const file = uploadFile.files?.[0];
    if (!file) return showMessage(uploadError, 'Choose a photograph first.');
    const form = new FormData(uploadForm);
    const submit = uploadForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Optimising & uploading…';
    let imageUrl = '';
    try {
      imageUrl = await uploadAsset(file, { maxSide: 2200, quality: 0.82 });
      const payload = {
        image_url: imageUrl,
        registration: String(form.get('registration') || 'Unknown').trim() || 'Unknown',
        aircraft_type: String(form.get('aircraft_type') || 'Unknown').trim() || 'Unknown',
        airline: String(form.get('airline') || 'Unknown').trim() || 'Unknown',
        airport: String(form.get('airport') || 'Unknown').trim().toUpperCase() || 'Unknown',
        taken_at: form.get('taken_at') || null,
        caption: String(form.get('caption') || '').trim(),
        alt_text: String(form.get('alt_text') || '').trim(),
        ratio: uploadRatio
      };
      const inserted = await client.from('photos').insert(payload).select().single();
      if (inserted.error) throw inserted.error;
      backend.invalidateContent();
      uploadForm.reset(); uploadPreview.innerHTML = ''; uploadPreview.classList.remove('show'); uploadRatio = 'standard';
      showMessage(uploadSuccess, `Published as ${profile.display_name}'s photograph.`, true);
      await loadRows(); await loadStats();
    } catch (error) {
      showMessage(uploadError, error.message || 'Upload failed.');
    } finally { submit.disabled = false; submit.textContent = 'Publish photograph'; }
  });

  postForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(postError); clearMessage(postSuccess);
    const form = new FormData(postForm);
    const title = String(form.get('title') || '').trim();
    const body = String(form.get('body') || '').trim();
    if (!title || !body) return showMessage(postError, 'Add a title and some text first.');
    const submit = postForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Publishing…';
    try {
      const file = postFile?.files?.[0];
      const imageUrl = file ? await uploadAsset(file, { maxSide: 1800, quality: 0.8 }) : '';
      const result = await client.from('photos').insert({
        image_url: imageUrl,
        registration: backend.META_POST,
        aircraft_type: title,
        airline: 'Crew post',
        airport: 'SCOTLAND',
        caption: body,
        alt_text: title,
        ratio: 'standard',
        featured: false,
        sort_order: 9999
      }).select().single();
      if (result.error) throw result.error;
      backend.invalidateContent();
      postForm.reset(); postPreview.innerHTML = ''; postPreview.classList.remove('show');
      showMessage(postSuccess, 'Post published to your profile.', true);
      await loadRows();
    } catch (error) { showMessage(postError, error.message || 'Post failed.'); }
    finally { submit.disabled = false; submit.textContent = 'Publish post'; }
  });

  profileForm?.elements.bio?.addEventListener('input', event => {
    const value = event.target.value;
    bioCount.textContent = value.length;
    previewBio.textContent = value || 'Your bio will appear here.';
  });
  avatarFile?.addEventListener('change', () => {
    const file = avatarFile.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewAvatar.innerHTML = `<img src="${url}" alt="Profile preview">`;
  });

  profileForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(profileError); clearMessage(profileSuccess);
    const form = new FormData(profileForm);
    const bio = String(form.get('bio') || '').trim();
    const submit = profileForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Updating…';
    try {
      const file = avatarFile?.files?.[0];
      let avatar = profileRecord?.image_url || '';
      if (file) avatar = await uploadAsset(file, { maxSide: 640, quality: 0.84, square: true });
      const payload = {
        image_url: avatar,
        registration: backend.META_PROFILE,
        aircraft_type: 'Photographer profile',
        airline: 'Scottish.aero',
        airport: 'SCOTLAND',
        caption: bio,
        alt_text: `${profile.display_name} profile photo`,
        ratio: 'standard',
        featured: false,
        sort_order: 9998
      };
      let result;
      if (profileRecord?.id) result = await client.from('photos').update(payload).eq('id', profileRecord.id).select().single();
      else result = await client.from('photos').insert(payload).select().single();
      if (result.error) throw result.error;
      backend.invalidateContent();
      showMessage(profileSuccess, 'Public profile updated.', true);
      await loadRows();
    } catch (error) { showMessage(profileError, error.message || 'Profile update failed.'); }
    finally { submit.disabled = false; submit.textContent = 'Update profile'; }
  });

  function openEditor(id) {
    const photo = adminPhotos.find(p => p.id === id);
    if (!photo || !canEdit(photo)) return;
    editForm.elements.id.value = photo.id;
    editForm.elements.registration.value = photo.registration || 'Unknown';
    editForm.elements.aircraft_type.value = photo.aircraft_type || 'Unknown';
    editForm.elements.airline.value = photo.airline || 'Unknown';
    editForm.elements.airport.value = photo.airport || 'Unknown';
    editForm.elements.taken_at.value = photo.taken_at || '';
    editForm.elements.caption.value = photo.caption || '';
    editForm.elements.alt_text.value = photo.alt_text || '';
    editForm.elements.featured.checked = Boolean(photo.featured);
    clearMessage(editError); editDialog.showModal();
  }

  editForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(editError);
    const form = new FormData(editForm); const id = String(form.get('id'));
    const photo = adminPhotos.find(p => p.id === id);
    if (!photo || !canEdit(photo)) return showMessage(editError, 'You cannot edit this photograph.');
    const payload = {
      registration: String(form.get('registration') || 'Unknown').trim() || 'Unknown',
      aircraft_type: String(form.get('aircraft_type') || 'Unknown').trim() || 'Unknown',
      airline: String(form.get('airline') || 'Unknown').trim() || 'Unknown',
      airport: String(form.get('airport') || 'Unknown').trim().toUpperCase() || 'Unknown',
      taken_at: form.get('taken_at') || null,
      caption: String(form.get('caption') || '').trim(),
      alt_text: String(form.get('alt_text') || '').trim(),
      featured: form.get('featured') === 'on'
    };
    const result = await client.from('photos').update(payload).eq('id', id);
    if (result.error) return showMessage(editError, result.error.message);
    backend.invalidateContent(); editDialog.close(); await loadRows();
  });
  $$('[data-close-edit]').forEach(btn => btn.addEventListener('click', () => editDialog.close()));

  function openPostEditor(id) {
    const post = adminPosts.find(p => p.id === id);
    if (!post || !canEdit(post)) return;
    postEditForm.elements.id.value = post.id;
    postEditForm.elements.title.value = post.aircraft_type || '';
    postEditForm.elements.body.value = post.caption || '';
    clearMessage(postEditError); postEditDialog.showModal();
  }
  postEditForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(postEditError);
    const form = new FormData(postEditForm); const id = String(form.get('id'));
    const row = adminPosts.find(p => p.id === id);
    if (!row || !canEdit(row)) return showMessage(postEditError, 'You cannot edit this post.');
    const result = await client.from('photos').update({ aircraft_type: String(form.get('title') || '').trim(), caption: String(form.get('body') || '').trim(), alt_text: String(form.get('title') || '').trim() }).eq('id', id);
    if (result.error) return showMessage(postEditError, result.error.message);
    backend.invalidateContent(); postEditDialog.close(); await loadRows();
  });
  $$('[data-close-post-edit]').forEach(btn => btn.addEventListener('click', () => postEditDialog.close()));

  async function removeStorageImage(url) {
    const marker = '/storage/v1/object/public/photos/';
    if (!url?.includes(marker)) return;
    const objectPath = decodeURIComponent(url.split(marker)[1]);
    if (objectPath) await client.storage.from('photos').remove([objectPath]);
  }

  async function deleteRecord(id, label) {
    const row = rows.find(r => r.id === id);
    if (!row || !canEdit(row)) return;
    if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;
    const result = await client.from('photos').delete().eq('id', id);
    if (result.error) return alert(result.error.message);
    await removeStorageImage(row.image_url);
    backend.invalidateContent(); await loadRows(); await loadStats();
  }

  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(passwordMessage);
    const form = new FormData(passwordForm); const password = String(form.get('new_password') || '');
    if (password.length < 10) return showMessage(passwordMessage, 'Use at least 10 characters.');
    const { error } = await client.auth.updateUser({ password });
    if (error) return showMessage(passwordMessage, error.message);
    passwordForm.reset(); showMessage(passwordMessage, 'Password changed.', true);
  });

  async function init() {
    client = await connect();
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data.session?.user) await enterDashboard(data.session.user);
  }
  init();
})();
