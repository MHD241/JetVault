(() => {
  const backend = window.ScottishAeroBackend;
  const form = document.querySelector('[data-web-enquiry-form]');
  if (!form) return;

  const msg = form.querySelector('[data-web-enquiry-message]');
  const button = form.querySelector('button[type="submit"]');

  const say = (text, ok = false) => {
    msg.textContent = text || '';
    msg.classList.toggle('is-success', Boolean(text) && ok);
    msg.classList.toggle('is-error', Boolean(text) && !ok);
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    say('');

    // Quiet honeypot for basic bot noise.
    if (String(form.elements.website?.value || '').trim()) {
      form.reset();
      say('Thanks — your enquiry has been sent.', true);
      return;
    }

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      project_type: String(fd.get('project_type') || 'website'),
      budget: String(fd.get('budget') || '').trim() || null,
      message: String(fd.get('message') || '').trim(),
      page_url: location.href.slice(0, 800)
    };

    if (payload.name.length < 2) return say('Please add your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return say('Please enter a valid email address.');
    if (payload.message.length < 10) return say('Tell Mohammed a little more about the project.');

    button.disabled = true;
    button.textContent = 'Sending enquiry…';

    try {
      if (!backend?.configured) throw new Error('Website enquiries are temporarily offline.');
      const db = await backend.ensureClient();
      if (!db) throw new Error('Website enquiries are temporarily offline.');

      const result = await db.from('website_enquiries').insert(payload);
      if (result.error) throw result.error;

      form.reset();
      say('Sent. Mohammed will be able to see this enquiry privately in Creator Studio.', true);
    } catch (error) {
      say(error?.message || 'Could not send the enquiry. You can still email or WhatsApp Mohammed directly.');
    } finally {
      button.disabled = false;
      button.textContent = 'Send website enquiry ↗';
    }
  });
})();