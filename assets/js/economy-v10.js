(() => {
  const J=window.JetVault;if(!J)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function boot(){
    const host=document.querySelector('[data-economy]');if(!host)return;
    const db=await J.ensureClient(),u=await J.currentUser();
    if(!u){host.innerHTML='<div class="panel"><span class="eyebrow">AeroCoins</span><h2>Sign in to open your wallet.</h2><p>AeroCoins reward consistent approved photography and referrals.</p><a class="solid-button" href="account.html">Sign in</a></div>';return}
    const {data,error}=await db.rpc('aero_my_dashboard');if(error){host.innerHTML='<div class="empty">Wallet temporarily unavailable.</div>';return}
    const d=data||{},link=new URL('index.html',location.href);link.searchParams.set('ref',d.referral_code||'');
    const ledger=await db.from('aerocoin_ledger').select('amount,reason,created_at').eq('user_id',u.id).order('created_at',{ascending:false}).limit(20);
    host.innerHTML=`<div class="cards"><article class="info-card"><span>Balance</span><b>${Number(d.balance||0).toLocaleString()} AC</b><p>${Number(d.lifetime_earned||0).toLocaleString()} earned all-time</p></article><article class="info-card"><span>Flightline streak</span><b>🔥 ${d.current_streak||0} days</b><p>Best ${d.best_streak||0} days</p></article><article class="info-card"><span>Founding 100</span><b>${d.founding_number?`#${String(d.founding_number).padStart(3,'0')}`:`${d.founding_progress||0}/20`}</b><p>${d.approved_photos||0} approved photographs</p></article></div>
      <div class="panel" style="margin-top:16px"><span class="eyebrow">Referral flight</span><h3>${esc(d.referral_code||'')}</h3><p>Invite a real photographer. When they reach the qualifying milestone, both accounts receive AeroCoins.</p><button class="solid-button" data-share-ref>Share referral</button><input value="${esc(link.href)}" readonly></div>
      <div class="panel" style="margin-top:16px"><h3>Transaction history</h3>${(ledger.data||[]).map(x=>`<div class="detail-row"><span>${esc(x.reason)}</span><b>${x.amount>0?'+':''}${x.amount} AC</b></div>`).join('')||'<div class="status">No transactions yet.</div>'}</div>`;
    host.querySelector('[data-share-ref]').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'Join JetVault',text:'Join me on JetVault, the aviation photography archive.',url:link.href});else{await navigator.clipboard.writeText(link.href);window.JVUI.toast('Referral link copied')}}catch(_){}};
  }
  boot().catch(console.warn);
})();
