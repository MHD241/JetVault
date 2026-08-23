(() => {
  const backend = window.ScottishAeroBackend;
  if (!backend) return;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const initials = name => String(name || 'SA').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  let sessionCache;

  async function getUser() {
    if (!backend.configured) return null;
    if (sessionCache !== undefined) return sessionCache;
    const db = await backend.ensureClient();
    if (!db) return null;
    const { data } = await db.auth.getSession();
    sessionCache = data?.session?.user || null;
    return sessionCache;
  }

  async function requireUser() {
    const user = await getUser();
    if (user) return user;
    window.dispatchEvent(new CustomEvent('sa:signin-required'));
    return null;
  }

  async function getContentSocial(contentId) {
    const db = await backend.ensureClient();
    if (!db || !contentId) return { likes: 0, liked: false, comments: [], user: null };
    const user = await getUser();
    const [{ data: likes }, { data: comments }] = await Promise.all([
      db.from('content_likes').select('user_id').eq('content_id', contentId),
      db.from('comments').select('id,user_id,author_name,body,created_at').eq('content_id', contentId).order('created_at', { ascending: true })
    ]);
    return {
      likes: likes?.length || 0,
      liked: Boolean(user && likes?.some(row => row.user_id === user.id)),
      comments: comments || [],
      user
    };
  }

  async function getCounts(contentIds) {
    const ids = [...new Set((contentIds || []).filter(Boolean))];
    if (!ids.length) return {};
    const db = await backend.ensureClient();
    if (!db) return {};
    const user = await getUser();
    const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
      db.from('content_likes').select('content_id,user_id').in('content_id', ids),
      db.from('comments').select('content_id').in('content_id', ids)
    ]);
    if (likesError || commentsError) throw likesError || commentsError;
    const out = Object.fromEntries(ids.map(id => [id, { likes: 0, comments: 0, liked: false }]));
    (likes || []).forEach(row => {
      if (!out[row.content_id]) return;
      out[row.content_id].likes++;
      if (user && row.user_id === user.id) out[row.content_id].liked = true;
    });
    (comments || []).forEach(row => { if (out[row.content_id]) out[row.content_id].comments++; });
    return out;
  }

  async function toggleLike(contentId) {
    const user = await requireUser();
    if (!user) return null;
    const db = await backend.ensureClient();
    const { data: existing, error: lookupError } = await db.from('content_likes').select('content_id').eq('content_id', contentId).eq('user_id', user.id).maybeSingle();
    if (lookupError) throw lookupError;
    const result = existing
      ? await db.from('content_likes').delete().eq('content_id', contentId).eq('user_id', user.id)
      : await db.from('content_likes').insert({ content_id: contentId, user_id: user.id });
    if (result.error) throw result.error;
    return getContentSocial(contentId);
  }

  async function addComment(contentId, body) {
    const user = await requireUser();
    if (!user) return null;
    const clean = String(body || '').trim().slice(0, 800);
    if (!clean) return null;
    const db = await backend.ensureClient();
    const { error } = await db.from('comments').insert({ content_id: contentId, user_id: user.id, body: clean });
    if (error) throw error;
    return getContentSocial(contentId);
  }

  async function deleteComment(commentId, contentId) {
    const user = await requireUser();
    if (!user) return null;
    const db = await backend.ensureClient();
    const { error } = await db.from('comments').delete().eq('id', commentId);
    if (error) throw error;
    return getContentSocial(contentId);
  }

  async function getFollowState(targetId) {
    const db = await backend.ensureClient();
    if (!db || !targetId) return { followers: 0, following: 0, followed: false, user: null };
    const user = await getUser();
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      db.from('follows').select('follower_id').eq('following_id', targetId),
      db.from('follows').select('following_id').eq('follower_id', targetId)
    ]);
    return {
      followers: incoming?.length || 0,
      following: outgoing?.length || 0,
      followed: Boolean(user && incoming?.some(row => row.follower_id === user.id)),
      user
    };
  }

  async function toggleFollow(targetId) {
    const user = await requireUser();
    if (!user || !targetId || user.id === targetId) return null;
    const db = await backend.ensureClient();
    const { data: existing, error: lookupError } = await db.from('follows').select('following_id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
    if (lookupError) throw lookupError;
    const result = existing
      ? await db.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId)
      : await db.from('follows').insert({ follower_id: user.id, following_id: targetId });
    if (result.error) throw result.error;
    return getFollowState(targetId);
  }

  function commentMarkup(comment, user) {
    const canDelete = Boolean(user && user.id === comment.user_id);
    return `<article class="social-comment" data-comment-id="${esc(comment.id)}"><span class="social-comment__avatar">${esc(initials(comment.author_name))}</span><div><div class="social-comment__head"><b>${esc(comment.author_name || 'Scottish.aero member')}</b><time>${esc(backend.formatDate(comment.created_at))}</time>${canDelete ? `<button type="button" data-delete-comment="${esc(comment.id)}">Delete</button>` : ''}</div><p>${esc(comment.body)}</p></div></article>`;
  }

  function mountContentSocial(container, contentId, { compact = false } = {}) {
    if (!container || !contentId) return;
    container.innerHTML = `<div class="social-bar ${compact ? 'social-bar--compact' : ''}"><button class="social-action" type="button" data-social-like><span>♡</span><b data-like-count>0</b><em>Like</em></button><button class="social-action" type="button" data-social-comment-focus><span>◌</span><b data-comment-count>0</b><em>Comment</em></button></div>${compact ? '' : `<div class="social-thread"><div class="social-comments" data-social-comments><div class="social-loading">Loading conversation…</div></div><form class="social-comment-form" data-social-comment-form><input type="text" maxlength="800" placeholder="Add a comment…" aria-label="Add a comment"><button type="submit">Send ↗</button></form></div>`}`;
    const likeBtn = container.querySelector('[data-social-like]');
    const likeCount = container.querySelector('[data-like-count]');
    const commentCount = container.querySelector('[data-comment-count]');
    const commentsEl = container.querySelector('[data-social-comments]');
    const form = container.querySelector('[data-social-comment-form]');

    const render = state => {
      likeCount.textContent = state.likes || 0;
      commentCount.textContent = state.comments?.length || 0;
      likeBtn.classList.toggle('is-active', Boolean(state.liked));
      likeBtn.querySelector('span').textContent = state.liked ? '♥' : '♡';
      if (commentsEl) {
        commentsEl.innerHTML = state.comments?.length ? state.comments.map(comment => commentMarkup(comment, state.user)).join('') : '<div class="social-empty">No comments yet. Start the conversation.</div>';
        commentsEl.querySelectorAll('[data-delete-comment]').forEach(btn => btn.addEventListener('click', async () => {
          btn.disabled = true;
          try { render(await deleteComment(btn.dataset.deleteComment, contentId)); } catch (_) { btn.disabled = false; }
        }));
      }
    };

    getContentSocial(contentId).then(render).catch(() => {
      if (commentsEl) commentsEl.innerHTML = '<div class="social-empty">Social layer unavailable.</div>';
    });
    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true;
      try { const next = await toggleLike(contentId); if (next) render(next); } finally { likeBtn.disabled = false; }
    });
    container.querySelector('[data-social-comment-focus]')?.addEventListener('click', () => form?.querySelector('input')?.focus());
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input');
      const body = input.value.trim();
      if (!body) return;
      form.classList.add('is-sending');
      try {
        const next = await addComment(contentId, body);
        if (next) { input.value = ''; render(next); }
      } finally { form.classList.remove('is-sending'); }
    });
  }

  window.addEventListener('sa:signin-required', () => {
    let modal = document.querySelector('[data-social-signin-modal]');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'social-signin-modal'; modal.dataset.socialSigninModal = '';
      modal.innerHTML = `<div class="social-signin-modal__card"><button type="button" data-social-signin-close>×</button><span class="eyebrow">Scottish.aero social</span><h2>Crew sign-in required.</h2><p>Likes, comments and follows are live now for Scottish.aero members. Public accounts are coming in a later release.</p><a class="solid-button" href="admin.html">Crew sign in ↗</a></div>`;
      document.body.append(modal);
      modal.querySelector('[data-social-signin-close]').addEventListener('click', () => modal.classList.remove('is-open'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('is-open'); });
    }
    requestAnimationFrame(() => modal.classList.add('is-open'));
  });

  window.ScottishAeroSocial = { getUser, getContentSocial, getCounts, toggleLike, addComment, deleteComment, getFollowState, toggleFollow, mountContentSocial, initials };
})();
