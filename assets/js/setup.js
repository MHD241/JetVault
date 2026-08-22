(() => {
  const backend = window.ScottishAeroBackend;
  const client = backend?.client;
  const form = document.querySelector('[data-setup-form]');
  const globalStatus = document.querySelector('[data-setup-global]');
  const button = document.querySelector('[data-create-accounts]');
  const accounts = [
    { username: 'mohammed', email: 'mohammed@scottish.aero', name: 'Mohammed Shnina' },
    { username: 'ellis', email: 'ellis@scottish.aero', name: 'Ellis Martin' },
    { username: 'arran', email: 'arran@scottish.aero', name: 'Arran Gordon' }
  ];

  const status = (username, text, ok = false) => {
    const el = document.querySelector(`[data-status="${username}"]`);
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? '#9cebc4' : '#ffc0c5';
  };

  if (!client) {
    globalStatus.textContent = 'Supabase is not connected. Complete steps 1–3 in SUPABASE-SETUP.md first.';
    globalStatus.classList.add('show');
    button.disabled = true;
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true; button.textContent = 'Creating crew accounts…';
    globalStatus.classList.remove('show');
    let successes = 0;

    for (const account of accounts) {
      const input = form.querySelector(`[name="password_${account.username}"]`);
      const password = input.value;
      if (password.length < 10) {
        status(account.username, 'Password must be at least 10 characters.');
        continue;
      }
      status(account.username, 'Creating…');
      const { error } = await client.auth.signUp({
        email: account.email,
        password,
        options: { data: { display_name: account.name } }
      });
      if (error) {
        status(account.username, error.message.includes('registered') ? 'Already created.' : error.message, error.message.includes('registered'));
      } else {
        successes += 1;
        status(account.username, 'Created ✓', true);
      }
      await client.auth.signOut();
    }

    globalStatus.textContent = successes
      ? `Created ${successes} account${successes === 1 ? '' : 's'}. You can now use admin.html.`
      : 'No new accounts were created. Existing accounts are safe; check the row messages above.';
    globalStatus.classList.add('show');
    button.disabled = false; button.textContent = 'Create the three accounts';
  });
})();
