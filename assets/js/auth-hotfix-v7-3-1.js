(() => {
  if (window.__SCOTTISH_AERO_AUTH_HOTFIX_V732__) return;
  window.__SCOTTISH_AERO_AUTH_HOTFIX_V732__ = true;

  const backend = window.ScottishAeroBackend;
  if (!backend?.configured) return;

  const accountEmails = {
    mohammed: 'mohammed@scottish.aero',
    ellis: 'ellis@scottish.aero',
    arran: 'arran@scottish.aero'
  };

  const setMessage = (node, text, ok = false) => {
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('show', Boolean(text));
    node.classList.toggle('form-success', Boolean(text) && ok);
    node.classList.toggle('form-error', Boolean(text) && !ok);
  };

  const currentCrewKey = () => {
    const shown = String(document.querySelector('[data-profile-name]')?.textContent || '')
      .trim().toLowerCase();
    if (shown.startsWith('mohammed')) return 'mohammed';
    if (shown.startsWith('ellis')) return 'ellis';
    if (shown.startsWith('arran')) return 'arran';
    return '';
  };

  async function install() {
    const db = await backend.ensureClient().catch(() => null);
    if (!db?.auth) return;

    // A normal sign-out should only clear this browser/device.
    if (!db.auth.__saLocalLogoutPatched) {
      const originalSignOut = db.auth.signOut.bind(db.auth);
      db.auth.signOut = (options) => {
        if (options && typeof options === 'object' && options.scope) {
          return originalSignOut(options);
        }
        return originalSignOut({ scope: 'local' });
      };
      Object.defineProperty(db.auth, '__saLocalLogoutPatched', {
        value: true,
        configurable: false,
        enumerable: false
      });
    }

    const form = document.querySelector('[data-password-form]');
    if (!form || form.dataset.authHotfixV732 === '1') return;
    form.dataset.authHotfixV732 = '1';

    // Rebuild only the security form. The rest of Creator Studio stays untouched.
    form.innerHTML = `
      <div class="field">
        <label>Current password</label>
        <input class="control" type="password" name="current_password"
          autocomplete="current-password" placeholder="Your current password" required>
      </div>
      <div class="field">
        <label>New password</label>
        <input class="control" type="password" name="new_password"
          autocomplete="new-password" placeholder="10+ characters" required>
      </div>
      <div class="field">
        <label>Confirm new password</label>
        <input class="control" type="password" name="confirm_password"
          autocomplete="new-password" placeholder="Type it again" required>
      </div>
      <div class="form-error" data-password-message></div>
      <button class="outline-button" type="submit">Change password</button>
    `;

    form.addEventListener('submit', async event => {
      // This capture listener replaces the older admin.js password handler.
      event.preventDefault();
      event.stopImmediatePropagation();

      const fd = new FormData(form);
      const currentPassword = String(fd.get('current_password') || '');
      const newPassword = String(fd.get('new_password') || '');
      const confirmPassword = String(fd.get('confirm_password') || '');
      const message = form.querySelector('[data-password-message]');
      const button = form.querySelector('button[type="submit"]');

      setMessage(message, '');

      if (!currentPassword) {
        setMessage(message, 'Enter your current password first.');
        return;
      }
      if (newPassword.length < 10) {
        setMessage(message, 'Use at least 10 characters for the new password.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage(message, 'The two new passwords do not match.');
        return;
      }
      if (newPassword === currentPassword) {
        setMessage(message, 'Choose a new password that is different from the current one.');
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Verifying current password…';
      }

      try {
        // A revoked/stale browser session can still contain the user email locally.
        // If it does not, fall back to the known crew account mapping.
        const sessionResult = await db.auth.getSession();
        const cachedEmail = sessionResult?.data?.session?.user?.email || '';
        const crewKey = currentCrewKey();
        const email = cachedEmail || accountEmails[crewKey] || '';

        if (!email) {
          setMessage(message, 'Could not identify this crew account. Sign in again and retry.');
          return;
        }

        // IMPORTANT: do not trust the cached session. Re-authenticate with the
        // current password to create a fresh server-valid session first.
        const signIn = await db.auth.signInWithPassword({
          email,
          password: currentPassword
        });

        if (signIn.error || !signIn.data?.session) {
          const invalid = signIn.error?.code === 'invalid_credentials' ||
            /invalid login credentials/i.test(signIn.error?.message || '');
          setMessage(
            message,
            invalid
              ? 'Current password is incorrect.'
              : (signIn.error?.message || 'Could not verify the current password.')
          );
          return;
        }

        if (button) button.textContent = 'Changing password…';

        const updated = await db.auth.updateUser({ password: newPassword });
        if (updated.error) {
          setMessage(message, updated.error.message || 'Password change failed.');
          return;
        }

        form.reset();
        setMessage(message, 'Password changed successfully. This device stays signed in.', true);
        window.dispatchEvent(new CustomEvent('sa:auth-changed'));
      } catch (error) {
        setMessage(message, error?.message || 'Password change failed.');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Change password';
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install().catch(() => {}), { once: true });
  } else {
    install().catch(() => {});
  }
})();
