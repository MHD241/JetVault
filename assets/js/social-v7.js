(() => {
  const backend = window.ScottishAeroBackend;
  if (!backend) return;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const initials = name => String(name || 'SA').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  let sessionCache;

  async function getUser({ fresh = false } = {}) {
    if (!backend.configured) return null;
    if (!fresh && sessionCache !== undefined) return sessionCache;
    const db = await backend.ensureClient(); if (!db) return null;
    const { data } = await db.auth.getSession(); sessionCache = data?.session?.user || null; return sessionCache;
  }
  async function getMyProfile() {
    const user = await getUser(); if (!user) return null;
    const db = await backend.ensureClient(); const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle(); return data || null;
  }
  async function requireUser() { const user = await getUser(); if (user) return user; window.dispatchEvent(new CustomEvent('sa:signin-required')); return null; }

  async function getContentSocial(contentId) {
    const db = await backend.ensureClient();
    if (!db || !contentId) return { likes:0, liked:false, comments:[], user:null, bookmarked:false };
    const user = await getUser();
    const [{ data: likes }, { data: comments }, bookmarkResult] = await Promise.all([
      db.from('content_likes').select('user_id').eq('content_id', contentId),
      db.from('comments').select('id,user_id,author_name,body,created_at,parent_id').eq('content_id', contentId).order('created_at', { ascending: true }),
      user ? db.from('bookmarks').select('photo_id').eq('photo_id', contentId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data:null })
    ]);
    const commentIds = (comments || []).map(c => c.id);
    let commentLikes = [], people = [];
    if (commentIds.length) {
      const users = [...new Set((comments || []).map(c => c.user_id).filter(Boolean))];
      const [cl, pr] = await Promise.all([
        db.from('comment_likes').select('comment_id,user_id').in('comment_id', commentIds),
        users.length ? db.from('profiles').select('id,display_name,username,avatar_url,is_crew').in('id', users) : Promise.resolve({ data:[] })
      ]);
      commentLikes = cl.data || []; people = pr.data || [];
    }
    const peopleById = new Map(people.map(p => [p.id,p]));
    const enriched = (comments || []).map(c => ({ ...c, profile: peopleById.get(c.user_id) || null, likeCount: commentLikes.filter(l => l.comment_id === c.id).length, liked: Boolean(user && commentLikes.some(l => l.comment_id === c.id && l.user_id === user.id)) }));
    return { likes:likes?.length || 0, liked:Boolean(user && likes?.some(r => r.user_id === user.id)), comments:enriched, user, bookmarked:Boolean(bookmarkResult?.data) };
  }

  async function getCounts(contentIds) {
    const ids = [...new Set((contentIds || []).filter(Boolean))]; if (!ids.length) return {};
    const db = await backend.ensureClient(); if (!db) return {};
    const user = await getUser();
    const [likeR, commentR] = await Promise.all([db.from('content_likes').select('content_id,user_id').in('content_id', ids), db.from('comments').select('content_id').in('content_id', ids)]);
    if (likeR.error || commentR.error) throw likeR.error || commentR.error;
    const out = Object.fromEntries(ids.map(id => [id,{likes:0,comments:0,liked:false}]));
    (likeR.data || []).forEach(r => { if(out[r.content_id]) { out[r.content_id].likes++; if(user && r.user_id===user.id) out[r.content_id].liked=true; } });
    (commentR.data || []).forEach(r => { if(out[r.content_id]) out[r.content_id].comments++; }); return out;
  }

  async function toggleLike(contentId) {
    const user = await requireUser(); if (!user) return null; const db = await backend.ensureClient();
    const { data: existing, error } = await db.from('content_likes').select('content_id').eq('content_id',contentId).eq('user_id',user.id).maybeSingle(); if(error) throw error;
    const result = existing ? await db.from('content_likes').delete().eq('content_id',contentId).eq('user_id',user.id) : await db.from('content_likes').insert({content_id:contentId,user_id:user.id});
    if(result.error) throw result.error; return getContentSocial(contentId);
  }
  async function addComment(contentId, body, parentId = null) {
    const user = await requireUser(); if(!user) return null; const clean=String(body||'').trim().slice(0,800); if(!clean) return null;
    const db = await backend.ensureClient(); const { error } = await db.from('comments').insert({content_id:contentId,user_id:user.id,body:clean,parent_id:parentId||null}); if(error) throw error; return getContentSocial(contentId);
  }
  async function deleteComment(commentId, contentId) { const user=await requireUser(); if(!user)return null; const db=await backend.ensureClient(); const {error}=await db.from('comments').delete().eq('id',commentId); if(error)throw error; return getContentSocial(contentId); }
  async function toggleCommentLike(commentId, contentId) {
    const user=await requireUser(); if(!user)return null; const db=await backend.ensureClient();
    const {data:existing,error}=await db.from('comment_likes').select('comment_id').eq('comment_id',commentId).eq('user_id',user.id).maybeSingle(); if(error)throw error;
    const r=existing?await db.from('comment_likes').delete().eq('comment_id',commentId).eq('user_id',user.id):await db.from('comment_likes').insert({comment_id:commentId,user_id:user.id}); if(r.error)throw r.error; return getContentSocial(contentId);
  }
  async function toggleBookmark(photoId) {
    const user=await requireUser(); if(!user)return null; const db=await backend.ensureClient();
    const {data:existing,error}=await db.from('bookmarks').select('photo_id').eq('photo_id',photoId).eq('user_id',user.id).maybeSingle(); if(error)throw error;
    const r=existing?await db.from('bookmarks').delete().eq('photo_id',photoId).eq('user_id',user.id):await db.from('bookmarks').insert({photo_id:photoId,user_id:user.id}); if(r.error)throw r.error; return !existing;
  }
  async function reportContent({contentId=null,commentId=null,reason='Other'}) {
    const user=await requireUser(); if(!user)return false; const db=await backend.ensureClient(); const clean=String(reason||'').trim().slice(0,500); if(clean.length<3) return false;
    const {error}=await db.from('reports').insert({reporter_id:user.id,content_id:contentId,comment_id:commentId,reason:clean}); if(error)throw error; return true;
  }

  async function getFollowState(targetId) {
    const db=await backend.ensureClient(); if(!db||!targetId)return{followers:0,following:0,followed:false,user:null}; const user=await getUser();
    const [a,b]=await Promise.all([db.from('follows').select('follower_id').eq('following_id',targetId),db.from('follows').select('following_id').eq('follower_id',targetId)]);
    return{followers:a.data?.length||0,following:b.data?.length||0,followed:Boolean(user&&a.data?.some(r=>r.follower_id===user.id)),user};
  }
  async function toggleFollow(targetId) { const user=await requireUser(); if(!user||!targetId||user.id===targetId)return null; const db=await backend.ensureClient(); const {data:existing,error}=await db.from('follows').select('following_id').eq('follower_id',user.id).eq('following_id',targetId).maybeSingle(); if(error)throw error; const r=existing?await db.from('follows').delete().eq('follower_id',user.id).eq('following_id',targetId):await db.from('follows').insert({follower_id:user.id,following_id:targetId}); if(r.error)throw r.error; return getFollowState(targetId); }

  async function getNotifications(limit=30) {
    const user=await getUser(); if(!user)return[]; const db=await backend.ensureClient();
    const {data,error}=await db.from('notifications').select('id,actor_id,type,content_id,comment_id,message,created_at,read_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(limit); if(error)throw error;
    const actorIds=[...new Set((data||[]).map(n=>n.actor_id).filter(Boolean))]; let actors=[];
    if(actorIds.length){const r=await db.from('profiles').select('id,display_name,username,avatar_url,is_crew').in('id',actorIds); actors=r.data||[];}
    const map=new Map(actors.map(a=>[a.id,a])); return(data||[]).map(n=>({...n,actor:map.get(n.actor_id)||null}));
  }
  async function markNotificationsRead() { const user=await getUser(); if(!user)return; const db=await backend.ensureClient(); await db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null); window.dispatchEvent(new CustomEvent('sa:notifications-changed')); }

  function avatar(profile,name){return profile?.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="">`:`<span>${esc(initials(name))}</span>`;}
  function commentMarkup(comment,user,replies=false){
    const p=comment.profile; const name=p?.display_name||comment.author_name||'Scottish.aero member'; const key=p?.username||backend.slugify(name); const canDelete=Boolean(user&&user.id===comment.user_id);
    return `<article class="social-comment ${replies?'social-comment--reply':''}" data-comment-id="${esc(comment.id)}"><a class="social-comment__avatar" href="profile.html?photographer=${encodeURIComponent(key)}">${avatar(p,name)}</a><div class="social-comment__body"><div class="social-comment__head"><a href="profile.html?photographer=${encodeURIComponent(key)}"><b>${esc(name)}</b>${p?.is_crew?'<i>CREW</i>':''}</a><time>${esc(backend.formatDate(comment.created_at))}</time></div><p>${esc(comment.body)}</p><div class="social-comment__actions"><button type="button" data-comment-like="${esc(comment.id)}" class="${comment.liked?'is-active':''}">♥ <span>${comment.likeCount||0}</span></button><button type="button" data-reply-comment="${esc(comment.id)}" data-reply-name="${esc(name)}">Reply</button><button type="button" data-report-comment="${esc(comment.id)}">Report</button>${canDelete?`<button type="button" data-delete-comment="${esc(comment.id)}">Delete</button>`:''}</div></div></article>`;
  }

  function mountContentSocial(container,contentId,{compact=false}={}){
    if(!container||!contentId)return;
    container.innerHTML=`<div class="social-bar ${compact?'social-bar--compact':''}"><button class="social-action" type="button" data-social-like><span>♡</span><b data-like-count>0</b><em>Like</em></button><button class="social-action" type="button" data-social-comment-focus><span>◌</span><b data-comment-count>0</b><em>Comment</em></button><button class="social-action" type="button" data-social-bookmark><span>⌑</span><em>Save</em></button><button class="social-action social-action--more" type="button" data-social-report><span>•••</span><em>Report</em></button></div>${compact?'':`<div class="social-thread"><div class="social-replying" data-social-replying hidden></div><div class="social-comments" data-social-comments><div class="social-loading">Loading conversation…</div></div><form class="social-comment-form" data-social-comment-form><input type="text" maxlength="800" placeholder="Add a comment…" aria-label="Add a comment"><button type="submit">Send ↗</button></form></div>`}`;
    const likeBtn=container.querySelector('[data-social-like]'),likeCount=container.querySelector('[data-like-count]'),commentCount=container.querySelector('[data-comment-count]'),commentsEl=container.querySelector('[data-social-comments]'),form=container.querySelector('[data-social-comment-form]'),bookmarkBtn=container.querySelector('[data-social-bookmark]'),replying=container.querySelector('[data-social-replying]');
    let replyTo=null;
    const bindComments=state=>{
      if(!commentsEl)return; const roots=(state.comments||[]).filter(c=>!c.parent_id); const replies=(state.comments||[]).filter(c=>c.parent_id);
      commentsEl.innerHTML=roots.length?roots.map(c=>`${commentMarkup(c,state.user)}${replies.filter(r=>r.parent_id===c.id).map(r=>commentMarkup(r,state.user,true)).join('')}`).join(''):'<div class="social-empty">No comments yet. Start the conversation.</div>';
      commentsEl.querySelectorAll('[data-delete-comment]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{render(await deleteComment(btn.dataset.deleteComment,contentId));}catch(_){btn.disabled=false;}}));
      commentsEl.querySelectorAll('[data-comment-like]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{render(await toggleCommentLike(btn.dataset.commentLike,contentId));}finally{btn.disabled=false;}}));
      commentsEl.querySelectorAll('[data-reply-comment]').forEach(btn=>btn.addEventListener('click',()=>{replyTo=btn.dataset.replyComment;if(replying){replying.hidden=false;replying.innerHTML=`Replying to <b>${esc(btn.dataset.replyName)}</b> <button type="button" data-cancel-reply>×</button>`;replying.querySelector('button').onclick=()=>{replyTo=null;replying.hidden=true;};}const input=form?.querySelector('input');if(input){input.placeholder=`Reply to ${btn.dataset.replyName}…`;input.focus();}}));
      commentsEl.querySelectorAll('[data-report-comment]').forEach(btn=>btn.addEventListener('click',()=>openReport({commentId:btn.dataset.reportComment})));
    };
    const render=state=>{likeCount.textContent=state.likes||0;commentCount.textContent=state.comments?.length||0;likeBtn.classList.toggle('is-active',Boolean(state.liked));likeBtn.querySelector('span').textContent=state.liked?'♥':'♡';bookmarkBtn?.classList.toggle('is-active',Boolean(state.bookmarked));if(bookmarkBtn)bookmarkBtn.querySelector('span').textContent=state.bookmarked?'▣':'⌑';bindComments(state);};
    getContentSocial(contentId).then(render).catch(()=>{if(commentsEl)commentsEl.innerHTML='<div class="social-empty">Social layer unavailable.</div>';});
    likeBtn.addEventListener('click',async()=>{likeBtn.disabled=true;try{const next=await toggleLike(contentId);if(next)render(next);}finally{likeBtn.disabled=false;}});
    bookmarkBtn?.addEventListener('click',async()=>{bookmarkBtn.disabled=true;try{const saved=await toggleBookmark(contentId);if(saved!==null)bookmarkBtn.classList.toggle('is-active',saved);}finally{bookmarkBtn.disabled=false;}});
    container.querySelector('[data-social-comment-focus]')?.addEventListener('click',()=>form?.querySelector('input')?.focus());
    container.querySelector('[data-social-report]')?.addEventListener('click',()=>openReport({contentId}));
    form?.addEventListener('submit',async e=>{e.preventDefault();const input=form.querySelector('input');const body=input.value.trim();if(!body)return;form.classList.add('is-sending');try{const next=await addComment(contentId,body,replyTo);if(next){input.value='';input.placeholder='Add a comment…';replyTo=null;if(replying)replying.hidden=true;render(next);}}finally{form.classList.remove('is-sending');}});
  }

  async function openReport(target){
    const user=await requireUser(); if(!user)return; let modal=document.querySelector('[data-report-modal]');
    if(!modal){modal=document.createElement('div');modal.className='social-signin-modal report-modal';modal.dataset.reportModal='';modal.innerHTML=`<div class="social-signin-modal__card"><button type="button" data-report-close>×</button><span class="eyebrow">Community safety</span><h2>Report this item.</h2><p>Tell the Scottish.aero moderators what needs checking.</p><textarea class="control" maxlength="500" data-report-reason placeholder="Reason for report"></textarea><button class="solid-button" type="button" data-report-send>Send report</button><div class="form-success" data-report-message></div></div>`;document.body.append(modal);modal.querySelector('[data-report-close]').onclick=()=>modal.classList.remove('is-open');}
    const reason=modal.querySelector('[data-report-reason]'),send=modal.querySelector('[data-report-send]'),msg=modal.querySelector('[data-report-message]');reason.value='';msg.textContent='';send.onclick=async()=>{send.disabled=true;try{const ok=await reportContent({...target,reason:reason.value});if(ok){msg.textContent='Report sent. Thank you.';msg.classList.add('show');setTimeout(()=>modal.classList.remove('is-open'),700);}}catch(e){msg.textContent=e.message;}finally{send.disabled=false;}};requestAnimationFrame(()=>modal.classList.add('is-open'));
  }

  window.addEventListener('sa:signin-required',()=>{
    let modal=document.querySelector('[data-social-signin-modal]');
    if(!modal){modal=document.createElement('div');modal.className='social-signin-modal';modal.dataset.socialSigninModal='';const ret=encodeURIComponent(location.pathname+location.search);modal.innerHTML=`<div class="social-signin-modal__card"><button type="button" data-social-signin-close>×</button><span class="eyebrow">Scottish.aero community</span><h2>Join the conversation.</h2><p>Create a free account to like, comment, follow photographers, save photos and submit your own aviation photography.</p><a class="solid-button" href="account.html?mode=signup&return=${ret}">Create account ↗</a><a class="outline-button" href="account.html?mode=login&return=${ret}">Sign in</a></div>`;document.body.append(modal);modal.querySelector('[data-social-signin-close]').onclick=()=>modal.classList.remove('is-open');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('is-open');});}requestAnimationFrame(()=>modal.classList.add('is-open'));
  });

  backend.ensureClient().then(db=>db?.auth?.onAuthStateChange?.((_event,session)=>{sessionCache=session?.user||null;window.dispatchEvent(new CustomEvent('sa:auth-changed'));})).catch(()=>{});
  window.ScottishAeroSocial={getUser,getMyProfile,getContentSocial,getCounts,toggleLike,addComment,deleteComment,toggleCommentLike,toggleBookmark,reportContent,getFollowState,toggleFollow,getNotifications,markNotificationsRead,mountContentSocial,initials};
})();
