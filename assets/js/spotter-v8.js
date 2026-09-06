(() => {
  const J=window.JetVault;if(!J)return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const levels=[[0,'Ramp Newbie'],[100,'Spotter'],[250,'Spotter'],[450,'AvGeek'],[700,'AvGeek'],[1000,'Flightline Regular'],[1900,'Flightline Regular'],[3200,'Ramp Rat'],[5000,'Ramp Rat'],[7600,'Aviation Specialist'],[11000,'Aviation Specialist'],[15300,'Elite Spotter'],[21000,'JetVault Legend']];
  function level(xp){let i=0;levels.forEach((x,n)=>{if(xp>=x[0])i=n});const cur=levels[i],next=levels[i+1];return {number:i+1,title:cur[1],next:next?.[0]||cur[0],pct:next?Math.min(100,((xp-cur[0])/(next[0]-cur[0]))*100):100}}
  async function boot(){
    if(!document.querySelector('[data-spotter-page]'))return;
    const db=await J.ensureClient(),u=await J.currentUser();
    const challenge=await db.rpc('today_spotter_challenges').catch(()=>({data:[]}));
    const missions=document.querySelector('[data-missions]');
    let completed=[];
    if(u&&challenge.data?.[0]?.challenge_date){const r=await db.from('challenge_completions').select('challenge_id').eq('user_id',u.id).eq('challenge_date',challenge.data[0].challenge_date);completed=r.data||[]}
    const ids=new Set(completed.map(x=>x.challenge_id));
    if(missions)missions.innerHTML=(challenge.data||[]).map(c=>`<article class="mission ${ids.has(c.id)?'is-complete':''}"><span class="eyebrow">${esc(c.difficulty)}</span><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><em>${ids.has(c.id)?'Complete ✓':`+${c.xp_reward} XP`}</em></article>`).join('')||'<div class="empty">No missions available today.</div>';
    const card=document.querySelector('[data-progress]');
    if(card){
      if(!u){card.innerHTML='<h2>Spotter Passport</h2><p>Sign in to track XP, streaks and achievements.</p><a class="solid-button" href="account.html">Sign in</a>'}
      else{
        const [p,a]=await Promise.all([db.from('spotter_progress').select('*').eq('user_id',u.id).maybeSingle(),db.from('user_achievements').select('*').eq('user_id',u.id).order('unlocked_at',{ascending:false})]);
        const prog=p.data||{xp:0,current_streak:0,best_streak:0},l=level(Number(prog.xp||0));
        card.innerHTML=`<span class="eyebrow">Spotter Passport</span><h2>LVL ${l.number} · ${esc(l.title)}</h2><p>${Number(prog.xp||0).toLocaleString()} XP · 🔥 ${prog.current_streak||0} day streak</p><div class="progress"><i style="width:${l.pct}%"></i></div><p>${l.pct<100?`${Math.max(0,l.next-prog.xp)} XP to next rank`:'Maximum rank reached'}</p><div class="cards">${(a.data||[]).slice(0,6).map(x=>`<div class="info-card"><span>${esc(x.code)}</span><b>${esc(x.title)}</b><p>${esc(x.description)}</p></div>`).join('')||'<div class="info-card"><b>No achievements yet</b><p>Build your archive and complete missions.</p></div>'}</div>`;
      }
    }
  }
  boot().catch(console.warn);
})();
