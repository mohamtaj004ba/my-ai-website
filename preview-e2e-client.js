(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const q = new URLSearchParams(window.location.search);
  const bypass =
    q.get('x-vercel-protection-bypass') ||
    q.get('_vercel_share') ||
    '';

  const out = (message, ok = true) => {
    const el = byId('out');
    if (!el) return;
    el.textContent = message;
    el.className = ok ? 'ok' : 'err';
  };

  const value = (id) => {
    const el = byId(id);
    return el ? String(el.value || '').trim() : '';
  };

  const api = (action) => {
    const params = new URLSearchParams({ action });
    // Only forward the automation bypass parameter to the application API.
    // _vercel_share is handled by Vercel's auth cookie and should not be
    // forwarded as an application query parameter.
    const automationBypass = q.get('x-vercel-protection-bypass');
    if (automationBypass) params.set('x-vercel-protection-bypass', automationBypass);
    return '/api/account?' + params.toString();
  };

  async function post(action, body, secretRequired = false) {
    const headers = { 'content-type': 'application/json' };
    if (secretRequired) {
      const secret = value('secret');
      if (!secret) throw new Error('Enter the Preview bootstrap secret first.');
      headers['x-bootstrap-secret'] = secret;
    }

    const response = await fetch(api(action), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store'
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data.error || data.message || text || ('HTTP ' + response.status);
      throw new Error(detail);
    }
    return data;
  }

  async function run(button, loadingText, task) {
    if (!button) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = loadingText;
    out(loadingText + '…');
    try {
      await task();
    } catch (error) {
      out(error && error.message ? error.message : String(error), false);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  const create = byId('create');
  const promote = byId('promote');
  const login = byId('login');

  if (!create || !seed || !promote || !login) {
    out('Launcher failed to initialize. Refresh the page.', false);
    return;
  }

  create.addEventListener('click', () => run(create, 'Creating workspace', async () => {
    const data = await post('bootstrap-preview', {
      email: value('email'),
      businessName: value('business'),
      plan: value('plan')
    }, true);

    out(
      'Workspace created.\n' +
      'Workspace ID: ' + (data.workspaceId || '(created)') + '\n' +
      'Email: ' + (data.email || value('email')) + '\n' +
      'Plan: ' + (data.plan || value('plan'))
    );
  }));

  seed.addEventListener('click', () => run(seed, 'Loading 60-day dataset', async () => {
    const data = await post('seed-preview-data', { email: value('email') }, true);
    out(
      'Realistic business dataset loaded.\n' +
      'Business: ' + data.businessName + '\n' +
      'History: ' + data.days + ' days\n' +
      'Calls: ' + data.calls + '\n' +
      'Leads: ' + data.leads + '\n' +
      'Conversations: ' + data.conversations + '\n' +
      'Admin workspaces: ' + data.adminClients + '\n' +
      'Plan: ' + data.plan
    );
  }));

  promote.addEventListener('click', () => run(promote, 'Promoting user', async () => {
    const data = await post('promote-preview-admin', { email: value('email') }, true);
    out('Preview user promoted to admin.\n' + JSON.stringify(data, null, 2));
  }));

  login.addEventListener('click', () => run(login, 'Sending login link', async () => {
    await post('request', { email: value('email'), next: '/dashboard' }, false);
    out('Magic login link requested. Check the test mailbox.');
  }));

  out('Ready.');
})();