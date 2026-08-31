(() => {
  if (window.__JETVAULT_MANAGER_V11__) return;
  window.__JETVAULT_MANAGER_V11__ = true;

  const backend=window.ScottishAeroBackend;
  if(!backend) return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('en-GB');
  const date=v=>{if(!v)return'Never';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  let db,user,profile,tab,panel,accounts=[],photos=[],activeSection='accounts';

  function rebrandStudio(){
    document.title='Jetvault Manager Studio';
    const brand=document.querySelector('.admin-topbar a.brand');
    if(brand){brand.setAttribute('aria-label','Jetvault home');brand.innerHTML='<img class="jv-wordmark" src="assets/images/ui/jetvault-wordmark.png" alt="Jetvault" style="width:150px;height:auto"><span style="color:var(--muted);font-size:.68rem;letter-spacing:.08em">/ STUDIO</span>';}
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;return /scottish\.aero/i.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>n.nodeValue=(n.nodeValue||'').replace(/Scottish\.aero/gi,'Jetvault').replace(/SCOTTISH\.AERO/g,'JETVAULT'));
    let icon=document.querySelector('link[rel="icon"]');if(icon){icon.href='assets/images/ui/jetvault-icon.png';icon.type='image/png';}
  }

  async function invoke(action,payload={}){
    const {data,error}=await db.functions.invoke('jetvault-manager',{body:{action,...payload}});
    if(error){
      let message=error.message||'Manager action failed';
      try{const body=await error.context?.json?.();if(body?.error)message=body.error;}catch(_){}
      throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    return data||{};
  }

  function message(text='',error=false){
    const n=panel?.querySelector('[data-manager-message]');if(!n)return;n.textContent=text;n.classList.toggle('is-error',Boolean(error));
  }

  async function boot(){
    rebrandStudio();
    db=await backend.ensureClient();if(!db)return;
    const s=await db.auth.getSession();if(s.data?.session?.user)await maybeMount(s.data.session.user);
    db.auth.onAuthStateChange((_e,session)=>{if(session?.user)maybeMount(session.user).catch(()=>{});});
  }

  async function maybeMount(u){
    user=u;
    const r=await db.from('profiles').select('*').eq('id',u.id).maybeSingle();profile=r.data;
    rebrandStudio();
    if(!profile?.is_manager)return;
    if(!tab)inject();
    await Promise.all([loadAccounts(),loadPhotos(),loadAudit()]);
  }

  function inject(){
    const tabs=document.querySelector('.studio-tabs');const main=document.querySelector('[data-admin-app]');if(!tabs||!main)return;
    tab=document.createElement('button');tab.type='button';tab.dataset.studioTab='manager-control';tab.textContent='Manager Control';tabs.append(tab);
    panel=document.createElement('section');panel.className='studio-panel jv-manager-panel';panel.dataset.studioPanel='manager-control';panel.hidden=true;
    panel.innerHTML=`
      <div class="jv-manager-hero">
        <span class="eyebrow">Jetvault / owner controls</span>
        <h2>Manager Control.</h2>
        <p>Run the community from one place: accounts, password help, bans, crew access, photo metadata through Archive, and displayed view counts. Service-role credentials stay server-side in Supabase.</p>
        <span class="jv-manager-lock">SECURE SERVER-SIDE CONTROLS</span>
      </div>
      <div class="jv-manager-nav">
        <button class="is-active" type="button" data-manager-section="accounts">Accounts</button>
        <button type="button" data-manager-section="views">Photo views</button>
        <button type="button" data-manager-section="audit">Audit log</button>
      </div>
      <div class="jv-manager-message" data-manager-message></div>
      <section class="jv-manager-subpanel" data-manager-subpanel="accounts">
        <div class="jv-manager-toolbar"><input class="control" type="search" placeholder="Search username, display name or email…" data-manager-account-search><span class="jv-manager-toolbar__meta" data-account-total></span></div>
        <div class="jv-account-list" data-manager-account-list><div class="jv-manager-loading">Loading accounts…</div></div>
      </section>
      <section class="jv-manager-subpanel" data-manager-subpanel="views" hidden>
        <div class="jv-manager-toolbar"><input class="control" type="search" placeholder="Search registration, aircraft, airline or photographer…" data-manager-photo-search><span class="jv-manager-toolbar__meta">Organic views are never deleted. The control changes only the promotional portion.</span></div>
        <div class="jv-view-list" data-manager-view-list><div class="jv-manager-loading">Loading photographs…</div></div>
      </section>
      <section class="jv-manager-subpanel" data-manager-subpanel="audit" hidden>
        <div class="jv-manager-toolbar"><button class="mini-button" type="button" data-manager-audit-refresh>Refresh log</button><span class="jv-manager-toolbar__meta">Last 100 manager operations</span></div>
        <div class="jv-audit-list" data-manager-audit-list><div class="jv-manager-loading">Loading audit log…</div></div>
      </section>`;
    main.append(panel);
    tab.addEventListener('click',show);
    panel.querySelectorAll('[data-manager-section]').forEach(b=>b.addEventListener('click',()=>setSection(b.dataset.managerSection)));
    panel.querySelector('[data-manager-account-search]').addEventListener('input',renderAccounts);
    panel.querySelector('[data-manager-photo-search]').addEventListener('input',renderPhotos);
    panel.querySelector('[data-manager-audit-refresh]').addEventListener('click',loadAudit);
    injectProfileDialog();
  }

  function show(){
    document.querySelectorAll('[data-studio-tab]').forEach(b=>b.classList.toggle('is-active',b===tab));
    document.querySelectorAll('[data-studio-panel]').forEach(p=>p.hidden=p!==panel);
    window.scrollTo({top:0,behavior:'smooth'});
    setSection(activeSection);
  }

  function setSection(name){activeSection=name||'accounts';panel.querySelectorAll('[data-manager-section]').forEach(b=>b.classList.toggle('is-active',b.dataset.managerSection===activeSection));panel.querySelectorAll('[data-manager-subpanel]').forEach(p=>p.hidden=p.dataset.managerSubpanel!==activeSection);}

  async function loadAccounts(){
    if(!panel)return;message('Loading accounts…');
    try{const r=await invoke('list_accounts');accounts=r.users||[];renderAccounts();message('');}catch(e){message(e.message,true);}
  }

  function accountName(a){return a.profile?.display_name||a.profile?.username||a.email||'Account';}
  function renderAccounts(){
    if(!panel)return;const holder=panel.querySelector('[data-manager-account-list]');const q=(panel.querySelector('[data-manager-account-search]').value||'').trim().toLowerCase();
    const list=accounts.filter(a=>[a.email,a.profile?.username,a.profile?.display_name].join(' ').toLowerCase().includes(q));
    panel.querySelector('[data-account-total]').textContent=`${list.length} shown · ${accounts.length} total`;
    holder.innerHTML=list.length?list.map(a=>{
      const p=a.profile||{};const banned=Boolean(a.banned_until&&new Date(a.banned_until)>new Date());const self=a.id===user.id;
      return `<article class="jv-account-card" data-account-id="${esc(a.id)}"><div class="jv-account-main"><div class="jv-account-top"><h3>${esc(accountName(a))}</h3>${p.username?`<code>@${esc(p.username)}</code>`:''}</div><div class="jv-account-badges">${p.is_manager?'<span class="jv-manager-badge jv-manager-badge--manager">MANAGER</span>':''}${p.is_crew?'<span class="jv-manager-badge jv-manager-badge--crew">CREW</span>':''}${banned?'<span class="jv-manager-badge jv-manager-badge--banned">BANNED</span>':''}${!a.email_confirmed_at?'<span class="jv-manager-badge">EMAIL UNCONFIRMED</span>':''}</div><div class="jv-account-meta"><span>${esc(a.email||'No email')}</span><span>${fmt(a.photo_count)} photo${Number(a.photo_count)===1?'':'s'}</span><span>Joined ${esc(date(a.created_at))}</span><span>Last sign-in ${esc(date(a.last_sign_in_at))}</span></div></div><div class="jv-account-actions"><button class="mini-button" type="button" data-account-edit="${esc(a.id)}" ${!p.id?'disabled':''}>Edit profile</button><button class="mini-button" type="button" data-account-crew="${esc(a.id)}" ${self?'disabled':''}>${p.is_crew?'Remove crew':'Make crew'}</button><button class="mini-button" type="button" data-account-reset="${esc(a.id)}">Reset password</button><button class="mini-button ${banned?'jv-manager-success':'jv-manager-danger'}" type="button" data-account-ban="${esc(a.id)}" ${self?'disabled':''}>${banned?'Unban':'Ban'}</button><button class="mini-button jv-manager-danger" type="button" data-account-delete="${esc(a.id)}" ${self?'disabled':''}>Delete account</button></div></article>`;
    }).join(''):'<div class="jv-manager-loading">No accounts match this search.</div>';
    bindAccountActions();
  }

  function findAccount(id){return accounts.find(a=>String(a.id)===String(id));}
  function bindAccountActions(){
    panel.querySelectorAll('[data-account-edit]').forEach(b=>b.onclick=()=>openProfileDialog(findAccount(b.dataset.accountEdit)));
    panel.querySelectorAll('[data-account-crew]').forEach(b=>b.onclick=()=>toggleCrew(findAccount(b.dataset.accountCrew),b));
    panel.querySelectorAll('[data-account-reset]').forEach(b=>b.onclick=()=>resetPassword(findAccount(b.dataset.accountReset),b));
    panel.querySelectorAll('[data-account-ban]').forEach(b=>b.onclick=()=>toggleBan(findAccount(b.dataset.accountBan),b));
    panel.querySelectorAll('[data-account-delete]').forEach(b=>b.onclick=()=>deleteAccount(findAccount(b.dataset.accountDelete),b));
  }

  async function toggleCrew(a,button){if(!a)return;button.disabled=true;try{await invoke('set_crew',{user_id:a.id,is_crew:!a.profile?.is_crew});message(`${accountName(a)} crew access updated.`);await loadAccounts();await loadAudit();}catch(e){message(e.message,true);}finally{button.disabled=false;}}
  async function resetPassword(a,button){if(!a)return;if(!confirm(`Send a password-reset email to ${a.email}?`))return;button.disabled=true;try{await invoke('send_password_reset',{user_id:a.id});message(`Password-reset email sent to ${a.email}.`);await loadAudit();}catch(e){message(e.message,true);}finally{button.disabled=false;}}
  async function toggleBan(a,button){if(!a)return;const banned=Boolean(a.banned_until&&new Date(a.banned_until)>new Date());let reason='';if(!banned){reason=prompt(`Reason for banning ${accountName(a)}:`,'Community moderation')||'';if(!reason.trim())return;}else if(!confirm(`Unban ${accountName(a)}?`))return;button.disabled=true;try{await invoke('ban_user',{user_id:a.id,banned:!banned,reason});message(`${accountName(a)} ${banned?'unbanned':'banned'}.`);await loadAccounts();await loadAudit();}catch(e){message(e.message,true);}finally{button.disabled=false;}}
  async function deleteAccount(a,button){if(!a)return;const required=a.profile?.username||a.email;const typed=prompt(`Permanent account deletion.\n\nThis removes login access and the public profile. Existing credited photographs remain in the archive.\n\nType exactly: ${required}`,'');if(typed!==required)return;button.disabled=true;try{await invoke('delete_user',{user_id:a.id});message(`${accountName(a)} was deleted.`);await Promise.all([loadAccounts(),loadAudit()]);}catch(e){message(e.message,true);}finally{button.disabled=false;}}

  function injectProfileDialog(){
    if(document.querySelector('[data-jv-profile-dialog]'))return;const d=document.createElement('dialog');d.className='jv-profile-dialog';d.dataset.jvProfileDialog='';d.innerHTML=`<div class="jv-profile-dialog__head"><h2>Edit member profile</h2><button class="mini-button" type="button" data-profile-close>Close</button></div><div class="jv-profile-dialog__body"><form data-manager-profile-form><input type="hidden" name="user_id"><div class="jv-profile-dialog__grid"><div class="field"><label>Display name</label><input class="control" name="display_name" maxlength="60"></div><div class="field"><label>Username</label><input class="control" name="username" maxlength="60"></div><div class="field field--wide"><label>Bio</label><textarea class="control" name="bio" maxlength="500"></textarea></div><div class="field"><label>Location</label><input class="control" name="location" maxlength="80"></div><div class="field"><label>Favourite airport</label><input class="control" name="favourite_airport" maxlength="80"></div><div class="field field--wide"><label>Favourite aircraft</label><input class="control" name="favourite_aircraft" maxlength="80"></div></div><div class="jv-profile-dialog__actions"><button class="outline-button" type="button" data-profile-close>Cancel</button><button class="solid-button" type="submit">Save member profile</button></div></form></div>`;document.body.append(d);d.querySelectorAll('[data-profile-close]').forEach(b=>b.onclick=()=>d.close());d.querySelector('form').onsubmit=saveProfile;
  }
  function openProfileDialog(a){if(!a?.profile)return;const d=document.querySelector('[data-jv-profile-dialog]');const f=d.querySelector('form');for(const key of ['user_id','display_name','username','bio','location','favourite_airport','favourite_aircraft'])f.elements[key].value=key==='user_id'?a.id:(a.profile[key]||'');d.showModal();}
  async function saveProfile(e){e.preventDefault();const f=e.currentTarget;const button=f.querySelector('button[type="submit"]');button.disabled=true;const payload={};for(const key of ['user_id','display_name','username','bio','location','favourite_airport','favourite_aircraft'])payload[key]=f.elements[key].value;try{await invoke('update_profile',payload);document.querySelector('[data-jv-profile-dialog]').close();message('Member profile updated.');backend.invalidateContent?.();await Promise.all([loadAccounts(),loadAudit()]);}catch(err){message(err.message,true);}finally{button.disabled=false;}}

  async function loadPhotos(){
    if(!panel)return;try{const r=await invoke('list_photos');photos=r.photos||[];renderPhotos();}catch(e){message(e.message,true);}
  }
  function renderPhotos(){
    if(!panel)return;const holder=panel.querySelector('[data-manager-view-list]');const q=(panel.querySelector('[data-manager-photo-search]').value||'').trim().toLowerCase();const list=photos.filter(p=>[p.registration,p.aircraft_type,p.airline,p.airport,p.photographer_name].join(' ').toLowerCase().includes(q));
    holder.innerHTML=list.length?list.map(p=>{const c=p.view_counts||{};return `<article class="jv-view-card" data-view-photo="${esc(p.id)}"><img src="${esc(p.image_url||'')}" alt=""><div><h3>${esc(p.registration||'Unknown')} · ${esc(p.aircraft_type||'Unknown')}</h3><p>${esc(p.airline||'Unknown')} · ${esc(p.airport||'Unknown')} · ${esc(p.photographer_name||'')}</p><div class="jv-view-numbers"><span>Displayed <b>${fmt(c.views)}</b></span><span>Organic <b>${fmt(c.organic_views)}</b></span><span>Promotional <b>${fmt(c.promotional_views)}</b></span></div></div><div class="jv-view-control"><input type="number" min="0" max="1000000" step="1" value="${Number(c.views||0)}" data-view-input><button class="mini-button" type="button" data-set-views="${esc(p.id)}">Apply</button><small>Sets displayed total; organic views are preserved.</small></div></article>`;}).join(''):'<div class="jv-manager-loading">No photographs match this search.</div>';
    holder.querySelectorAll('[data-set-views]').forEach(b=>b.onclick=()=>setViews(b.dataset.setViews,b));
  }
  async function setViews(id,button){const card=button.closest('[data-view-photo]');const input=card.querySelector('[data-view-input]');const total=Math.max(0,Math.floor(Number(input.value||0)));button.disabled=true;button.textContent='Saving…';try{const r=await invoke('set_displayed_views',{photo_id:id,total_views:total});message(`View count updated to ${fmt(r.views)}.`);const p=photos.find(x=>x.id===id);if(p)p.view_counts={views:r.views,organic_views:r.organic_views,promotional_views:r.promotional_views};renderPhotos();await loadAudit();}catch(e){message(e.message,true);}finally{button.disabled=false;button.textContent='Apply';}}

  async function loadAudit(){if(!panel)return;const holder=panel.querySelector('[data-manager-audit-list]');try{const r=await invoke('audit_log');const rows=r.rows||[];holder.innerHTML=rows.length?rows.map(x=>`<article class="jv-audit-row"><b>${esc(String(x.action||'').replaceAll('_',' '))}</b><span>${esc(JSON.stringify(x.detail||{}))}</span><time>${esc(date(x.created_at))}</time></article>`).join(''):'<div class="jv-manager-loading">No manager actions logged yet.</div>';}catch(e){holder.innerHTML=`<div class="jv-manager-loading">${esc(e.message)}</div>`;}}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
