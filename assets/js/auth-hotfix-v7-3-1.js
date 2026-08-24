(() => {
  if (window.__SCOTTISH_AERO_AUTH_HOTFIX_V731__) return;
  window.__SCOTTISH_AERO_AUTH_HOTFIX_V731__ = true;

  const backend = window.ScottishAeroBackend;
  if (!backend?.configured) return;

  const setMessage = (node, text, ok = false) => {
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('show', Boolean(text));
    node.classList.toggle('form-success', Boolean(text) && ok);
    node.classList.toggle('form-error', Boolean(text) && !ok);
  };

  async function install() {
    const db = await backend.ensureClient().catch(() => null);
    if (!db?.auth) return;

    // V7.3.1: a normal website sign-out should only sign out this browser/device.
    // This stops one crew member logging out on one device from invalidating another
    // device that is currently editing a profile or changing its password.
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

    // Creator Studio password form: validate/refresh the session before updateUser.
    // We attach in capture phase so this safely replaces the older submit handler
    // without needing to rewrite the whole Creator Studio script.
    const form = document.querySelector('[data-password-form]');
    if (!form || form.dataset.authHotfixV731 === '1') return;
    form.dataset.authHotfixV731 = '1';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const message = document.querySelector('[data-password-message]');
      const button = form.querySelector('button[type="submit"]');
      const password = String(new FormData(form).get('new_password') || '');

      setMessage(message, '');
      if (password.length < 10) {
        setMessage(message, 'Use at least 10 characters.');
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Checking session…';
      }

      try {
        let { data: sessionData, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        let session = sessionData?.session || null;

        if (!session) {
          setMessage(message, 'Your session on this device has ended. Sign in again, then change the password.');
          return;
        }

        // Refresh if the token is close to expiry. This avoids a race where a valid
        // looking cached session expires between opening Account and pressing Save.
        const now = Math.floor(Date.now() / 1000);
        if (!session.expires_at || session.expires_at - now < 90) {
          if (button) button.textContent = 'Refreshing session…';
          const refreshed = await db.auth.refreshSession();
          if (refreshed.error || !refreshed.data?.session) {
            setMessage(message, 'Your session expired. Sign in again, then change the password.');
            return;
          }
          session = refreshed.data.session;
        }

        if (button) button.textContent = 'Changing password…';
        const { error } = await db.auth.updateUser({ password });
        if (error) {
          const expired = error.code === 'session_not_found' || /session (?:not found|missing|expired)/i.test(error.message || '');
          setMessage(message, expired
            ? 'Your session expired before the password could be changed. Sign in again and try once more.'
            : (error.message || 'Password change failed.'));
          return;
        }

        form.reset();
        setMessage(message, 'Password changed successfully.', true);
      } catch (error) {
        const expired = error?.code === 'session_not_found' || /session (?:not found|missing|expired)/i.test(error?.message || '');
        setMessage(message, expired
          ? 'Your session expired. Sign in again, then change the password.'
          : (error?.message || 'Password change failed.'));
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
