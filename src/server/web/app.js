'use strict';
// QVox panel — vanilla JS, no dependencies.
const $ = (id) => document.getElementById(id);
const KEY_STORE = 'qvox.apikey';

function headers(json) {
  const h = {};
  const k = localStorage.getItem(KEY_STORE);
  if (k) h['x-api-key'] = k;
  if (json) h['content-type'] = 'application/json';
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(opts.body && !(opts.body instanceof Blob)), ...(opts.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res;
}

async function refresh() {
  try {
    const s = await (await api('/api/status')).json();
    document.title = (s.brand || 'QVox') + ' · panel';
    const up = s.engine.up;
    $('dot').className = 'dot ' + (up ? 'up' : 'down');
    $('status').innerHTML =
      `engine: <b>${up ? 'up' : 'down'}</b> · backend: <b>${s.engine.backend}</b><br>` +
      `host: <b>${s.host}:${s.port}</b> · protected: <b>${s.protected ? 'yes' : 'no'}</b>`;
    $('models').innerHTML = Object.entries(s.models)
      .filter(([k]) => k !== 'defaultRole')
      .map(([k, v]) => `${k}: <b>${v}</b>`).join('<br>');
    $('foot').textContent = `${s.brand} · backend ${s.engine.backend}`;
  } catch (e) {
    $('status').innerHTML = `<span style="color:#ff6b6b">error: ${e.message}</span>`;
  }
  try {
    const c = await (await api('/api/config')).json();
    $('config').textContent = JSON.stringify(c, null, 2);
  } catch { /* ignore */ }
}

// emotion/style chips -> fill the instruct field
$('chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  $('instruct').value = chip.dataset.i;
  $('instruct').focus();
});

$('savekey').onclick = () => {
  localStorage.setItem(KEY_STORE, $('apikey').value.trim());
  refresh();
};

$('restart').onclick = async () => {
  $('restart').textContent = 'restarting…';
  try { await api('/api/engine/restart', { method: 'POST' }); } catch (e) { alert(e.message); }
  $('restart').textContent = 'restart engine';
  refresh();
};

$('speak').onclick = async () => {
  const body = {
    input: $('text').value,
    language: $('lang').value || 'Spanish',
    temperature: Number($('temp').value) || 0.7,
  };
  if ($('instruct').value.trim()) body.instruct = $('instruct').value.trim();
  if ($('clone').value.trim()) body.clone = $('clone').value.trim();
  $('speak-status').textContent = 'generating…';
  const t0 = Date.now();
  try {
    const res = await api('/v1/audio/speech', { method: 'POST', body: JSON.stringify(body), headers: headers(true) });
    const blob = await res.blob();
    $('player').src = URL.createObjectURL(blob);
    $('player').play();
    $('speak-status').textContent = `done (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
  } catch (e) {
    $('speak-status').textContent = 'error: ' + e.message;
  }
};

$('apikey').value = localStorage.getItem(KEY_STORE) || '';
refresh();
setInterval(refresh, 8000);
