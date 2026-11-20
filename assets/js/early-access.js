/* Jetvault Flight Sim early access: the Team-up page.
   All rules live in the database (supabase/flight-sim-early-access.sql). This file only shows
   the state the server returns and calls its four functions:
     fs_early_access_status, fs_create_invite, fs_accept_invite, fs_revoke_invite
   When the backend is not configured (for example in a design preview) it shows labelled sample data. */
(() => {
  const root = document.querySelector('[data-ea-app]');
  if (!root) return;

  const SOLO = 150, PAIR = 75;
  const KEY = 'jv_partner_ref';
  const backend = window.ScottishAeroBackend;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

  const store = {
    get() { try { return clean(localStorage.getItem(KEY)); } catch (_) { return ''; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (_) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (_) {} }
  };

  const params = new URLSearchParams(location.search);
  // Team-up stays locked until the feature switch (feature-flags.js) is on. In a no-backend preview, ?unlock=1 shows the open design.
  const frontOpen = () => window.JV_FEATURES?.teamUp === true || (!backend?.configured && params.get('unlock') === '1');
  let urlRef = frontOpen() ? clean(params.get('ref')) : '';
  if (urlRef) store.set(urlRef);
  // Forget the link everywhere (saved copy, address bar, memory) once it has been used or dismissed.
  const forgetRef = () => { store.clear(); if (urlRef) history.replaceState(null, '', location.pathname); urlRef = ''; };
  const pendingRef = () => urlRef || store.get();

  const MESSAGES = {
    invalid_code: 'That link is not valid, or its owner cancelled it. Ask them for a new one.',
    link_used: 'Someone has already used that link. Each link works for one person.',
    own_link: 'That is your own link. Send it to a friend instead.',
    already_paired: 'You are already paired. Each person can only have one partner.',
    inviter_unavailable: 'The person who sent that link is no longer available to pair.',
    locked: 'A pair cannot be changed once it has been made.',
    not_signed_in: 'Sign in first, then try again.',
    teamup_locked: 'Team-up is locked for now. It opens when Flight Sim is ready for it.'
  };
  const friendly = err => {
    const text = String(err?.message || err || '');
    for (const key in MESSAGES) if (text.includes(key)) return MESSAGES[key];
    if (/could not find the function|PGRST202|schema cache/i.test(text)) return 'Team-up is not switched on yet. Check back soon.';
    return 'Something went wrong. Please try again in a moment.';
  };

  /* ---------- pieces ---------- */
  const meter = (label, n, target) => {
    const pct = Math.max(0, Math.min(100, Math.round((n / target) * 100)));
    const left = Math.max(0, target - n);
    return `<div class="ea-meter">
      <div class="ea-meter__top"><span>${esc(label)}</span><b>${n} <i>of ${target}</i></b></div>
      <div class="ea-meter__bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(n, target)}"><span style="width:${pct}%"></span></div>
      <p>${left === 0 ? 'Done.' : `${left} to go`}</p>
    </div>`;
  };
  const note = (text, kind) => `<p class="ea-note${kind ? ' ea-note--' + kind : ''}" role="${kind === 'error' ? 'alert' : 'status'}">${esc(text)}</p>`;
  const inviteBox = ref => `<div class="ea-card ea-card--invite">
      <h2>You have a partner link</h2>
      <p>Someone invited you to team up. You will each post ${PAIR} photos, and you both need to reach ${PAIR} for either of you to get early access. Once you accept, you cannot change partners.</p>
      <p class="ea-code">${esc(ref)}</p>
      <div class="ea-actions"><button class="solid-button" type="button" data-ea="accept" data-ref="${esc(ref)}">Accept and team up</button><button class="outline-button" type="button" data-ea="dismiss">Not now</button></div>
    </div>`;

  /* ---------- screens ---------- */
  function signedOut() {
    const ref = pendingRef();
    return `${ref ? `<div class="ea-card ea-card--invite"><h2>You have a partner link</h2>
        <p>Join Jetvault or sign in, then come back to this page and accept it. Your link is saved in this browser.</p><p class="ea-code">${esc(ref)}</p></div>` : ''}
      <div class="ea-card"><h2>Sign in to see your progress</h2>
        <p>Early access is ${SOLO} photos on your own, or ${PAIR} each with a partner. Your photo count and your partner link live in your Jetvault account.</p>
        <div class="ea-actions"><a class="solid-button" href="account.html?mode=signup">Join Jetvault</a><a class="outline-button" href="account.html">Sign in</a></div></div>`;
  }

  function signedIn(s, flash) {
    const mine = Number(s.photos) || 0;
    const ref = pendingRef();
    const out = [];
    if (flash) out.push(flash);

    if (s.unlocked) {
      out.push(`<div class="ea-card ea-card--won"><h2>You are in</h2>
        <p>${s.via === 'pair'
          ? `You and ${esc(s.partner?.name || 'your partner')} both reached ${PAIR} photos. Flight Sim early access is yours.`
          : `You reached ${SOLO} photos. Flight Sim early access is yours.`}</p>
        <p class="ea-small">You will get in before launch day on 25 February 2027.</p></div>`);
    }

    if (ref && s.link_state === 'none' && !s.unlocked) out.push(inviteBox(ref));
    if (ref && s.link_state !== 'none') forgetRef();

    if (s.link_state === 'none') {
      out.push(`<div class="ea-two">
        <div class="ea-card"><h2>On your own</h2><p>Post ${SOLO} photos.</p>${meter('Your photos', mine, SOLO)}</div>
        <div class="ea-card ea-card--team"><h2>With a partner</h2>
          <p>Send your link to one friend. You each post ${PAIR}. You both need to reach ${PAIR} for either of you to get in.</p>
          ${meter('Your photos', mine, PAIR)}
          <div class="ea-actions"><button class="solid-button" type="button" data-ea="create">Create my partner link</button></div></div>
      </div>`);
    } else if (s.link_state === 'open') {
      const url = `${location.origin}${location.pathname}?ref=${encodeURIComponent(s.code)}`;
      out.push(`<div class="ea-card ea-card--team"><h2>Send this link to one friend</h2>
        <p>It works for one person. When they accept, you are paired and you each need ${PAIR} photos.</p>
        <div class="ea-link"><input id="ea-link-input" type="text" readonly value="${esc(url)}" aria-label="Your partner link"><button class="solid-button" type="button" data-ea="copy">Copy link</button></div>
        <p class="ea-small">Waiting for your friend to accept. You can cancel the link until they do.</p>
        ${meter('Your photos', mine, PAIR)}
        <div class="ea-actions"><button class="outline-button" type="button" data-ea="revoke">Cancel link</button></div></div>`);
    } else if (s.link_state === 'paired') {
      const p = s.partner || {};
      const theirs = Number(p.photos) || 0;
      const name = p.name || 'Your partner';
      let line;
      if (s.unlocked) line = '';
      else if (mine >= PAIR && theirs < PAIR) line = `You have done your ${PAIR}. ${name} has ${PAIR - theirs} to go, then you are both in.`;
      else if (mine < PAIR && theirs >= PAIR) line = `${name} has done their ${PAIR}. You have ${PAIR - mine} to go, then you are both in.`;
      else line = `You both need ${PAIR}. Photos are not shared between you, so each of you posts your own.`;
      out.push(`<div class="ea-card ea-card--team"><h2>Paired with ${esc(name)}</h2>
        ${line ? `<p>${esc(line)}</p>` : ''}
        <div class="ea-two ea-two--meters">${meter('You', mine, PAIR)}${meter(name, theirs, PAIR)}</div>
        <p class="ea-small">A pair cannot be changed once it has been made. Only approved photos count.</p></div>`);
    }
    return out.join('');
  }

  /* ---------- locked view: the real design, dimmed, behind an animated padlock ---------- */
  const LOCK_SVG = `<svg class="ea-lock" viewBox="0 0 96 112" width="88" height="102" aria-hidden="true">
      <g class="ea-lock__shackle"><path d="M27 52V36a21 21 0 0 1 42 0v16" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></g>
      <rect class="ea-lock__body" x="10" y="50" width="76" height="56" rx="12" fill="currentColor"/>
      <circle cx="48" cy="73" r="8" fill="#0a1018"/><rect x="45" y="76" width="6" height="15" rx="3" fill="#0a1018"/>
    </svg>`;
  function lockedView() {
    return `<div class="ea-locked">
      <div class="ea-locked__ghost" aria-hidden="true" inert>${signedIn(SAMPLE.none)}</div>
      <div class="ea-locked__panel" role="status">
        <div class="ea-locked__tape" aria-hidden="true"></div>
        <div class="ea-locked__content">
          ${LOCK_SVG}
          <h2>Team-up is locked</h2>
          <p>Partner links open when Jetvault Flight Sim is ready to use them. Until then, post ${SOLO} photos on your own to get early access.</p>
          <div class="ea-actions"><a class="solid-button" href="flight-sim.html">Back to Flight Sim</a><a class="outline-button" href="gallery.html">See the archive</a></div>
        </div>
      </div>
    </div>`;
  }

  const paint = html => { root.innerHTML = html; };

  /* ---------- sample data when there is no backend ---------- */
  const SAMPLE = {
    none:   { photos: 62, link_state: 'none', code: null, partner: null, unlocked: false, via: null },
    open:   { photos: 62, link_state: 'open', code: 'K7Q2M9XD4A', partner: null, unlocked: false, via: null },
    paired: { photos: 75, link_state: 'paired', code: null, partner: { name: 'Sample Partner', photos: 41 }, unlocked: false, via: null },
    ready:  { photos: 75, link_state: 'paired', code: null, partner: { name: 'Sample Partner', photos: 75 }, unlocked: true, via: 'pair' },
    solo:   { photos: 150, link_state: 'none', code: null, partner: null, unlocked: true, via: 'solo' }
  };
  function showSample() {
    const which = params.get('preview') || 'none';
    const banner = '<p class="ea-note ea-note--sample" role="status">Sample data. This is how the page looks once you are signed in.</p>';
    if (which === 'out') return paint(signedOut());
    if (which === 'invite') return paint(banner + inviteBox('K7Q2M9XD4A') + signedIn(SAMPLE.none));
    paint(banner + signedIn(SAMPLE[which] || SAMPLE.none));
  }

  /* ---------- real backend ---------- */
  let db = null;
  async function refresh(flash) {
    const { data: sess } = await db.auth.getSession();
    if (!sess?.session) return paint(signedOut());
    const { data, error } = await db.rpc('fs_early_access_status');
    if (error) return paint(note(friendly(error), 'error'));
    if (data && data.teamup_open === false) return paint(lockedView());
    paint(signedIn(data, flash));
  }

  async function act(name, btn) {
    btn.disabled = true;
    try {
      if (name === 'create') {
        const { error } = await db.rpc('fs_create_invite');
        if (error) throw error;
        return refresh();
      }
      if (name === 'revoke') {
        const { error } = await db.rpc('fs_revoke_invite');
        if (error) throw error;
        return refresh(note('Link cancelled.'));
      }
      if (name === 'accept') {
        const { error } = await db.rpc('fs_accept_invite', { p_code: btn.dataset.ref });
        if (error) throw error;
        forgetRef();
        return refresh(note('You are paired. Now post your photos.'));
      }
    } catch (err) {
      if (name === 'accept') forgetRef();
      return refresh(note(friendly(err), 'error'));
    } finally {
      btn.disabled = false;
    }
  }

  root.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-ea]');
    if (!btn) return;
    const name = btn.dataset.ea;

    if (name === 'copy') {
      const input = root.querySelector('#ea-link-input');
      if (!input) return;
      input.select();
      try { await navigator.clipboard.writeText(input.value); btn.textContent = 'Copied'; }
      catch (_) { try { document.execCommand('copy'); btn.textContent = 'Copied'; } catch (__) { btn.textContent = 'Press Ctrl+C'; } }
      setTimeout(() => { btn.textContent = 'Copy link'; }, 1800);
      return;
    }
    if (name === 'dismiss') {
      forgetRef();
      return backend?.configured && db ? refresh() : showSample();
    }
    if (backend?.configured && db) act(name, btn);
  });

  (async () => {
    if (!frontOpen()) return paint(lockedView());   // locked: no backend calls at all
    if (!backend?.configured) return showSample();
    try { db = await backend.ensureClient(); } catch (_) { db = null; }
    if (!db) return paint(note('Could not reach Jetvault right now. Please try again in a moment.', 'error'));
    refresh();
  })();
})();
