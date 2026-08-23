(() => {
  const backend = window.ScottishAeroBackend;
  const client = backend?.client;
  const loginCard = document.querySelector('[data-login-card]');
  const loginForm = document.querySelector('[data-login-form]');
  const loginError = document.querySelector('[data-login-error]');
  const adminApp = document.querySelector('[data-admin-app]');
  const signOutButton = document.querySelector('[data-sign-out]');
  const profileName = document.querySelector('[data-profile-name]');
  const statusDot = document.querySelector('[data-backend-status]');
  const backendWarning = document.querySelector('[data-backend-warning]');
  const uploadForm = document.querySelector('[data-upload-form]');
  const uploadFile = document.querySelector('[data-upload-file]');
  const uploadPreview = document.querySelector('[data-upload-preview]');
  const uploadError = document.querySelector('[data-upload-error]');
  const uploadSuccess = document.querySelector('[data-upload-success]');
  const photoList = document.querySelector('[data-admin-photo-list]');
  const editDialog = document.querySelector('[data-edit-dialog]');
  const editForm = document.querySelector('[data-edit-form]');
  const editError = document.querySelector('[data-edit-error]');
  const passwordForm = document.querySelector('[data-password-form]');
  const passwordMessage = document.querySelector('[data-password-message]');

  const accountEmails = {
    mohammed: 'mohammed@scottish.aero',
    ellis: 'ellis@scottish.aero',
    arran: 'arran@scottish.aero'
  };

  let sessionUser = null;
  let profile = null;
  let adminPhotos = [];
  let uploadRatio = 'standard';

  const showMessage = (el, text, success = false) => {
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    el.classList.toggle('form-success', success);
    el.classList.toggle('form-error', !success);
  };
  const clearMessage = el => el?.classList.remove('show');

  if (backend?.configured) statusDot?.classList.add('is-live');
  if (!backend?.configured) {
    showMessage(loginError, 'Supabase is not connected yet. Follow SUPABASE-SETUP.md first.');
    backendWarning?.removeAttribute('hidden');
    loginForm?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
  }

  function canEdit(photo) {
    return Boolean(profile?.is_manager || photo.owner_id === sessionUser?.id || photo.photographer_name === profile?.display_name);
  }

  async function getProfile(userId) {
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  }

  async function loadStats() {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [visits, week, views, photos] = await Promise.all([
      client.from('site_visits').select('*', { count: 'exact', head: true }),
      client.from('site_visits').select('*', { count: 'exact', head: true }).gte('visited_at', weekAgo),
      client.from('photo_views').select('*', { count: 'exact', head: true }),
      client.from('photos').select('*', { count: 'exact', head: true })
    ]);
    document.querySelector('[data-stat-visits]').textContent = visits.count ?? '—';
    document.querySelector('[data-stat-week]').textContent = week.count ?? '—';
    document.querySelector('[data-stat-views]').textContent = views.count ?? '—';
    document.querySelector('[data-stat-photos]').textContent = photos.count ?? '—';
  }

  async function loadPhotos() {
    photoList.innerHTML = '<div class="admin-empty">Loading photographs…</div>';
    const { data, error } = await client.from('photos').select('*').order('created_at', { ascending: false });
    if (error) {
      photoList.innerHTML = `<div class="admin-empty">Could not load photographs: ${error.message}</div>`;
      return;
    }
    adminPhotos = data || [];
    if (!adminPhotos.length) {
      photoList.innerHTML = '<div class="admin-empty">No photographs yet. Upload the first one.</div>';
      return;
    }
    photoList.innerHTML = adminPhotos.map(photo => {
      const editable = canEdit(photo);
      return `
        <article class="admin-photo">
          <img src="${photo.image_url}" alt="${photo.alt_text || photo.airline || 'Aircraft'}" loading="lazy" decoding="async">
          <div>
            <h3>${photo.registration || 'Unknown'} · ${photo.airline || 'Unknown'}</h3>
            <p>${photo.aircraft_type || 'Unknown'} · ${photo.airport || 'Unknown'} · ${photo.photographer_name}</p>
          </div>
          <div class="admin-photo__actions">
            ${editable ? `<button class="mini-button" type="button" data-edit-photo="${photo.id}">Edit</button><button class="mini-button danger" type="button" data-delete-photo="${photo.id}">Delete</button>` : '<span class="muted" style="font-size:.7rem">Read only</span>'}
          </div>
        </article>`;
    }).join('');
    photoList.querySelectorAll('[data-edit-photo]').forEach(btn => btn.addEventListener('click', () => openEditor(btn.dataset.editPhoto)));
    photoList.querySelectorAll('[data-delete-photo]').forEach(btn => btn.addEventListener('click', () => deletePhoto(btn.dataset.deletePhoto)));
  }

  async function enterDashboard(user) {
    sessionUser = user;
    try {
      profile = await getProfile(user.id);
    } catch (error) {
      showMessage(loginError, `Profile error: ${error.message}`);
      await client.auth.signOut();
      return;
    }
    loginCard.hidden = true;
    adminApp.hidden = false;
    profileName.textContent = profile.display_name;
    document.querySelector('[data-profile-role]').textContent = profile.is_manager ? 'Site manager · Photographer' : 'Photographer';
    await Promise.all([loadStats(), loadPhotos()]);
  }

  async function leaveDashboard() {
    sessionUser = null; profile = null; adminPhotos = [];
    adminApp.hidden = true; loginCard.hidden = false;
    loginForm?.reset();
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(loginError);
    if (!client) return;
    const form = new FormData(loginForm);
    const username = String(form.get('username') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const email = accountEmails[username];
    if (!email) return showMessage(loginError, 'Unknown Scottish.aero account.');
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Signing in…';
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    submit.disabled = false; submit.textContent = 'Enter dashboard';
    if (error) return showMessage(loginError, error.message);
    await enterDashboard(data.user);
  });

  signOutButton?.addEventListener('click', async () => {
    if (client) await client.auth.signOut();
    await leaveDashboard();
  });

  uploadFile?.addEventListener('change', () => {
    clearMessage(uploadError); clearMessage(uploadSuccess);
    const file = uploadFile.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    uploadPreview.innerHTML = `<img src="${url}" alt="Upload preview">`;
    uploadPreview.classList.add('show');
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      uploadRatio = ratio > 1.55 ? 'wide' : ratio < .9 ? 'tall' : 'standard';
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  async function optimiseUpload(file) {
    // Resize and convert in the browser before Supabase sees the file.
    // This keeps future gallery uploads fast without any database/schema changes.
    const maxSide = 2200;
    const quality = 0.82;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob) throw new Error('WebP conversion unavailable');
      return { blob, width, height, type: 'image/webp', ext: 'webp' };
    } catch (error) {
      console.warn('Scottish.aero: using original upload because browser optimisation failed.', error);
      return {
        blob: file,
        width: 0,
        height: 0,
        type: file.type || 'image/jpeg',
        ext: (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase()
      };
    }
  }

  uploadForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(uploadError); clearMessage(uploadSuccess);
    if (!client || !sessionUser) return;
    const file = uploadFile.files?.[0];
    if (!file) return showMessage(uploadError, 'Choose a photograph first.');
    if (!file.type.startsWith('image/')) return showMessage(uploadError, 'The selected file is not an image.');
    if (file.size > 20 * 1024 * 1024) return showMessage(uploadError, 'Please keep individual images below 20 MB.');

    const form = new FormData(uploadForm);
    const submit = uploadForm.querySelector('button[type="submit"]');
    submit.disabled = true; submit.textContent = 'Optimising…';

    try {
      const optimised = await optimiseUpload(file);
      const objectName = `${sessionUser.id}/${crypto.randomUUID()}.${optimised.ext}`;
      submit.textContent = 'Uploading…';
      const upload = await client.storage.from('photos').upload(objectName, optimised.blob, {
        cacheControl: '31536000',
        upsert: false,
        contentType: optimised.type
      });
      if (upload.error) throw upload.error;
      const { data: urlData } = client.storage.from('photos').getPublicUrl(objectName);
      const payload = {
        image_url: urlData.publicUrl,
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
      if (inserted.error) {
        await client.storage.from('photos').remove([objectName]);
        throw inserted.error;
      }
      uploadForm.reset(); uploadPreview.innerHTML = ''; uploadPreview.classList.remove('show'); uploadRatio = 'standard';
      showMessage(uploadSuccess, `Published as ${profile.display_name}'s photograph.`, true);
      await Promise.all([loadPhotos(), loadStats()]);
    } catch (error) {
      showMessage(uploadError, error.message || 'Upload failed.');
    } finally {
      submit.disabled = false; submit.textContent = 'Publish photograph';
    }
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
    clearMessage(editError);
    editDialog.showModal();
  }

  editForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(editError);
    const form = new FormData(editForm);
    const id = String(form.get('id'));
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
    editDialog.close();
    await loadPhotos();
  });

  document.querySelectorAll('[data-close-edit]').forEach(btn => btn.addEventListener('click', () => editDialog.close()));

  async function deletePhoto(id) {
    const photo = adminPhotos.find(p => p.id === id);
    if (!photo || !canEdit(photo)) return;
    if (!confirm(`Delete ${photo.registration || 'this photograph'}? This cannot be undone.`)) return;
    const result = await client.from('photos').delete().eq('id', id);
    if (result.error) return alert(result.error.message);

    const marker = '/storage/v1/object/public/photos/';
    if (photo.image_url?.includes(marker)) {
      const objectPath = decodeURIComponent(photo.image_url.split(marker)[1]);
      if (objectPath) await client.storage.from('photos').remove([objectPath]);
    }
    await Promise.all([loadPhotos(), loadStats()]);
  }

  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearMessage(passwordMessage);
    const form = new FormData(passwordForm);
    const password = String(form.get('new_password') || '');
    if (password.length < 10) return showMessage(passwordMessage, 'Use at least 10 characters.');
    const { error } = await client.auth.updateUser({ password });
    if (error) return showMessage(passwordMessage, error.message);
    passwordForm.reset(); showMessage(passwordMessage, 'Password changed.', true);
  });

  async function init() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data.session?.user) await enterDashboard(data.session.user);
  }
  init();
})();
