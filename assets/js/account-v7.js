(() => {
  const J=window.JetVault, UI=window.JVUI; if(!J)return;
  const guest=document.querySelector('[data-account-guest]'), dash=document.querySelector('[data-account-dashboard]');
  const msg=(t,k='')=>{const n=document.querySelector('[data-account-message]');if(n){n.textContent=t;n.className=`status ${k}`;n.hidden=!t}};
  async function boot(){
    const user=await J.currentUser(); if(!user){guest.hidden=false;dash.hidden=true;return}
    guest.hidden=true;dash.hidden=false; const p=await J.currentProfile();
    document.querySelector('[data-account-name]').textContent=p?.display_name||user.email;
    const f=document.querySelector('[data-profile-form]');
    if(f){f.display_name.value=p?.display_name||'';f.username.value=p?.username||'';f.bio.value=p?.bio||'';f.location.value=p?.location||'';f.favourite_airport.value=p?.favourite_airport||'';f.favourite_aircraft.value=p?.favourite_aircraft||''}
    await submissions(user.id);
  }
  async function submissions(uid){
    const db=await J.ensureClient();
    const {data}=await db.from('photos').select('id,image_url,thumbnail_url,registration,aircraft_type,airline,airport,status,created_at').eq('owner_id',uid).not('registration','in','("__SA_PROFILE__","__SA_POST__")').order('created_at',{ascending:false}).limit(40);
    const n=document.querySelector('[data-submissions]');
    n.innerHTML=(data||[]).length?(data||[]).map(x=>`<article class="info-card"><b>${x.registration}</b><span>${x.airline} · ${x.aircraft_type}</span><p>Status: <strong>${x.status}</strong></p></article>`).join(''):'<div class="empty">No submissions yet.</div>';
  }

  document.querySelector('[data-login-form]')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),db=await J.ensureClient();msg('Signing in…');const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return msg(error.message,'bad');location.reload()});
  document.querySelector('[data-signup-form]')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),db=await J.ensureClient();msg('Creating account…');const {data,error}=await db.auth.signUp({email:f.get('email'),password:f.get('password'),options:{data:{display_name:f.get('display_name')}}});if(error)return msg(error.message,'bad');msg(data.session?'Account created. Reloading…':'Check your email to confirm your account.','ok');if(data.session)setTimeout(()=>location.reload(),800)});
  document.querySelector('[data-signout]')?.addEventListener('click',async()=>{await J.signOut();location.reload()});
  document.querySelector('[data-profile-form]')?.addEventListener('submit',async e=>{e.preventDefault();const db=await J.ensureClient(),u=await J.currentUser(),f=new FormData(e.currentTarget);const payload={display_name:f.get('display_name'),username:String(f.get('username')||'').toLowerCase().replace(/[^a-z0-9_-]/g,''),bio:f.get('bio'),location:f.get('location'),favourite_airport:f.get('favourite_airport'),favourite_aircraft:f.get('favourite_aircraft'),updated_at:new Date().toISOString()};const {error}=await db.from('profiles').update(payload).eq('id',u.id);msg(error?error.message:'Profile saved.',error?'bad':'ok')});
  document.querySelector('[data-upload-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,db=await J.ensureClient(),u=await J.currentUser(),p=await J.currentProfile(),f=new FormData(form),file=f.get('image');
    try{
      msg('Optimising image and creating thumbnail…');const pair=await J.uploadPhotoPair(file,u.id,'submission');
      const status=p?.is_crew?'approved':'pending';
      const {error}=await db.from('photos').insert({owner_id:u.id,photographer_name:p?.display_name||u.email,image_url:pair.imageUrl,thumbnail_url:pair.thumbnailUrl,registration:f.get('registration')||'Unknown',aircraft_type:f.get('aircraft_type')||'Unknown',airline:f.get('airline')||'Unknown',airport:f.get('airport')||'Unknown',taken_at:f.get('taken_at')||null,caption:f.get('caption')||'',alt_text:`${f.get('airline')||'Aircraft'} ${f.get('aircraft_type')||''}`.trim(),ratio:pair.ratio,status});
      if(error)throw error;msg(status==='approved'?'Uploaded to the archive.':'Uploaded for moderation.','ok');form.reset();submissions(u.id);
    }catch(err){msg(err.message,'bad')}
  });
  boot().catch(e=>msg(e.message,'bad'));
})();
