(() => {
  if (window.__SCOTTISH_AERO_ADMIN_BUGS_V72__) return;
  window.__SCOTTISH_AERO_ADMIN_BUGS_V72__ = true;
  const backend = window.ScottishAeroBackend;
  if (!backend?.configured) return;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let db, user, profile, panel, list, countEl;

  async function waitForModerationPanel() {
    const current = document.querySelector('[data-studio-panel="moderation"]');
    if (current) return current;
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const found = document.querySelector('[data-studio-panel="moderation"]');
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(document.querySelector('[data-studio-panel="moderation"]')); }, 10000);
    });
  }

  async function mountFor(u) {
    user = u;
    const r = await db.from('profiles').select('id,is_manager').eq('id', u.id).maybeSingle();
    profile = r.data;
    if (!profile?.is_manager) return;
    panel = await waitForModerationPanel();
    if (!panel) return;
    inject();
    await loadBugs();
  }

  function inject() {
    if (panel.querySelector('[data-bug-admin-panel]')) return;
    const stats = panel.querySelector('.moderation-stats');
    if (stats && !stats.querySelector('[data-bug-count]')) {
      const stat = document.createElement('div');
      stat.innerHTML = '<span>Open bugs</span><b data-bug-count>0</b>';
      stats.append(stat);
      countEl = stat.querySelector('[data-bug-count]');
    } else countEl = panel.querySelector('[data-bug-count]');

    const layout = panel.querySelector('.moderation-layout') || panel;
    layout.classList.add('moderation-layout--v72');
    const article = document.createElement('article');
    article.className = 'admin-panel bug-admin-panel';
    article.dataset.bugAdminPanel = '';
    article.innerHTML = `<div class="admin-panel__head"><div><h2>Website bug reports</h2><span class="muted">Submitted from the public Bug box</span></div><button class="mini-button" type="button" data-bug-refresh>Refresh</button></div><div class="admin-panel__body"><div class="bug-admin-list" data-bug-admin-list><div class="admin-empty">Loading bug reports…</div></div></div>`;
    layout.append(article);
    list = article.querySelector('[data-bug-admin-list]');
    article.querySelector('[data-bug-refresh]').addEventListener('click', loadBugs);

    const tab = document.querySelector('[data-studio-tab="moderation"]');
    tab?.addEventListener('click', () => setTimeout(loadBugs, 80));
  }

  async function loadBugs() {
    if (!list) return;
    const r = await db.from('bug_reports').select('*').in('status', ['open','in_progress']).order('created_at', { ascending: true });
    if (r.error) { list.innerHTML = `<div class="admin-empty">${esc(r.error.message)}</div>`; return; }
    const rows = r.data || [];
    if (countEl) countEl.textContent = rows.length;
    const reporterIds = [...new Set(rows.map(x => x.reporter_id).filter(Boolean))];
    let people = [];
    if (reporterIds.length) {
      const pr = await db.from('profiles').select('id,display_name,username').in('id', reporterIds);
      people = pr.data || [];
    }
    const byId = new Map(people.map(p => [p.id,p]));
    list.innerHTML = rows.length ? rows.map(row => {
      const who = row.reporter_id ? byId.get(row.reporter_id) : null;
      const reporter = who ? `${who.display_name} · @${who.username || 'member'}` : 'Anonymous visitor';
      const page = row.page_url || '';
      return `<article class="bug-admin-card" data-bug-id="${esc(row.id)}"><div><span>${esc(String(row.status).replace('_',' '))} · ${esc(backend.formatDate(row.created_at))} · ${esc(reporter)}</span><h3>${esc(row.title)}</h3><p>${esc(row.description)}</p>${row.reply_email ? `<small>Reply: ${esc(row.reply_email)}</small>` : ''}${page ? `<small>Page: <a href="${esc(page)}" target="_blank" rel="noopener">${esc(page)} ↗</a></small>` : ''}<details><summary class="muted">Device info</summary><small>${esc(row.user_agent || 'Not supplied')}</small></details></div><div class="bug-admin-card__actions"><select data-bug-status="${esc(row.id)}" aria-label="Bug status"><option value="open" ${row.status==='open'?'selected':''}>Open</option><option value="in_progress" ${row.status==='in_progress'?'selected':''}>In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><button class="mini-button" type="button" data-bug-done="${esc(row.id)}">Resolve</button></div></article>`;
    }).join('') : '<div class="admin-empty">No open bugs. Miraculously, everything is behaving. ✈️</div>';

    list.querySelectorAll('[data-bug-status]').forEach(select => select.addEventListener('change', () => updateStatus(select.dataset.bugStatus, select.value)));
    list.querySelectorAll('[data-bug-done]').forEach(button => button.addEventListener('click', () => updateStatus(button.dataset.bugDone, 'resolved')));
  }

  async function updateStatus(id, status) {
    const resolved = status === 'resolved' || status === 'closed';
    const patch = { status, resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? user.id : null };
    const r = await db.from('bug_reports').update(patch).eq('id', id);
    if (!r.error) await loadBugs();
  }

  async function init() {
    db = await backend.ensureClient();
    if (!db) return;
    const { data } = await db.auth.getSession();
    if (data?.session?.user) await mountFor(data.session.user);
    db.auth.onAuthStateChange((_event, session) => {
      if (session?.user) mountFor(session.user).catch(() => {});
    });
  }
  init().catch(e => console.warn('V7.2 bug queue unavailable', e));
})();
