(() => {
  const backend = window.ScottishAeroBackend;
  if (!backend) return;

  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  let db, user, profile, tab, panel;

  const checklistItems = [
    ['rights', 'Ownership / permission looks valid'],
    ['ai', 'No obvious AI-generated or synthetic image'],
    ['subject', 'Aviation subject is clear and intentional'],
    ['quality', 'Technical quality is archive-worthy'],
    ['edit', 'No obstructive watermark or destructive edit'],
    ['metadata', 'Metadata has been checked'],
    ['duplicate', 'Not an unnecessary near-duplicate'],
    ['safety', 'No obvious safety, privacy or legal issue']
  ];

  async function init() {
    db = await backend.ensureClient();
    if (!db) return;
    const { data } = await db.auth.getSession();
    if (data?.session?.user) await maybeMount(data.session.user);
    db.auth.onAuthStateChange((_event, session) => {
      if (session?.user) maybeMount(session.user).catch(() => {});
    });
  }

  async function syncCrewProfileFromLegacy() {
    if (!db || !user || !profile?.is_crew) return;
    const r = await db.from('photos')
      .select('caption,image_url,updated_at')
      .eq('owner_id', user.id)
      .eq('registration', backend.META_PROFILE)
      .order('updated_at', { ascending:false })
      .limit(1)
      .maybeSingle();
    if (r.error || !r.data) return;

    const patch = {
      bio: r.data.caption || '',
      avatar_url: r.data.image_url || '',
      updated_at: new Date().toISOString()
    };
    const saved = await db.from('profiles').update(patch).eq('id', user.id);
    if (!saved.error) {
      profile = { ...profile, ...patch };
      backend.invalidateContent();
      window.dispatchEvent(new CustomEvent('sa:auth-changed'));
    }
  }

  function watchLegacyProfileEditor() {
    const success = document.querySelector('[data-profile-success]');
    if (!success || success.dataset.v74SyncWatch) return;
    success.dataset.v74SyncWatch = '1';
    const observer = new MutationObserver(() => {
      if (success.classList.contains('show') && /updated/i.test(success.textContent || '')) {
        syncCrewProfileFromLegacy().catch(() => {});
      }
    });
    observer.observe(success, {
      childList:true, subtree:true, attributes:true, attributeFilter:['class']
    });
  }

  async function maybeMount(u) {
    user = u;
    const r = await db.from('profiles').select('*').eq('id', u.id).maybeSingle();
    profile = r.data;
    if (!profile?.is_crew) return;

    watchLegacyProfileEditor();

    // V7.4: every Scottish.aero crew account gets the moderation tab.
    if (!tab) inject();
    await loadQueue();
  }

  function inject() {
    const tabs = document.querySelector('.studio-tabs') || document.querySelector('[data-studio-tabs]');
    const main = document.querySelector('.studio-main') || document.querySelector('[data-admin-app]');
    if (!tabs || !main) return;

    tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.studioTab = 'moderation';
    tab.innerHTML = 'Moderation <span data-mod-count></span>';
    tabs.append(tab);

    panel = document.createElement('section');
    panel.className = 'studio-panel moderation-panel';
    panel.dataset.studioPanel = 'moderation';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="studio-section-head">
        <span class="eyebrow">V7.4 / Crew moderation</span>
        <h2>Moderation tower.</h2>
        <p>Every community photograph must pass the same eight archive checks before approval.</p>
      </div>

      <div class="moderation-guide">
        <div><b>Use the standard, not vibes.</b><p>Tick every check you have actually reviewed. If you are unsure, leave the photo pending for another crew member.</p></div>
        <a href="rules.html" target="_blank" rel="noopener">Open full photo rules ↗</a>
      </div>

      <div class="moderation-stats">
        <div><span>Pending photos</span><b data-pending-count>0</b></div>
        <div><span>Open reports</span><b data-report-count>0</b></div>
        <div><span>Your role</span><b style="font-size:1.35rem" data-mod-role>CREW</b></div>
      </div>

      <div class="admin-layout moderation-layout">
        <article class="admin-panel">
          <div class="admin-panel__head"><h2>Submission queue</h2><button class="mini-button" type="button" data-mod-refresh>Refresh</button></div>
          <div class="admin-panel__body"><div class="moderation-list" data-pending-list></div></div>
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h2>Community reports</h2></div>
          <div class="admin-panel__body"><div class="moderation-list" data-report-list></div></div>
        </article>
      </div>`;

    main.append(panel);
    panel.querySelector('[data-mod-role]').textContent = profile?.is_manager ? 'MANAGER' : 'CREW';
    tab.addEventListener('click', show);
    panel.querySelector('[data-mod-refresh]').addEventListener('click', loadQueue);
  }

  function show() {
    document.querySelectorAll('[data-studio-tab]').forEach(b => b.classList.toggle('is-active', b === tab));
    document.querySelectorAll('[data-studio-panel]').forEach(p => { p.hidden = p !== panel; });
    window.scrollTo({ top:0, behavior:'smooth' });
    loadQueue();
  }

  async function loadQueue() {
    if (!panel) return;

    const [photoResult, reportResult] = await Promise.all([
      db.from('photos')
        .select('*')
        .eq('status', 'pending')
        .neq('registration', backend.META_PROFILE)
        .neq('registration', backend.META_POST)
        .order('created_at', { ascending:true }),
      db.from('reports')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending:true })
    ]);

    if (photoResult.error) {
      panel.querySelector('[data-pending-list]').innerHTML =
        `<div class="moderation-empty">Could not load pending photos: ${esc(photoResult.error.message)}</div>`;
    }
    if (reportResult.error) {
      panel.querySelector('[data-report-list]').innerHTML =
        `<div class="moderation-empty">Could not load reports: ${esc(reportResult.error.message)}</div>`;
    }

    const pending = photoResult.data || [];
    const reports = reportResult.data || [];

    const commentIds = [...new Set(reports.map(x => x.comment_id).filter(Boolean))];
    let reportedComments = [];
    if (commentIds.length) {
      const cr = await db.from('comments').select('id,content_id,author_name,body').in('id', commentIds);
      reportedComments = cr.data || [];
    }
    const commentMap = new Map(reportedComments.map(c => [c.id, c]));

    const contentIds = [...new Set([
      ...reports.map(x => x.content_id),
      ...reportedComments.map(x => x.content_id)
    ].filter(Boolean))];

    let reportedContent = [];
    if (contentIds.length) {
      const cr = await db.from('photos')
        .select('id,registration,aircraft_type,photographer_name,owner_id')
        .in('id', contentIds);
      reportedContent = cr.data || [];
    }
    const contentMap = new Map(reportedContent.map(c => [c.id, c]));

    const ownerIds = [...new Set([
      ...pending.map(x => x.owner_id),
      ...reports.map(x => x.reporter_id),
      ...reportedContent.map(x => x.owner_id)
    ].filter(Boolean))];

    let profiles = [];
    if (ownerIds.length) {
      const x = await db.from('profiles').select('id,display_name,username').in('id', ownerIds);
      profiles = x.data || [];
    }
    const names = new Map(profiles.map(p => [p.id, p]));

    panel.querySelector('[data-pending-count]').textContent = pending.length;
    panel.querySelector('[data-report-count]').textContent = reports.length;
    tab.querySelector('[data-mod-count]').textContent = pending.length + reports.length || '';

    if (!photoResult.error) renderPending(pending, names);
    if (!reportResult.error) renderReports(reports, names, commentMap, contentMap);
  }

  function checklistMarkup(id) {
    return `
      <div class="mod-checklist" data-checklist="${esc(id)}">
        ${checklistItems.map(([key, label]) => `
          <label><input type="checkbox" data-mod-check="${esc(key)}"> <span>${esc(label)}</span></label>
        `).join('')}
        <div class="mod-checklist__status" data-check-status>0 / ${checklistItems.length} checks complete</div>
      </div>`;
  }

  function renderPending(rows, names) {
    const holder = panel.querySelector('[data-pending-list]');
    holder.innerHTML = rows.length ? rows.map(row => {
      const p = names.get(row.owner_id);
      return `
        <article class="moderation-card moderation-card--v74" data-moderation-photo="${esc(row.id)}">
          <div class="moderation-card__image">
            <a href="${esc(row.image_url)}" target="_blank" rel="noopener" title="Open full image">
              <img src="${esc(row.image_url)}" alt="${esc(row.alt_text || row.aircraft_type || 'Pending aviation photo')}">
            </a>
            <em>PENDING</em>
          </div>
          <div class="moderation-card__body">
            <span>${esc(backend.formatDate(row.created_at))} · @${esc(p?.username || 'member')}</span>
            <h3>${esc(row.aircraft_type || 'Unknown aircraft')}</h3>
            <p>${esc(row.airline || 'Unknown')} · ${esc(row.registration || 'Unknown')} · ${esc(row.airport || 'Unknown')}</p>
            <small>Submitted by ${esc(row.photographer_name || p?.display_name || 'Unknown')}</small>
            ${row.caption ? `<p class="moderation-note-hint">Caption: ${esc(row.caption)}</p>` : ''}
            ${checklistMarkup(row.id)}
            <div class="moderation-card__actions">
              <button class="solid-button" type="button" data-approve="${esc(row.id)}" disabled>Approve · complete checks first</button>
              <button class="outline-button" type="button" data-reject="${esc(row.id)}">Reject</button>
              <a class="mini-button" href="${esc(row.image_url)}" target="_blank" rel="noopener">Full image ↗</a>
            </div>
            <div class="moderation-reject" data-reject-box="${esc(row.id)}" hidden>
              <select class="control" data-reject-reason>
                <option value="">Choose reason…</option>
                <option>Ownership / rights</option>
                <option>AI / synthetic image</option>
                <option>Technical quality</option>
                <option>Aviation subject / composition</option>
                <option>Watermark / destructive edit</option>
                <option>Incorrect metadata</option>
                <option>Duplicate / near-duplicate</option>
                <option>Safety / privacy / legality</option>
                <option>Other</option>
              </select>
              <textarea class="control" maxlength="500" data-reject-note placeholder="Useful note for the photographer — what should they fix?"></textarea>
              <button class="mini-button danger" type="button" data-confirm-reject="${esc(row.id)}">Reject with note</button>
            </div>
            <div class="mod-error" data-mod-error="${esc(row.id)}"></div>
          </div>
        </article>`;
    }).join('') : '<div class="moderation-empty">Runway clear. No community photos waiting.</div>';

    holder.querySelectorAll('[data-checklist]').forEach(list => {
      const id = list.dataset.checklist;
      const approveButton = holder.querySelector(`[data-approve="${CSS.escape(id)}"]`);
      const status = list.querySelector('[data-check-status]');
      const boxes = [...list.querySelectorAll('[data-mod-check]')];

      const sync = () => {
        const checked = boxes.filter(x => x.checked).length;
        const complete = checked === boxes.length;
        status.textContent = `${checked} / ${boxes.length} checks complete`;
        list.classList.toggle('is-complete', complete);
        approveButton.disabled = !complete;
        approveButton.textContent = complete ? 'Approve photograph' : 'Approve · complete checks first';
      };
      boxes.forEach(box => box.addEventListener('change', sync));
      sync();
    });

    holder.querySelectorAll('[data-approve]').forEach(b => {
      b.addEventListener('click', () => approve(b.dataset.approve));
    });

    holder.querySelectorAll('[data-reject]').forEach(b => {
      b.addEventListener('click', () => {
        const box = holder.querySelector(`[data-reject-box="${CSS.escape(b.dataset.reject)}"]`);
        box.hidden = !box.hidden;
      });
    });

    holder.querySelectorAll('[data-confirm-reject]').forEach(b => {
      b.addEventListener('click', () => {
        const box = holder.querySelector(`[data-reject-box="${CSS.escape(b.dataset.confirmReject)}"]`);
        const reason = box.querySelector('[data-reject-reason]').value;
        const note = box.querySelector('[data-reject-note]').value;
        reject(b.dataset.confirmReject, reason, note);
      });
    });
  }

  async function approve(id) {
    const button = panel.querySelector(`[data-approve="${CSS.escape(id)}"]`);
    const errorNode = panel.querySelector(`[data-mod-error="${CSS.escape(id)}"]`);
    if (button.disabled) return;

    errorNode.textContent = '';
    button.disabled = true;
    button.textContent = 'Clearing for archive…';

    const r = await db.from('photos').update({
      status:'approved',
      moderation_note:'',
      approved_at:new Date().toISOString(),
      approved_by:user.id
    }).eq('id', id).eq('status', 'pending');

    if (r.error) {
      errorNode.textContent = r.error.message;
      button.disabled = false;
      button.textContent = 'Approve photograph';
      return;
    }

    backend.invalidateContent();
    await loadQueue();
  }

  async function reject(id, reason, note) {
    const errorNode = panel.querySelector(`[data-mod-error="${CSS.escape(id)}"]`);
    const cleanReason = String(reason || '').trim();
    const cleanNote = String(note || '').trim();

    errorNode.textContent = '';
    if (!cleanReason) {
      errorNode.textContent = 'Choose a rejection reason first.';
      return;
    }
    if (cleanNote.length < 5) {
      errorNode.textContent = 'Leave a useful note for the photographer (at least 5 characters).';
      return;
    }

    const combined = `${cleanReason}: ${cleanNote}`.slice(0, 500);
    const r = await db.from('photos').update({
      status:'rejected',
      moderation_note:combined,
      approved_at:null,
      approved_by:user.id
    }).eq('id', id).eq('status', 'pending');

    if (r.error) {
      errorNode.textContent = r.error.message;
      return;
    }

    backend.invalidateContent();
    await loadQueue();
  }

  function renderReports(rows, names, commentMap, contentMap) {
    const holder = panel.querySelector('[data-report-list]');
    holder.innerHTML = rows.length ? rows.map(row => {
      const comment = row.comment_id ? commentMap.get(row.comment_id) : null;
      const contentId = row.content_id || comment?.content_id || null;
      const content = contentId ? contentMap.get(contentId) : null;
      const owner = content?.owner_id ? names.get(content.owner_id) : null;
      const href = content?.registration === backend.META_POST && owner?.username
        ? `profile.html?photographer=${encodeURIComponent(owner.username)}`
        : contentId
          ? `gallery.html?photo=${encodeURIComponent(contentId)}`
          : '#';
      const kind = row.comment_id ? 'COMMENT' : content?.registration === backend.META_POST ? 'POST' : 'PHOTO';

      return `
        <article class="report-card">
          <span>${kind} · ${esc(backend.formatDate(row.created_at))} · from @${esc(names.get(row.reporter_id)?.username || 'member')}</span>
          ${comment ? `<small>Reported comment: “${esc(comment.body)}”</small>` : ''}
          <p>${esc(row.reason || 'No reason supplied')}</p>
          <div>
            <a href="${href}" target="_blank" rel="noopener">Open item ↗</a>
            <button class="mini-button" type="button" data-resolve-report="${esc(row.id)}">Mark resolved</button>
          </div>
        </article>`;
    }).join('') : '<div class="moderation-empty">No open reports.</div>';

    holder.querySelectorAll('[data-resolve-report]').forEach(b => {
      b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await db.from('reports').update({
          status:'resolved',
          resolved_at:new Date().toISOString(),
          resolved_by:user.id
        }).eq('id', b.dataset.resolveReport);
        if (!r.error) await loadQueue();
        else b.disabled = false;
      });
    });
  }

  init().catch(error => console.warn('V7.4 moderation unavailable', error));
})();
