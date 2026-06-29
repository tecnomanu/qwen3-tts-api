'use strict';
// QVox panel — vanilla JS, no dependencies.
const $ = (id) => document.getElementById(id);
const KEY_STORE = 'qvox.apikey';
let HOST = location.host || '127.0.0.1:5111';

function getKey() { return localStorage.getItem(KEY_STORE) || ''; }
function setKey(k) { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); }
function mask(k) { return k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : k; }

function headers(json) {
  const h = {};
  const k = getKey();
  if (k) h['x-api-key'] = k;
  if (json) h['content-type'] = 'application/json';
  return h;
}
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(opts.body && !(opts.body instanceof Blob)), ...(opts.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res;
}

const BADGE = {
  installed: ['<i class="ph ph-check-circle"></i>', 'installed', '#7ef0c2'],
  cached: ['<i class="ph ph-cloud"></i>', 'cached', '#6ea8fe'],
  not_installed: ['<i class="ph ph-download-simple"></i>', 'not installed', '#8b93a7'],
};

// ---------- status / refresh ----------
async function refresh() {
  try {
    const s = await (await api('/api/status')).json();
    document.title = (s.brand || 'QVox') + ' · panel';
    const up = s.engine.up;
    $('dot').className = 'dot ' + (up ? 'up' : 'down');
    $('status-mini').textContent = `engine ${up ? 'up' : 'down'} · ${s.engine.backend}`;
    $('status').innerHTML = `host: <b>${s.host}:${s.port}</b><br>backend: <b>${s.engine.backend}</b>`;
    $('engine').value = s.engine.backend;
    $('prot-status').innerHTML = `protected: <b>${s.protected ? 'yes' : 'no'}</b>`;
    $('foot').textContent = `${s.brand} · ${s.engine.backend}`;
    renderKey();
    renderExamples();
  } catch (e) {
    $('status').innerHTML = `<span style="color:#ff6b6b">error: ${e.message}</span>`;
  }
  renderModels();
}

async function renderModels() {
  try {
    const { models } = await (await api('/api/models')).json();
    $('models').innerHTML = models.map((m) => {
      const [icon, text, color] = BADGE[m.state] || BADGE.not_installed;
      const size = m.sizeMB ? ` · ${m.sizeMB} MB` : '';
      const loaded = m.loaded ? ' <span class="loaded">loaded</span>' : '';
      return `<div class="model"><div class="model-top"><b>${m.role}</b>
        <span class="badge" style="color:${color};border-color:${color}33">${icon} ${text}${loaded}</span></div>
        <div class="model-id">${m.id}${size}</div></div>`;
    }).join('');
  } catch (e) { $('models').innerHTML = `<span class="muted">${e.message}</span>`; }
}

// ---------- API key management ----------
function renderKey() {
  const k = getKey();
  $('keyview').value = k ? mask(k) : '';
}
$('key-gen').onclick = async () => {
  const k = 'qvox_' + Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
  await api('/api/config', { method: 'POST', body: JSON.stringify({ apiKey: k }), headers: headers(true) });
  setKey(k);
  renderKey(); refresh();
};
$('key-del').onclick = async () => {
  await api('/api/config', { method: 'POST', body: JSON.stringify({ apiKey: '' }), headers: headers(true) });
  setKey('');
  renderKey(); refresh();
};
$('key-copy').onclick = () => { if (getKey()) copy(getKey(), $('key-copy')); };

// ---------- engine selector ----------
$('restart').onclick = async () => {
  $('restart').disabled = true;
  $('restart').innerHTML = '<i class="ph ph-circle-notch"></i> applying…';
  try {
    await api('/api/config', { method: 'POST', body: JSON.stringify({ 'engine.backend': $('engine').value }), headers: headers(true) });
    await api('/api/engine/restart', { method: 'POST' });
  } catch (e) { alert(e.message); }
  $('restart').disabled = false;
  $('restart').innerHTML = '<i class="ph ph-arrow-clockwise"></i> apply / restart';
  refresh();
};

// ---------- emotion tags ----------
$('chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const ta = $('text'), tag = `[${chip.dataset.tag}] `;
  const p = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, p) + tag + ta.value.slice(ta.selectionEnd ?? p);
  ta.focus(); ta.selectionStart = ta.selectionEnd = p + tag.length;
});

// ---------- generate ----------
$('speak').onclick = async () => {
  const body = { input: $('text').value, language: $('lang').value || 'Spanish', temperature: Number($('temp').value) || 0.7 };
  if ($('instruct').value.trim()) body.instruct = $('instruct').value.trim();
  if ($('clone').value.trim()) body.clone = $('clone').value.trim();
  $('speak-status').textContent = 'generating…';
  const t0 = Date.now();
  try {
    const res = await api('/v1/audio/speech', { method: 'POST', body: JSON.stringify(body), headers: headers(true) });
    const url = URL.createObjectURL(await res.blob());
    $('player').src = url; $('player').play();
    const dl = $('download'); dl.href = url; dl.download = `qvox-${Date.now()}.wav`; dl.style.display = 'inline-block';
    $('speak-status').textContent = `done (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
  } catch (e) { $('speak-status').textContent = 'error: ' + e.message; }
};

// ---------- API examples ----------
function examples() {
  const url = `http://${HOST}/v1/audio/speech`;
  const hdrKey = getKey() ? mask(getKey()) : 'YOUR_KEY';
  return {
    curl: `curl -X POST ${url} \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${hdrKey}" \\
  -d '{"input":"Hello from QVox","instruct":"A warm voice"}' \\
  --output out.wav`,
    js: `const res = await fetch("${url}", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "${hdrKey}" },
  body: JSON.stringify({ input: "Hello from QVox", instruct: "A warm voice" })
});
const blob = await res.blob(); // audio/wav`,
    python: `import requests
r = requests.post("${url}",
    headers={"x-api-key": "${hdrKey}"},
    json={"input": "Hello from QVox", "instruct": "A warm voice"})
open("out.wav", "wb").write(r.content)`,
    php: `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["content-type: application/json", "x-api-key: ${hdrKey}"],
  CURLOPT_POSTFIELDS => json_encode(["input" => "Hello from QVox", "instruct" => "A warm voice"]),
  CURLOPT_RETURNTRANSFER => true,
]);
file_put_contents("out.wav", curl_exec($ch));`,
  };
}
let exLang = 'curl';
function renderExamples() { $('ex-code').textContent = examples()[exLang]; }
$('ex-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab'); if (!t) return;
  exLang = t.dataset.ex;
  [...$('ex-tabs').children].forEach((c) => c.classList.toggle('active', c === t));
  renderExamples();
});
$('ex-copy').onclick = () => copy(examples()[exLang], $('ex-copy'));

// ---------- helpers ----------
function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-check"></i>';
    setTimeout(() => { btn.innerHTML = old; }, 1200);
  });
}

refresh();
setInterval(refresh, 8000);
