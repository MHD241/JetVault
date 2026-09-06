(() => {
  if (window.__SCOTTISH_AERO_SPOTTER_V8__) return;
  window.__SCOTTISH_AERO_SPOTTER_V8__ = true;

  const backend = window.ScottishAeroBackend;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const LEVELS = [
    [0,'RAMP NEWBIE'],[100,'RAMP NEWBIE'],[250,'SPOTTER'],[450,'SPOTTER'],[700,'AVGEEK'],
    [1000,'AVGEEK'],[1400,'AVGEEK'],[1900,'FLIGHTLINE REGULAR'],[2500,'FLIGHTLINE REGULAR'],
    [3200,'FLIGHTLINE REGULAR'],[4000,'RAMP RAT'],[5000,'RAMP RAT'],[6200,'RAMP RAT'],
    [7600,'AVIATION SPECIALIST'],[9200,'AVIATION SPECIALIST'],[11000,'AVIATION SPECIALIST'],
    [13000,'ELITE SPOTTER'],[15300,'ELITE SPOTTER'],[17900,'ELITE SPOTTER'],[21000,'SCOTTISH.AERO LEGEND']
  ];

  function levelFor(xp) {
    xp = Math.max(0, Number(xp || 0));
    let level = 1;
    for (let i=0;i<LEVELS.length;i++) if (xp >= LEVELS[i][0]) level = i+1;
    const current = LEVELS[level-1] || LEVELS[0];
    const next = LEVELS[level] || null;
    const start = current[0], end = next ? next[0] : start;
    const pct = next ? Math.max(0,Math.min(100,((xp-start)/(end-start))*100)) : 100;
    return { level, title: current[1], xp, start, next:end, pct, max:!next };
  }

  function tierFor(level) {
    if(level>=20) return 'legend';
    if(level>=16) return 'elite';
    if(level>=12) return 'pulse';
    if(level>=8) return 'night';
    if(level>=5) return 'bronze';
    return 'base';
  }

  function rewardFor(level) {
    if(level>=20) return 'Legend profile treatment';
    if(level>=16) return 'Elite profile frame';
    if(level>=12) return 'Animated profile pulse';
    if(level>=8) return 'Night Flight profile treatment';
    if(level>=5) return 'Bronze flightline frame';
    if(level>=3) return 'Spotter callsign';
    return 'Keep flying missions';
  }

  function fmt(n){ return Number(n||0).toLocaleString(); }

  async function dbReady(){
    if(!backend?.configured) return null;
    return backend.ensureClient().catch(()=>null);
  }

  async function session(db){
    const {data} = await db.auth.getSession();
    return data?.session?.user || null;
  }

  async function progress(db,userId){
    if(!userId) return {user_id:null,xp:0,current_streak:0,best_streak:0,last_completion_date:null};
    const {data} = await db.from('spotter_progress').select('*').eq('user_id',userId).maybeSingle();
    return data || {user_id:userId,xp:0,current_streak:0,best_streak:0,last_completion_date:null};
  }

  async function achievements(db,userId){
    if(!userId) return [];
    const {data} = await db.from('user_achievements').select('code,title,description,unlocked_at').eq('user_id',userId).order('unlocked_at',{ascending:false});
    return data || [];
  }

  async function today(db){
    const {data,error} = await db.rpc('today_spotter_challenges');
    if(error) throw error;
    return (data || []).sort((a,b)=>a.slot-b.slot);
  }

  async function completions(db,userId,date){
    if(!userId || !date) return [];
    const {data} = await db.from('challenge_completions').select('challenge_id,challenge_date,xp_awarded,completed_at').eq('user_id',userId).eq('challenge_date',date);
    return data || [];
  }

  function missionMarkup(c, done=false, compact=false){
    const cls = `is-${esc(c.difficulty)} ${done?'is-complete':''}`;
    return `<article class="${compact?'v8-mission-card':'mission-card'} ${cls}">
      <div class="${compact?'v8-mission-card__top':'mission-card__top'}"><span>${String(c.slot).padStart(2,'0')} / ${esc(c.difficulty).toUpperCase()}</span><em>${done?'COMPLETE ✓':`+${c.xp_reward} XP`}</em></div>
      <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
      ${compact?'':`<div class="mission-card__foot"><span>${done?'XP AWARDED AFTER APPROVAL':'APPROVAL REQUIRED'}</span><a href="account.html">Submit frame ↗</a></div>`}
    </article>`;
  }

  async function mountHome(db,user,challenges){
    const holder=document.querySelector('[data-v8-home-missions]');
    if(!holder) return;
    const date=challenges[0]?.challenge_date;
    const done = user ? await completions(db,user.id,date) : [];
    const ids=new Set(done.map(x=>x.challenge_id));
    holder.innerHTML=challenges.map(c=>missionMarkup(c,ids.has(c.id),true)).join('');
    const foot=document.querySelector('[data-v8-home-progress]');
    if(foot && user){
      const p=await progress(db,user.id), l=levelFor(p.xp);
      foot.innerHTML=`<span><b>LVL ${l.level}</b> · ${esc(l.title)} · ${fmt(p.xp)} XP · 🔥 ${p.current_streak||0} day streak</span><a href="missions.html">Open your Mission Control ↗</a>`;
    }
  }

  function profileCardMarkup(p){
    const l=levelFor(p.xp);
    return `<span>YOUR FLIGHTLINE</span>
      <div class="mission-level-row"><b>LVL ${l.level}</b><em>${esc(l.title)}</em></div>
      <h2>${fmt(p.xp)} XP</h2>
      <div class="mission-xp-track"><i style="width:${l.pct}%"></i></div>
      <div class="mission-profile-card__stats"><span>🔥 <b>${p.current_streak||0}</b> current streak</span><span>BEST <b>${p.best_streak||0}</b> days</span></div>
      <small>${l.max?'Maximum V8 rank reached':`${fmt(l.next-p.xp)} XP to LVL ${l.level+1}`}</small>
      <a class="outline-button" href="profile.html">Open profile ↗</a>`;
  }

  async function mountMissions(db,user,challenges){
    const holder=document.querySelector('[data-daily-missions]');
    if(!holder) return;
    const date=challenges[0]?.challenge_date;
    const dateNode=document.querySelector('[data-mission-date]');
    if(dateNode && date) dateNode.textContent=new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    let done=[];
    if(user) done=await completions(db,user.id,date);
    const ids=new Set(done.map(x=>x.challenge_id));
    holder.innerHTML=challenges.map(c=>missionMarkup(c,ids.has(c.id))).join('');

    const clear=document.querySelector('[data-daily-clear]');
    if(clear){
      const all=challenges.length===3 && challenges.every(c=>ids.has(c.id));
      clear.classList.toggle('is-complete',all);
      if(all) clear.innerHTML='<span>DAILY CLEAR ✓</span><b>All three missions complete</b><em>+100 XP AWARDED</em>';
    }

    const profile=document.querySelector('[data-mission-profile]');
    if(profile && user){
      const p=await progress(db,user.id);
      profile.innerHTML=profileCardMarkup(p);
    }

    const ledger=document.querySelector('[data-xp-ledger]');
    if(ledger){
      if(!user){
        ledger.innerHTML='<div class="xp-ledger-empty"><b>Sign in to open your XP ledger.</b><a href="account.html?mode=login">Sign in ↗</a></div>';
      } else {
        const {data}=await db.from('xp_ledger').select('amount,reason,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(12);
        const rows=data||[];
        ledger.innerHTML=rows.length?rows.map(x=>`<article><span>+${x.amount} XP</span><b>${esc(x.reason)}</b><time>${new Date(x.created_at).toLocaleDateString()}</time></article>`).join(''):'<div class="xp-ledger-empty"><b>No XP yet.</b><span>Complete a mission and get the photograph approved.</span></div>';
      }
    }
  }

  function mountRoadmap(userProgress){
    const holder=document.querySelector('[data-level-roadmap]');
    if(!holder) return;
    const current=levelFor(userProgress?.xp||0).level;
    const milestones=[
      [1,'Ramp Newbie','Mission Control activated'],
      [3,'Spotter','Spotter callsign'],
      [5,'Flightline frame','Bronze profile treatment'],
      [8,'Night Flight','Dark illuminated profile treatment'],
      [12,'Pulse','Animated progression ring'],
      [16,'Elite Spotter','Elite flightline frame'],
      [20,'Legend','Scottish.aero Legend treatment']
    ];
    holder.innerHTML=milestones.map(([lvl,title,reward])=>`<article class="${current>=lvl?'is-unlocked':''}"><span>LVL ${lvl}</span><b>${esc(title)}</b><p>${esc(reward)}</p><em>${current>=lvl?'UNLOCKED ✓':'LOCKED'}</em></article>`).join('');
  }

  function achievementMarkup(list){
    if(!list.length) return '<div class="v8-empty"><b>No achievements unlocked yet.</b><span>Your approved archive will unlock them automatically.</span></div>';
    return `<div class="v8-achievement-grid">${list.map(a=>`<article><span>${esc(a.code.replaceAll('_',' '))}</span><b>${esc(a.title)}</b><p>${esc(a.description)}</p></article>`).join('')}</div>`;
  }

  async function mountAccount(db,user){
    if(!document.querySelector('[data-account-xp-banner]') || !user) return;
    const [p,a]=await Promise.all([progress(db,user.id),achievements(db,user.id)]);
    const l=levelFor(p.xp);
    const lvl=document.querySelector('[data-account-level]'), copy=document.querySelector('[data-account-xp-copy]'),
          bar=document.querySelector('[data-account-xp-bar]'), streak=document.querySelector('[data-account-streak]');
    if(lvl) lvl.textContent=`LVL ${l.level} · ${l.title}`;
    if(copy) copy.textContent=l.max?`${fmt(p.xp)} XP · LEGEND RANK`:`${fmt(p.xp)} XP · ${fmt(l.next-p.xp)} to next level`;
    if(bar) bar.style.width=`${l.pct}%`;
    if(streak) streak.textContent=`🔥 ${p.current_streak||0} DAY STREAK`;

    const panel=document.querySelector('[data-account-progress-panel] .admin-panel__body');
    if(panel) panel.innerHTML=`<div class="account-progress-big"><span>LVL ${l.level}</span><strong>${esc(l.title)}</strong><b>${fmt(p.xp)} XP</b><div class="mission-xp-track"><i style="width:${l.pct}%"></i></div><p>Current unlock: ${esc(rewardFor(l.level))}</p><div><span>Current streak <b>${p.current_streak||0}</b></span><span>Best streak <b>${p.best_streak||0}</b></span></div></div>`;
    const ach=document.querySelector('[data-account-achievements]');
    if(ach) ach.innerHTML=achievementMarkup(a);
  }

  async function mountPublicProfile(db){
    const holder=document.querySelector('[data-profile-progress]');
    const xpStat=document.querySelector('[data-profile-xp]');
    if(!holder && !xpStat) return;

    const requested=new URLSearchParams(location.search).get('photographer')||'arran';
    let {data:person}=await db.from('profiles').select('id,username,display_name').eq('username',requested.toLowerCase()).maybeSingle();
    if(!person){
      const {data:rows}=await db.from('profiles').select('id,username,display_name').limit(100);
      person=(rows||[]).find(p=>String(p.display_name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===requested.toLowerCase());
    }
    if(!person) return;

    const [p,a]=await Promise.all([progress(db,person.id),achievements(db,person.id)]);
    const l=levelFor(p.xp), tier=tierFor(l.level);
    document.body.classList.add(`spotter-tier-${tier}`);
    if(xpStat) xpStat.textContent=fmt(p.xp);
    if(holder){
      holder.innerHTML=`<div class="profile-progress-card">
        <div class="profile-progress-card__rank"><span>SPOTTER XP / PUBLIC PROGRESSION</span><b>LVL ${l.level}</b><h2>${esc(l.title)}</h2><p>${fmt(p.xp)} XP</p></div>
        <div class="profile-progress-card__meter"><div><span>LVL ${l.level}</span><span>${l.max?'MAX':`LVL ${l.level+1}`}</span></div><i><b style="width:${l.pct}%"></b></i><small>${l.max?'Scottish.aero Legend rank':`${fmt(l.next-p.xp)} XP until the next level`}</small></div>
        <div class="profile-progress-card__streak"><span><b>${p.current_streak||0}</b> day streak</span><span><b>${p.best_streak||0}</b> best</span><span><b>${a.length}</b> achievements</span></div>
      </div>${achievementMarkup(a)}`;
    }
  }

  async function boot(){
    const db=await dbReady();
    if(!db) return;
    const user=await session(db);
    let challenges=[];
    try{ challenges=await today(db); }catch(e){ console.warn('Spotter XP missions unavailable',e); }

    if(challenges.length) await Promise.all([mountHome(db,user,challenges),mountMissions(db,user,challenges)]);
    let ownProgress=null;
    if(user) ownProgress=await progress(db,user.id);
    mountRoadmap(ownProgress);
    await Promise.all([mountAccount(db,user),mountPublicProfile(db)]);
  }

  window.ScottishAeroSpotter={LEVELS,levelFor,tierFor,rewardFor};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>boot().catch(console.error),{once:true});
  else boot().catch(console.error);
})();