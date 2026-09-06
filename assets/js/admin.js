(() => {
  const J=window.JetVault, UI=window.JVUI; if(!J)return;
  const root=document.querySelector('[data-admin-root]'); if(!root)return;
  const status=(t,k='')=>{const n=document.querySelector('[data-admin-status]');n.textContent=t;n.className=`status ${k}`};

  async function requireAccess(){
    const [u,p]=await Promise.all([J.currentUser(),J.currentProfile()]);
    if(!u||!p||( !p.is_manager && !p.is_crew)){root.innerHTML='<div class="panel"><h2>Manager access required</h2><p>Sign in with a JetVault crew account.</p><a class="solid-button" href="account.html">Sign in</a></div>';return null}
    document.querySelector('[data-manager-name]').textContent=p.display_name;
    return {u,p};
  }

  async function pending(){
    const db=await J.ensureClient();
    const {data,error}=await db.from('photos').select('id,owner_id,photographer_name,image_url,thumbnail_url,registration,aircraft_type,airline,airport,caption,created_at,status').eq('status','pending').order('created_at',{ascending:true}).limit(100);
    if(error)throw error;
    const n=document.querySelector('[data-pending-list]');
    n.innerHTML=(data||[]).length?(data||[]).map(x=>`<article class="admin-item" data-row="${x.id}"><img src="${x.thumbnail_url||x.image_url}" alt=""><div><b>${x.registration} · ${x.aircraft_type}</b><div>${x.airline} · ${x.airport}</div><small>${x.photographer_name}</small></div><div class="admin-actions"><button class="mini-button success" data-approve="${x.id}">Approve</button><button class="mini-button danger" data-reject="${x.id}">Reject</button></div></article>`).join(''):'<div class="empty">No pending photographs.</div>';
  }

  async function moderate(id,next){
    const db=await J.ensureClient(),u=await J.currentUser();
    const patch={status:next,moderation_note:next==='rejected'?'Rejected by JetVault moderation.':'',updated_at:new Date().toISOString()};
    if(next==='approved'){patch.approved_at=new Date().toISOString();patch.approved_by=u.id}
    const {error}=await db.from('photos').update(patch).eq('id',id);if(error)throw error;await pending()
  }

  document.querySelector('[data-pending-list]')?.addEventListener('click',async e=>{const a=e.target.closest('[data-approve]'),r=e.target.closest('[data-reject]');try{if(a)await moderate(a.dataset.approve,'approved');if(r)await moderate(r.dataset.reject,'rejected')}catch(err){status(err.message,'bad')}});

  document.querySelector('[data-admin-upload]')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,f=new FormData(form),db=await J.ensureClient(),u=await J.currentUser(),p=await J.currentProfile();
    try{
      status('Optimising full image + thumbnail…');const pair=await J.uploadPhotoPair(f.get('image'),u.id,'crew');
      const {error}=await db.from('photos').insert({owner_id:u.id,photographer_name:p.display_name,image_url:pair.imageUrl,thumbnail_url:pair.thumbnailUrl,registration:f.get('registration')||'Unknown',aircraft_type:f.get('aircraft_type')||'Unknown',airline:f.get('airline')||'Unknown',airport:f.get('airport')||'Unknown',taken_at:f.get('taken_at')||null,caption:f.get('caption')||'',alt_text:`${f.get('airline')||'Aircraft'} ${f.get('aircraft_type')||''}`.trim(),ratio:pair.ratio,status:'approved',approved_at:new Date().toISOString(),approved_by:u.id});
      if(error)throw error;status('Crew photograph published.','ok');form.reset()
    }catch(err){status(err.message,'bad')}
  });

  async function migration(){
    const db=await J.ensureClient(),u=await J.currentUser(),p=await J.currentProfile(); if(!p?.is_manager)return;
    const {data,error}=await db.from('photos').select('id,image_url,thumbnail_url,registration,status').eq('status','approved').not('registration','in','("__SA_PROFILE__","__SA_POST__")').limit(1000);
    if(error)throw error;
    const rows=(data||[]).filter(x=>!String(x.thumbnail_url||'').trim());
    const meter=document.querySelector('[data-migration-meter]'), copy=document.querySelector('[data-migration-copy]');
    if(copy)copy.textContent=rows.length?`${rows.length} legacy thumbnails remaining.`:'Archive thumbnails complete.';
    if(!rows.length)return;
    let done=0,failed=0;
    for(const row of rows){
      try{
        if(/^assets\/images\/photos\/arran-.*\.jpg$/i.test(row.image_url||'')){
          const candidate=row.image_url.replace(/\.jpg$/i,'.webp');
          const {error:e}=await db.from('photos').update({thumbnail_url:candidate}).eq('id',row.id); if(e)throw e;
        }else{
          const source=new URL(row.image_url,location.href).href;
          const res=await fetch(source,{cache:'force-cache'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
          const blob=await res.blob(),thumb=await J.makeThumbnailBlob(blob,960);
          const path=`${u.id}/migration/thumb-${row.id}.webp`;
          const up=await db.storage.from('photos').upload(path,thumb,{contentType:'image/webp',cacheControl:'31536000',upsert:true});if(up.error)throw up.error;
          const url=db.storage.from('photos').getPublicUrl(path).data.publicUrl;
          const save=await db.from('photos').update({thumbnail_url:url}).eq('id',row.id);if(save.error)throw save.error;
        }
        done++;
      }catch(err){failed++;console.warn('Thumbnail migration skipped',row.id,err)}
      if(meter)meter.style.width=`${Math.round(((done+failed)/rows.length)*100)}%`;
      if(copy)copy.textContent=`Migrating legacy archive: ${done} done · ${failed} skipped · ${rows.length-done-failed} remaining`;
      await new Promise(r=>setTimeout(r,90));
    }
    if(copy)copy.textContent=`Migration pass complete: ${done} thumbnails created · ${failed} skipped. Reload Manager Studio to retry skipped images.`;
  }

  async function boot(){
    const access=await requireAccess();if(!access)return;
    await pending();status('Manager Studio ready.','ok');
    setTimeout(()=>migration().catch(e=>console.warn(e)),900);
    document.querySelector('[data-run-migration]')?.addEventListener('click',()=>migration().catch(e=>status(e.message,'bad')));
  }
  boot().catch(e=>status(e.message,'bad'));
})();
