(() => {
  if (window.__SCOTTISH_AERO_SHELL_V71__) return;
  window.__SCOTTISH_AERO_SHELL_V71__ = true;

  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials = name => String(name||'SA').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  let accountRenderToken = 0;

  function ensureNavLinks(){
    document.querySelectorAll('.site-nav').forEach(nav=>{
      if(!nav.querySelector('a[href="discover.html"]')) nav.insertAdjacentHTML('afterbegin','<a href="discover.html">Discover</a>');
      if(!nav.querySelector('a[href="account.html"]')) nav.insertAdjacentHTML('beforeend','<a href="account.html">Community</a>');
      const page=location.pathname.split('/').pop()||'index.html';
      nav.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===page)a.setAttribute('aria-current','page');});
    });
  }

  function addGlobalFX(){
    if(document.querySelector('[data-v7-sky]')) return;
    const fx=document.createElement('div'); fx.className='v7-sky'; fx.dataset.v7Sky=''; fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<i></i><i></i><i></i><b></b>'; document.body.prepend(fx);
  }

  async function getUser(){
    if(!backend?.configured) return null;
    if(social?.getUser) return social.getUser({fresh:true}).catch(()=>null);
    const db=await backend.ensureClient().catch(()=>null); if(!db) return null;
    const {data}=await db.auth.getSession(); return data?.session?.user||null;
  }

  function notificationMarkup(n){
    const actor=n.actor?.display_name||'Scottish.aero'; const key=n.actor?.username||'';
    const href=n.content_id?`gallery.html?photo=${encodeURIComponent(n.content_id)}`:key?`profile.html?photographer=${encodeURIComponent(key)}`:'account.html';
    return `<a class="notification-mini ${n.read_at?'':'is-unread'}" href="${href}"><span>${n.actor?.avatar_url?`<img src="${esc(n.actor.avatar_url)}" alt="">`:esc(initials(actor))}</span><div><b>${esc(actor)}</b><p>${esc(n.message||n.type)}</p><time>${esc(backend?.formatDate?.(n.created_at)||'')}</time></div></a>`;
  }

  async function renderAccountChip(){
    const holder=document.querySelector('.header-action'); if(!holder) return;
    // Remove any V7 duplicates left by a previous async race and reserve the slot
    // *before* waiting on Supabase so simultaneous renders cannot append 2–3 chips.
    const chips=[...holder.querySelectorAll('[data-community-chip]')];
    chips.slice(1).forEach(el=>el.remove());
    let wrap=chips[0];
    if(!wrap){wrap=document.createElement('div');wrap.className='community-chip-wrap is-loading';wrap.dataset.communityChip='';holder.append(wrap);}
    const token=++accountRenderToken;
    wrap.innerHTML='<span class="community-chip"><span class="community-chip__dot"></span><b>•••</b></span>';

    if(!backend?.configured){
      if(token!==accountRenderToken)return;
      wrap.classList.remove('is-loading'); wrap.innerHTML='<a class="community-chip" href="account.html"><span class="community-chip__dot"></span><b>Join</b></a>'; return;
    }
    const user=await getUser(); if(token!==accountRenderToken)return;
    if(!user){wrap.classList.remove('is-loading');wrap.innerHTML='<a class="community-chip" href="account.html?mode=signup"><span class="community-chip__dot"></span><b>Join</b></a>';return;}
    const db=await backend.ensureClient();
    const {data:profile}=await db.from('profiles').select('display_name,username,avatar_url,is_crew,is_manager').eq('id',user.id).maybeSingle();
    if(token!==accountRenderToken)return;
    if(!profile){wrap.classList.remove('is-loading');wrap.innerHTML='<a class="community-chip" href="account.html"><b>Account</b></a>';return;}
    const notifications=social?.getNotifications?await social.getNotifications(20).catch(()=>[]):[];
    if(token!==accountRenderToken)return;
    const unread=notifications.filter(n=>!n.read_at).length;
    wrap.classList.remove('is-loading');
    wrap.innerHTML=`<button class="community-chip ${unread?'has-alert':''}" type="button" data-community-toggle><span class="community-chip__avatar">${profile.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="">`:esc(initials(profile.display_name))}</span><b>${esc((profile.display_name||'Account').split(' ')[0])}</b><em data-notification-badge>${unread||''}</em></button><div class="community-menu" data-community-menu hidden><div class="community-menu__head"><span>${profile.is_crew?'SCOTTISH.AERO CREW':'COMMUNITY'}</span><b>${esc(profile.display_name)}</b><small>@${esc(profile.username||'spotter')}</small></div><div class="community-menu__links"><a href="profile.html?photographer=${encodeURIComponent(profile.username||'')}">Your profile</a><a href="account.html">Account & submissions</a>${profile.is_crew?'<a href="admin.html">Creator Studio</a>':''}</div><div class="community-menu__notifications"><div class="community-menu__title"><b>Notifications</b>${social?'<button type="button" data-mark-read>Mark read</button>':''}</div><div data-notification-list>${notifications.length?notifications.slice(0,8).map(notificationMarkup).join(''):'<p class="community-menu__empty">Nothing new yet.</p>'}</div></div><button class="community-menu__signout" type="button" data-community-signout>Sign out</button></div>`;
    const btn=wrap.querySelector('[data-community-toggle]'),menu=wrap.querySelector('[data-community-menu]');
    btn.onclick=()=>{menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden));};
    const outside=e=>{if(!wrap.contains(e.target))menu.hidden=true;}; document.addEventListener('click',outside);
    wrap.querySelector('[data-mark-read]')?.addEventListener('click',async()=>{await social.markNotificationsRead();wrap.querySelector('[data-notification-badge]').textContent='';btn.classList.remove('has-alert');notifications.forEach(n=>n.read_at=n.read_at||new Date().toISOString());wrap.querySelector('[data-notification-list]').innerHTML=notifications.slice(0,8).map(notificationMarkup).join('');});
    wrap.querySelector('[data-community-signout]')?.addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
  }

  function ensureFutureSocials(){
    document.querySelectorAll('.site-footer .footer-top').forEach(footer=>{
      if(footer.querySelector('[data-future-socials]')) return;
      const col=document.createElement('div'); col.className='footer-col'; col.dataset.futureSocials='';
      col.innerHTML='<h3>Socials</h3><div class="footer-socials__soon"><span>Instagram · soon</span><span>TikTok · soon</span><span>YouTube · soon</span><small>Handles can be connected later without changing the layout.</small></div>';
      footer.append(col);
    });
  }

  function mountHelp(){
    if(document.querySelector('[data-sa-help]')) return;
    const box=document.createElement('aside'); box.className='sa-help'; box.dataset.saHelp='';
    box.innerHTML=`<div class="sa-help__panel" data-help-panel aria-hidden="true"><div class="sa-help__head"><div><span>Scottish.aero support</span><h3>Need a hand?</h3></div><button class="sa-help__close" type="button" aria-label="Close help" data-help-close>×</button></div><div class="sa-help__quick"><a href="discover.html">Discover photos ↗</a><a href="account.html">Account & uploads ↗</a><a href="games.html">Games Lab ↗</a><a href="gallery.html">Search gallery ↗</a></div><div class="sa-help__faq"><details><summary>How do photo submissions work?</summary><p>Community uploads enter a moderation queue first. Approved photographs then appear in Discover and the global gallery.</p></details><details><summary>Where are the original crew photos?</summary><p>Use the Crew filter in Gallery or the Founding Crew section in Photographers. Mohammed, Ellis and Arran keep permanent Crew badges.</p></details><details><summary>Why can’t I like or comment?</summary><p>Likes, comments, follows, saved photos and ratings require a free Scottish.aero community account.</p></details></div><section class="sa-rating"><div class="sa-rating__top"><div><span>Rate Scottish.aero</span><b data-rating-title>Your verdict.</b></div><div class="sa-rating__summary" data-rating-summary>Loading rating…</div></div><div class="sa-rating__stars" data-rating-stars aria-label="Rate Scottish.aero from 1 to 5 stars">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}" aria-label="${n} star${n===1?'':'s'}">★</button>`).join('')}</div><textarea maxlength="800" data-rating-note placeholder="Optional: what should we improve?"></textarea><div class="sa-rating__actions"><span class="sa-rating__message" data-rating-message></span><button type="button" data-rating-save disabled>Save rating</button></div><a class="sa-rating__signin" data-rating-signin href="account.html?mode=login" hidden>Sign in to rate Scottish.aero ↗</a></section></div><button class="sa-help__toggle" type="button" data-help-toggle aria-expanded="false"><span>?</span> Help & rate</button>`;
    document.body.append(box);
    const panel=box.querySelector('[data-help-panel]'),toggle=box.querySelector('[data-help-toggle]');
    const setOpen=open=>{box.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));panel.setAttribute('aria-hidden',String(!open));if(open)initRating(box).catch(()=>{});};
    toggle.onclick=()=>setOpen(!box.classList.contains('is-open')); box.querySelector('[data-help-close]').onclick=()=>setOpen(false);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  }

  async function initRating(box){
    if(box.dataset.ratingLoaded==='1') return; box.dataset.ratingLoaded='1';
    const summaryEl=box.querySelector('[data-rating-summary]'), stars=[...box.querySelectorAll('[data-rating]')], save=box.querySelector('[data-rating-save]'), note=box.querySelector('[data-rating-note]'), msg=box.querySelector('[data-rating-message]'), signin=box.querySelector('[data-rating-signin]');
    if(!backend?.configured){summaryEl.textContent='Rating offline';stars.forEach(b=>b.disabled=true);note.disabled=true;return;}
    const db=await backend.ensureClient();
    async function refreshSummary(){
      const {data,error}=await db.rpc('site_rating_summary');
      if(error){summaryEl.textContent='Rating unavailable';return;}
      const row=Array.isArray(data)?data[0]:data; const count=Number(row?.rating_count||0), avg=Number(row?.average_rating||0);
      summaryEl.textContent=count?`${avg.toFixed(1)} / 5 · ${count} rating${count===1?'':'s'}`:'Be the first to rate';
    }
    await refreshSummary();
    const user=await getUser(); let selected=0;
    const paint=()=>stars.forEach(b=>b.classList.toggle('is-active',Number(b.dataset.rating)<=selected));
    if(!user){stars.forEach(b=>b.disabled=true);note.disabled=true;save.disabled=true;signin.hidden=false;msg.textContent='Community account required.';return;}
    const {data:own}=await db.from('site_ratings').select('rating,note').eq('user_id',user.id).maybeSingle();
    if(own){selected=Number(own.rating||0);note.value=own.note||'';paint();msg.textContent='You can change this anytime.';}
    stars.forEach(b=>b.addEventListener('click',()=>{selected=Number(b.dataset.rating);paint();save.disabled=false;msg.textContent=`${selected}/5 selected`; }));
    note.addEventListener('input',()=>{if(selected)save.disabled=false;});
    save.addEventListener('click',async()=>{
      if(!selected)return; save.disabled=true; save.textContent='Saving…'; msg.textContent='';
      const {error}=await db.from('site_ratings').upsert({user_id:user.id,rating:selected,note:note.value.trim().slice(0,800)},{onConflict:'user_id'});
      save.textContent='Save rating';
      if(error){msg.textContent=error.message;save.disabled=false;return;}
      msg.textContent='Thanks — rating saved.'; await refreshSummary();
    });
  }


  function addDevelopmentRibbon(){
    if(document.querySelector('[data-development-ribbon]')) return;
    const ribbon=document.createElement('div');
    ribbon.className='development-ribbon';
    ribbon.dataset.developmentRibbon='';
    ribbon.setAttribute('aria-hidden','true');
    ribbon.innerHTML='<span>UNDER DEVELOPMENT</span><b>V7.2 · PUBLIC BETA</b>';
    document.body.append(ribbon);
  }

  function mountBugReporter(){
    if(document.querySelector('[data-sa-bug]')) return;
    const box=document.createElement('aside');
    box.className='sa-bug';
    box.dataset.saBug='';
    box.innerHTML=`<div class="sa-bug__panel" data-bug-panel aria-hidden="true">
      <div class="sa-bug__head"><div><span>V7.2 / Bug reporter</span><h3>Found something broken?</h3></div><button class="sa-bug__close" type="button" aria-label="Close bug reporter" data-bug-close>×</button></div>
      <div class="sa-bug__meta"><span data-bug-page>THIS PAGE</span><span>AUTO DEVICE INFO</span></div>
      <form class="sa-bug__form" data-bug-form>
        <label>Short title<input name="title" maxlength="120" required placeholder="e.g. Gallery button overlaps photo"></label>
        <label>What happened?<textarea name="description" maxlength="2000" required placeholder="Tell us what you clicked, what you expected, and what happened instead."></textarea></label>
        <label>Reply email · optional<input name="reply_email" maxlength="180" type="email" placeholder="you@example.com"></label>
        <p class="sa-bug__hint">The current page and basic browser/device information are attached automatically. Please do not include passwords or private information.</p>
        <div class="sa-bug__message" data-bug-message></div>
        <button class="sa-bug__submit" type="submit">Send bug report ↗</button>
      </form>
    </div><button class="sa-bug__toggle" type="button" data-bug-toggle aria-expanded="false"><span>!</span><b>Report a bug</b></button>`;
    document.body.append(box);
    const panel=box.querySelector('[data-bug-panel]');
    const toggle=box.querySelector('[data-bug-toggle]');
    const form=box.querySelector('[data-bug-form]');
    const message=box.querySelector('[data-bug-message]');
    const pageName=(location.pathname.split('/').pop()||'Home').replace('.html','')||'Home';
    box.querySelector('[data-bug-page]').textContent=pageName.toUpperCase();
    const setOpen=async open=>{
      box.classList.toggle('is-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      panel.setAttribute('aria-hidden',String(!open));
      if(open && backend?.configured){
        const user=await getUser().catch(()=>null);
        const email=form.elements.reply_email;
        if(user?.email && !email.value) email.value=user.email;
      }
    };
    toggle.addEventListener('click',()=>setOpen(!box.classList.contains('is-open')));
    box.querySelector('[data-bug-close]').addEventListener('click',()=>setOpen(false));
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      message.className='sa-bug__message';
      message.textContent='';
      if(!backend?.configured){message.classList.add('is-error');message.textContent='Bug reporting is temporarily offline.';return;}
      const title=String(form.elements.title.value||'').trim();
      const description=String(form.elements.description.value||'').trim();
      const replyEmail=String(form.elements.reply_email.value||'').trim();
      if(title.length<4||description.length<10){message.classList.add('is-error');message.textContent='Add a short title and a little more detail.';return;}
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true; submit.textContent='Sending…';
      try{
        const db=await backend.ensureClient();
        const {error}=await db.from('bug_reports').insert({
          title:title.slice(0,120),
          description:description.slice(0,2000),
          reply_email:replyEmail?replyEmail.slice(0,180):null,
          page_url:location.href.slice(0,800),
          user_agent:String(navigator.userAgent||'').slice(0,800)
        });
        if(error) throw error;
        form.reset();
        message.classList.add('is-success');
        message.textContent='Sent. Thanks — it is now in the Scottish.aero bug queue.';
        setTimeout(()=>setOpen(false),1800);
      }catch(error){
        message.classList.add('is-error');
        message.textContent=error?.message||'Could not send the report.';
      }finally{
        submit.disabled=false; submit.textContent='Send bug report ↗';
      }
    });
  }

  ensureNavLinks(); addGlobalFX(); ensureFutureSocials(); mountHelp(); addDevelopmentRibbon(); mountBugReporter(); renderAccountChip().catch(()=>{});
  window.addEventListener('sa:auth-changed',()=>renderAccountChip().catch(()=>{}));
})();
