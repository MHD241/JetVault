(() => {
  const backend=window.ScottishAeroBackend;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function badge(n){return `FOUNDING 100 #${String(n).padStart(3,'0')}`;}
  function accountMarkup(d){
    if(!d) return '';
    if(d.founding_number) return `<span>${badge(d.founding_number)}</span><strong>Permanent founding status secured.</strong><p>You were one of the first 100 photographers to reach 20 approved Jetvault photographs.</p>`;
    const progress=Math.min(20,Number(d.founding_progress||d.approved_photos||0));
    return `<span>FOUNDING 100</span><strong>${progress} / 20 approved photographs</strong><p>Reach 20 approved photographs before all 100 numbered founding places are claimed.</p><a class="outline-button" href="#submit" data-jv-upload-jump>Upload a photograph</a>`;
  }
  function profileMarkup(d){
    if(!d) return '';
    if(d.founding_number) return `<span class="jv-found-badge">${badge(d.founding_number)}</span>`;
    const progress=Math.min(20,Number(d.founding_progress||d.approved_photos||0));
    return `<span class="jv-found-badge">FOUNDING 100 · ${progress}/20</span>`;
  }

  async function loadAccount(){
    const holder=$('[data-jv-founding-account]'); if(!holder||!backend?.configured)return;
    try{
      const db=await backend.ensureClient(); const {data:s}=await db.auth.getSession(); if(!s?.session?.user)return;
      const r=await db.rpc('aero_my_dashboard'); if(r.error) throw r.error;
      holder.innerHTML=accountMarkup(r.data); holder.hidden=false;
      holder.querySelector('[data-jv-upload-jump]')?.addEventListener('click',e=>{
        e.preventDefault(); document.querySelector('[data-account-tab="submit"]')?.click();
      });
    }catch(_){holder.hidden=true;}
  }

  async function loadProfile(){
    const holder=$('[data-jv-founding-profile]'); if(!holder||!backend?.configured)return;
    try{
      const key=new URLSearchParams(location.search).get('photographer'); if(!key)return;
      const person=await backend.getProfileByKey(key,{fresh:true}); if(!person?.accountId)return;
      const db=await backend.ensureClient(); const r=await db.rpc('aero_public_status',{p_user_id:person.accountId}); if(r.error)throw r.error;
      const d=Array.isArray(r.data)?r.data[0]:r.data; holder.innerHTML=profileMarkup(d); holder.hidden=false;
    }catch(_){holder.hidden=true;}
  }

  async function boot(){await Promise.all([loadAccount(),loadProfile()]);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('sa:auth-changed',()=>setTimeout(loadAccount,100));
  if(backend?.configured) backend.ensureClient().then(db=>db?.auth?.onAuthStateChange?.(()=>setTimeout(loadAccount,120))).catch(()=>{});
  setTimeout(loadAccount,900); setTimeout(loadProfile,900);
})();
