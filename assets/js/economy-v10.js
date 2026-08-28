(() => {
  if (window.__SCOTTISH_AERO_V10_ECONOMY__) return;
  window.__SCOTTISH_AERO_V10_ECONOMY__ = true;

  const backend = window.ScottishAeroBackend;
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => Number(n || 0).toLocaleString();
  const REF_KEY = 'sa_v10_referral_code';
  const validRef = code => /^SA[A-F0-9]{12}$/i.test(String(code || '').trim());

  async function dbReady() {
    if (!backend?.configured) return null;
    return backend.ensureClient().catch(() => null);
  }

  async function currentUser(db) {
    const { data } = await db.auth.getSession();
    return data?.session?.user || null;
  }

  function captureReferral() {
    const code = new URLSearchParams(location.search).get('ref');
    if (!validRef(code)) return;
    try { localStorage.setItem(REF_KEY, code.toUpperCase()); } catch (_) {}
  }

  function storedReferral() {
    try { return localStorage.getItem(REF_KEY) || ''; } catch (_) { return ''; }
  }

  function clearReferral() {
    try { localStorage.removeItem(REF_KEY); } catch (_) {}
  }

  async function claimStoredReferral(db, user) {
    const code = storedReferral();
    if (!user || !validRef(code)) return null;
    const { data, error } = await db.rpc('claim_aero_referral', { p_code: code });
    if (error) return null;
    const status = data?.status;
    if (['claimed','already_claimed','existing_account','claim_window_closed','invalid_code','self_referral','too_late','profile_missing'].includes(status)) clearReferral();
    return data || null;
  }

  function referralUrl(code) {
    const url = new URL('index.html', location.href);
    url.searchParams.set('ref', code);
    return url.href;
  }

  async function shareReferral(code) {
    const url = referralUrl(code);
    const payload = {
      title: 'Scottish.aero — aviation community',
      text: 'Join me on Scottish.aero. Upload aviation photography, build your Spotter Passport, complete missions and earn AeroCoins.',
      url
    };
    if (navigator.share) {
      try { await navigator.share(payload); return 'Shared'; } catch (e) { if (e?.name === 'AbortError') return ''; }
    }
    try { await navigator.clipboard.writeText(url); return 'Referral link copied'; }
    catch (_) { return url; }
  }

  function rewardForNextStreak(current) {
    const next = Math.max(1, Number(current || 0) + 1);
    if (next >= 30) return 5;
    if (next >= 14) return 4;
    if (next >= 7) return 3;
    if (next >= 3) return 2;
    return 1;
  }

  function coinMark() {
    return '<span class="v10-coin-mark" aria-hidden="true"><i></i>AC</span>';
  }

  function walletMarkup(dash, compact = false) {
    const founding = dash?.founding_number;
    const progress = Number(dash?.founding_progress || 0);
    const approved = Number(dash?.approved_photos || 0);
    const current = Number(dash?.current_streak || 0);
    const today = Number(dash?.today_approved || 0);
    const nextReward = Number(dash?.next_reward || rewardForNextStreak(current));
    return `<div class="v10-wallet ${compact ? 'is-compact' : ''}">
      <article class="v10-wallet__balance">
        <div><span>V10 / AEROCOINS</span><b>${coinMark()} ${fmt(dash?.balance)} <small>AeroCoins</small></b><p>${fmt(dash?.lifetime_earned)} earned all-time</p></div>
        <a href="aerocoins.html">Open AeroCoins ↗</a>
      </article>
      <article class="v10-wallet__streak">
        <span>FLIGHTLINE STREAK</span><b>🔥 ${current} DAY${current===1?'':'S'}</b>
        <div class="v10-two-track"><i style="width:${Math.min(100,(today/2)*100)}%"></i></div>
        <p>${today} / 2 approved today · next qualified day +${nextReward} AC</p>
        <small>Best streak · ${fmt(dash?.best_streak)} days</small>
      </article>
      <article class="v10-wallet__founding ${founding ? 'is-earned' : ''}">
        <span>FOUNDING 100</span>
        ${founding ? `<b>#${String(founding).padStart(3,'0')}</b><p>Permanent founding photographer badge.</p>` : `<b>${progress} / 20</b><div class="v10-founding-track"><i style="width:${Math.min(100,(progress/20)*100)}%"></i></div><p>${Math.max(0,20-progress)} approved photo${20-progress===1?'':'s'} remaining.</p>`}
        <small>${approved} approved frame${approved===1?'':'s'} total</small>
      </article>
    </div>`;
  }

  async function getDashboard(db) {
    const { data, error } = await db.rpc('aero_my_dashboard');
    if (error) throw error;
    return data || null;
  }

  async function mountAccount(db, user) {
    const tabs = document.querySelector('.account-tabs');
    const dashboard = document.querySelector('[data-account-dashboard]');
    if (!tabs || !dashboard || document.querySelector('[data-v10-account-economy]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v10AccountEconomy = '';
    button.innerHTML = `AeroCoins <span>AC</span>`;
    tabs.append(button);

    const panel = document.createElement('div');
    panel.className = 'account-panel v10-injected-panel';
    panel.hidden = true;
    panel.dataset.v10AccountEconomyPanel = '';
    panel.innerHTML = '<div class="studio-section-head"><span class="eyebrow">V10 / Community economy</span><h2>Your AeroCoin wallet.</h2><p>Earn credits by contributing consistently and bringing real photographers into the community.</p></div><div data-v10-account-economy-content><div class="v8-panel-loading">Opening wallet…</div></div>';
    dashboard.append(panel);

    async function open() {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === button));
      dashboard.querySelectorAll('[data-account-panel]').forEach(p => p.hidden = true);
      dashboard.querySelectorAll('[data-v812-account-passport-panel]').forEach(p => p.hidden = true);
      panel.hidden = false;
      if (panel.dataset.loaded === '1') return;
      const content = panel.querySelector('[data-v10-account-economy-content]');
      try {
        const dash = await getDashboard(db);
        if (!dash) { content.innerHTML = '<div class="v10-empty"><b>Sign in to open your AeroCoin wallet.</b></div>'; return; }
        const link = referralUrl(dash.referral_code);
        const { data: ledger } = await db.from('aerocoin_ledger').select('amount,reason,created_at').eq('user_id', user.id).order('created_at',{ascending:false}).limit(20);
        content.innerHTML = `${walletMarkup(dash)}
          <div class="v10-economy-grid">
            <article class="v10-panel v10-referral-card">
              <span>REFERRAL FLIGHT</span><h3>Bring a photographer onboard.</h3>
              <p>When somebody joins through your link and reaches <b>5 approved photos</b>, you both receive <b>5 AeroCoins</b>.</p>
              <div class="v10-referral-code"><small>YOUR CODE</small><b>${esc(dash.referral_code)}</b></div>
              <div class="v10-share-actions"><button class="solid-button" type="button" data-v10-share>Share Scottish.aero</button><button class="outline-button" type="button" data-v10-copy>Copy link</button></div>
              <small data-v10-share-message>${fmt(dash.referrals_qualified)} qualified · ${fmt(dash.referrals_total)} referrals</small>
              <input class="v10-link-field" value="${esc(link)}" readonly aria-label="Referral link">
            </article>
            <article class="v10-panel"><span>HOW STREAKS PAY</span><h3>Two approved frames. Every day.</h3>
              <div class="v10-reward-ladder"><i><b>1 AC</b><small>Days 1–2</small></i><i><b>2 AC</b><small>Day 3+</small></i><i><b>3 AC</b><small>Day 7+</small></i><i><b>4 AC</b><small>Day 14+</small></i><i><b>5 AC</b><small>Day 30+</small></i></div>
              <p>Moderation delays do not punish the streak. The system credits the day the qualifying photos were originally submitted.</p>
            </article>
          </div>
          <article class="v10-panel v10-ledger"><div class="v10-panel__head"><div><span>TRANSACTION HISTORY</span><h3>AeroCoin ledger.</h3></div><b>${fmt(dash.balance)} AC</b></div>
            <div>${(ledger||[]).length ? (ledger||[]).map(x=>`<div class="v10-ledger-row"><b>+${fmt(x.amount)} AC</b><span>${esc(x.reason)}</span><time>${new Date(x.created_at).toLocaleDateString()}</time></div>`).join('') : '<div class="v10-empty"><b>No AeroCoins earned yet.</b><span>Your first qualified streak day or referral will appear here.</span></div>'}</div>
          </article>`;
        const msg = content.querySelector('[data-v10-share-message]');
        const doShare = async () => { const result = await shareReferral(dash.referral_code); if (result && msg) msg.textContent = result; };
        content.querySelector('[data-v10-share]')?.addEventListener('click', doShare);
        content.querySelector('[data-v10-copy]')?.addEventListener('click', async()=>{ try { await navigator.clipboard.writeText(link); if(msg)msg.textContent='Referral link copied'; } catch(_){ if(msg)msg.textContent=link; } });
        panel.dataset.loaded = '1';
      } catch (e) {
        content.innerHTML = `<div class="v10-empty"><b>Wallet temporarily unavailable.</b><span>${esc(e.message)}</span></div>`;
      }
    }

    button.addEventListener('click', open);
    tabs.addEventListener('click', e => {
      const clicked = e.target.closest('button');
      if (!clicked || clicked === button) return;
      button.classList.remove('is-active');
      panel.hidden = true;
    });
  }

  async function findProfile(db, key) {
    if (!key) return null;
    const wanted = String(key).toLowerCase();
    let { data } = await db.from('profiles').select('id,username,display_name').eq('username', wanted).maybeSingle();
    if (data) return data;
    const { data: rows } = await db.from('profiles').select('id,username,display_name').limit(100);
    return (rows || []).find(p => String(p.display_name || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') === wanted) || null;
  }

  async function mountProfile(db) {
    if (!document.querySelector('[data-profile-page]') || document.querySelector('[data-v10-profile-status]')) return;
    const requested = new URLSearchParams(location.search).get('photographer') || 'arran';
    const profile = await findProfile(db, requested);
    if (!profile) return;
    const { data, error } = await db.rpc('aero_public_status', { p_user_id: profile.id });
    if (error) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    const hero = document.querySelector('.creator-profile-hero__identity > div:last-child');
    if (hero) {
      const status = document.createElement('div');
      status.className = 'v10-profile-status';
      status.dataset.v10ProfileStatus = '';
      status.innerHTML = `<span>${coinMark()} <b>${fmt(row.balance)} AC</b></span><span>🔥 <b>${fmt(row.current_streak)}</b> day streak</span>${row.founding_number ? `<strong>FOUNDING 100 #${String(row.founding_number).padStart(3,'0')}</strong>` : `<span><b>${fmt(row.founding_progress)} / 20</b> Founding 100</span>`}`;
      hero.append(status);
    }
  }

  async function mountEconomyPage(db, user) {
    const holder = document.querySelector('[data-v10-economy-page]');
    if (!holder) return;
    const auth = holder.querySelector('[data-v10-economy-auth]');
    if (!user) {
      if (auth) auth.innerHTML = '<div class="v10-page-signin"><span>YOUR WALLET</span><h2>Sign in to open AeroCoins.</h2><p>Your wallet, streak, Founding 100 progress and referral link live here.</p><a class="solid-button" href="account.html?mode=login">Sign in ↗</a><a class="outline-button" href="account.html?mode=signup">Create account</a></div>';
    } else {
      try {
        const dash = await getDashboard(db);
        if (auth && dash) {
          const link = referralUrl(dash.referral_code);
          auth.innerHTML = `${walletMarkup(dash)}<div class="v10-page-share"><div><span>YOUR REFERRAL LINK</span><b>${esc(dash.referral_code)}</b><p>Both photographers earn 5 AeroCoins when the new member reaches five approved photos.</p></div><button class="solid-button" data-v10-page-share type="button">Share Scottish.aero ↗</button><input class="v10-link-field" value="${esc(link)}" readonly></div>`;
          auth.querySelector('[data-v10-page-share]')?.addEventListener('click', async e => { const r=await shareReferral(dash.referral_code); if(r)e.currentTarget.textContent=r; });
        }
      } catch (_) {}
    }

    const founding = holder.querySelector('[data-v10-founding-list]');
    if (founding) {
      const { data: badges } = await db.from('founding_100').select('user_id,badge_number,earned_at').order('badge_number').limit(100);
      const ids = (badges || []).map(x=>x.user_id);
      let profiles=[];
      if(ids.length){ const r=await db.from('profiles').select('id,username,display_name').in('id',ids); profiles=r.data||[]; }
      const map=new Map(profiles.map(p=>[p.id,p]));
      founding.innerHTML = `<div class="v10-founding-count"><b>${(badges||[]).length}</b><span>/ 100 CLAIMED</span></div><div class="v10-founder-grid">${(badges||[]).map(b=>{const p=map.get(b.user_id);return `<a href="profile.html?photographer=${encodeURIComponent(p?.username||'')}" class="v10-founder"><span>#${String(b.badge_number).padStart(3,'0')}</span><b>${esc(p?.display_name||'Scottish.aero photographer')}</b><small>Founding 100 · 2026</small></a>`}).join('')}</div>`;
    }
  }

  function mountReferralNotice(user) {
    const code = storedReferral();
    if (!validRef(code) || user || document.querySelector('[data-v10-referral-notice]')) return;
    const main = document.querySelector('main');
    if (!main) return;
    const notice = document.createElement('aside');
    notice.className = 'v10-referral-notice';
    notice.dataset.v10ReferralNotice='';
    notice.innerHTML='<div><span>YOU WERE INVITED</span><b>Join Scottish.aero.</b><p>Build your aviation archive. Reach 5 approved photos and both you and the photographer who invited you earn 5 AeroCoins.</p></div><a class="solid-button" href="account.html?mode=signup">Create account ↗</a>';
    main.prepend(notice);
  }

  function mountHomeTeaser() {
    const anchor = document.querySelector('[data-v812-home]') || document.querySelector('.v8-home');
    if (!anchor || document.querySelector('[data-v10-home]')) return;
    const section=document.createElement('section');
    section.className='section v10-home';
    section.dataset.v10Home='';
    section.innerHTML=`<div class="site-shell"><div class="v10-home__head"><div><span class="eyebrow">V10 / Community economy</span><h2>CONTRIBUTE.<br><span>EARN YOUR PLACE.</span></h2></div><div><span class="v10-live-chip"><i></i> AEROCOINS LIVE</span><p>AeroCoins reward real contribution: qualified referral flights, consistent approved uploads and permanent early-community milestones.</p><a class="solid-button" href="aerocoins.html">Explore AeroCoins ↗</a></div></div><div class="v10-home__cards"><article><span>01 / WALLET</span><b>AEROCOINS</b><p>Spendable community credits. Separate from XP.</p></article><article><span>02 / STREAK</span><b>2 APPROVED / DAY</b><p>Build a Flightline streak and earn up to 5 AC per qualified day.</p></article><article><span>03 / LEGACY</span><b>FOUNDING 100</b><p>First 100 photographers to reach 20 approved frames earn the permanent badge.</p></article></div></div>`;
    anchor.insertAdjacentElement('afterend',section);
  }

  async function boot() {
    captureReferral();
    mountHomeTeaser();
    const db = await dbReady();
    if (!db) return;
    let user = await currentUser(db);
    if (user) await claimStoredReferral(db,user).catch(()=>null);
    mountReferralNotice(user);
    await Promise.all([mountAccount(db,user), mountProfile(db), mountEconomyPage(db,user)]);
    db.auth.onAuthStateChange(async (_e, session) => {
      const next=session?.user||null;
      if(next){await claimStoredReferral(db,next).catch(()=>null);}
    });
  }

  window.ScottishAeroEconomyV10 = { shareReferral, referralUrl, rewardForNextStreak };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>boot().catch(console.warn),{once:true});
  else boot().catch(console.warn);
})();
