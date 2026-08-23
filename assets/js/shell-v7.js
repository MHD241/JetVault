(() => {
  const backend = window.ScottishAeroBackend;
  const social = window.ScottishAeroSocial;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials = name => String(name||'SA').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

  function ensureNavLinks(){
    document.querySelectorAll('.site-nav').forEach(nav=>{
      if(!nav.querySelector('a[href="discover.html"]')) nav.insertAdjacentHTML('afterbegin','<a href="discover.html">Discover</a>');
      if(!nav.querySelector('a[href="account.html"]')) nav.insertAdjacentHTML('beforeend','<a href="account.html">Community</a>');
      const page=location.pathname.split('/').pop()||'index.html'; nav.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===page)a.setAttribute('aria-current','page');});
    });
  }

  function addGlobalFX(){
    if(document.querySelector('[data-v7-sky]')) return;
    const fx=document.createElement('div'); fx.className='v7-sky'; fx.dataset.v7Sky=''; fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<i></i><i></i><i></i><b></b>'; document.body.prepend(fx);
  }

  async function renderAccountChip(){
    const holder=document.querySelector('.header-action'); if(!holder||holder.querySelector('[data-community-chip]')) return;
    const wrap=document.createElement('div'); wrap.className='community-chip-wrap'; wrap.dataset.communityChip='';
    if(!backend?.configured||!social){wrap.innerHTML='<a class="community-chip" href="account.html"><span class="community-chip__dot"></span><b>Join</b></a>';holder.append(wrap);return;}
    const user=await social.getUser().catch(()=>null);
    if(!user){wrap.innerHTML='<a class="community-chip" href="account.html?mode=signup"><span class="community-chip__dot"></span><b>Join</b></a>';holder.append(wrap);return;}
    const db=await backend.ensureClient(); const {data:profile}=await db.from('profiles').select('display_name,username,avatar_url,is_crew,is_manager').eq('id',user.id).maybeSingle();
    if(!profile){wrap.innerHTML='<a class="community-chip" href="account.html"><b>Account</b></a>';holder.append(wrap);return;}
    const notifications=await social.getNotifications(20).catch(()=>[]); const unread=notifications.filter(n=>!n.read_at).length;
    wrap.innerHTML=`<button class="community-chip ${unread?'has-alert':''}" type="button" data-community-toggle><span class="community-chip__avatar">${profile.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="">`:esc(initials(profile.display_name))}</span><b>${esc((profile.display_name||'Account').split(' ')[0])}</b><em data-notification-badge>${unread||''}</em></button><div class="community-menu" data-community-menu hidden><div class="community-menu__head"><span>${profile.is_crew?'SCOTTISH.AERO CREW':'COMMUNITY'}</span><b>${esc(profile.display_name)}</b><small>@${esc(profile.username||'spotter')}</small></div><div class="community-menu__links"><a href="profile.html?photographer=${encodeURIComponent(profile.username||'')}">Your profile</a><a href="account.html">Account & submissions</a>${profile.is_crew?'<a href="admin.html">Creator Studio</a>':''}</div><div class="community-menu__notifications"><div class="community-menu__title"><b>Notifications</b><button type="button" data-mark-read>Mark read</button></div><div data-notification-list>${notifications.length?notifications.slice(0,8).map(n=>notificationMarkup(n)).join(''):'<p class="community-menu__empty">Nothing new yet.</p>'}</div></div><button class="community-menu__signout" type="button" data-community-signout>Sign out</button></div>`;
    holder.append(wrap);
    const btn=wrap.querySelector('[data-community-toggle]'),menu=wrap.querySelector('[data-community-menu]');
    btn.onclick=()=>{menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden));};
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.hidden=true;});
    wrap.querySelector('[data-mark-read]')?.addEventListener('click',async()=>{await social.markNotificationsRead();wrap.querySelector('[data-notification-badge]').textContent='';btn.classList.remove('has-alert');notifications.forEach(n=>n.read_at=n.read_at||new Date().toISOString());wrap.querySelector('[data-notification-list]').innerHTML=notifications.slice(0,8).map(notificationMarkup).join('');});
    wrap.querySelector('[data-community-signout]')?.addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
  }

  function notificationMarkup(n){
    const actor=n.actor?.display_name||'Scottish.aero'; const key=n.actor?.username||''; const href=n.content_id?`gallery.html?photo=${encodeURIComponent(n.content_id)}`:key?`profile.html?photographer=${encodeURIComponent(key)}`:'account.html';
    return `<a class="notification-mini ${n.read_at?'':'is-unread'}" href="${href}"><span>${n.actor?.avatar_url?`<img src="${esc(n.actor.avatar_url)}" alt="">`:esc(initials(actor))}</span><div><b>${esc(actor)}</b><p>${esc(n.message||n.type)}</p><time>${esc(backend?.formatDate?.(n.created_at)||'')}</time></div></a>`;
  }

  ensureNavLinks(); addGlobalFX(); renderAccountChip().catch(()=>{});
  window.addEventListener('sa:auth-changed',()=>{document.querySelector('[data-community-chip]')?.remove();renderAccountChip().catch(()=>{});});
})();
