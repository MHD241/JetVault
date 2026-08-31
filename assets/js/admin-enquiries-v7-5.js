(() => {
  if (window.__SA_WEB_ENQUIRIES_V75__) return;
  window.__SA_WEB_ENQUIRIES_V75__ = true;

  const backend = window.ScottishAeroBackend;
  if (!backend) return;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));

  let db, user, profile, tab, panel;

  async function boot() {
    db = await backend.ensureClient();
    if (!db) return;

    const session = await db.auth.getSession();
    if (session.data?.session?.user) await maybeMount(session.data.session.user);

    db.auth.onAuthStateChange((_event, s) => {
      if (s?.user) maybeMount(s.user).catch(() => {});
    });
  }

  async function maybeMount(u) {
    user = u;
    const r = await db.from('profiles').select('display_name,is_manager').eq('id', u.id).maybeSingle();
    profile = r.data;
    if (!profile?.is_manager) return;
    if (!tab) inject();
    await load();
  }

  function inject() {
    const tabs = document.querySelector('.studio-tabs');
    const main = document.querySelector('[data-admin-app]');
    if (!tabs || !main) return;

    tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.studioTab = 'web-enquiries';
    tab.innerHTML = 'Web enquiries <span data-web-enquiry-count></span>';
    tabs.append(tab);

    panel = document.createElement('section');
    panel.className = 'studio-panel web-enquiry-panel';
    panel.dataset.studioPanel = 'web-enquiries';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="studio-section-head">
        <span class="eyebrow">Mohammed</span>
        <h2>Website enquiries.</h2>
        <p>Private messages from people interested in having a website built.</p>
      </div>
      <div class="web-enquiry-stats">
        <div><span>Open</span><b data-web-open>0</b></div>
        <div><span>Contacted</span><b data-web-contacted>0</b></div>
        <div><span>Closed</span><b data-web-closed>0</b></div>
      </div>
      <article class="admin-panel">
        <div class="admin-panel__head">
          <h2>Enquiry inbox</h2>
          <button class="mini-button" type="button" data-web-refresh>Refresh</button>
        </div>
        <div class="admin-panel__body">
          <div class="web-enquiry-list" data-web-enquiry-list></div>
        </div>
      </article>`;

    main.append(panel);
    tab.addEventListener('click', show);
    panel.querySelector('[data-web-refresh]').addEventListener('click', load);
  }

  function show() {
    document.querySelectorAll('[data-studio-tab]').forEach(b => b.classList.toggle('is-active', b === tab));
    document.querySelectorAll('[data-studio-panel]').forEach(p => p.hidden = p !== panel);
    window.scrollTo({top:0, behavior:'smooth'});
    load();
  }

  async function load() {
    if (!panel) return;
    const holder = panel.querySelector('[data-web-enquiry-list]');
    holder.innerHTML = '<div class="admin-empty">Loading website enquiries…</div>';

    const r = await db.from('website_enquiries').select('*').order('created_at', {ascending:false});
    if (r.error) {
      holder.innerHTML = `<div class="admin-empty">Could not load enquiries: ${esc(r.error.message)}</div>`;
      return;
    }

    const rows = r.data || [];
    const counts = {
      open: rows.filter(x => x.status === 'open').length,
      contacted: rows.filter(x => x.status === 'contacted').length,
      closed: rows.filter(x => x.status === 'closed').length
    };

    panel.querySelector('[data-web-open]').textContent = counts.open;
    panel.querySelector('[data-web-contacted]').textContent = counts.contacted;
    panel.querySelector('[data-web-closed]').textContent = counts.closed;
    tab.querySelector('[data-web-enquiry-count]').textContent = counts.open || '';

    const priority = {open:0, contacted:1, closed:2};
    rows.sort((a,b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9) ||
      new Date(b.created_at) - new Date(a.created_at));

    holder.innerHTML = rows.length ? rows.map(row => `
      <article class="web-enquiry-card">
        <div class="web-enquiry-card__top">
          <div>
            <span>${esc(backend.formatDate(row.created_at))}</span>
            <h3>${esc(row.name)}</h3>
            <a class="web-enquiry-card__email" href="mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent('Your website enquiry')}">${esc(row.email)}</a>
          </div>
          <b class="web-enquiry-status web-enquiry-status--${esc(row.status)}">${esc(row.status.toUpperCase())}</b>
        </div>
        <div class="web-enquiry-card__meta">
          <span>${esc(String(row.project_type || 'website').replaceAll('_',' '))}</span>
          ${row.budget ? `<span>Budget: ${esc(row.budget)}</span>` : '<span>Budget not supplied</span>'}
        </div>
        <div class="web-enquiry-card__message">${esc(row.message)}</div>
        <div class="web-enquiry-card__actions">
          <a class="mini-button" href="mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent('Re: your website enquiry')}">Reply by email ↗</a>
          <select data-enquiry-status="${esc(row.id)}" aria-label="Enquiry status">
            <option value="open" ${row.status==='open'?'selected':''}>Open</option>
            <option value="contacted" ${row.status==='contacted'?'selected':''}>Contacted</option>
            <option value="closed" ${row.status==='closed'?'selected':''}>Closed</option>
          </select>
        </div>
      </article>`).join('') : '<div class="admin-empty">No website enquiries yet.</div>';

    holder.querySelectorAll('[data-enquiry-status]').forEach(select => {
      select.addEventListener('change', async () => {
        select.disabled = true;
        const result = await db.from('website_enquiries')
          .update({status: select.value})
          .eq('id', select.dataset.enquiryStatus);
        if (result.error) {
          alert(result.error.message);
          select.disabled = false;
          return;
        }
        await load();
      });
    });
  }

  boot().catch(error => console.warn('Jetvault web enquiries unavailable', error));
})();

/* V11 manager console loader — admin.html already loads this file, so no HTML edit is needed. */
(() => {
  if (!document.querySelector('link[href="assets/css/manager-v11.css"]')) {
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='assets/css/manager-v11.css'; document.head.append(link);
  }
  if (!document.querySelector('script[src="assets/js/admin-manager-v11.js"]')) {
    const script=document.createElement('script'); script.src='assets/js/admin-manager-v11.js'; script.defer=true; document.body.append(script);
  }
})();
