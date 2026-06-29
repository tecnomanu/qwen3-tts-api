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
    $('foot-ver').textContent = 'v' + (s.version || '?');
    renderKey();
    renderExamples();
  } catch (e) {
    $('status').innerHTML = `<span style="color:#ff6b6b">error: ${e.message}</span>`;
  }
  renderModels();
  renderVoices();
}

async function renderVoices() {
  try {
    const { voices } = await (await api('/v1/voices')).json();
    const sel = $('voice'); const cur = sel.value;
    const list = voices || [];
    const none = list.length ? '— none (use base voice) —' : '— none · CustomVoice not installed —';
    sel.innerHTML = `<option value="">${none}</option>` + list.map((v) => `<option>${v}</option>`).join('');
    sel.value = cur;
  } catch { /* ignore */ }
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

// ---------- presets (set text + base voice + language; no clone, no tags) ----------
const PRESETS = [
  { name: 'Radio AR', lang: 'Spanish', instruct: 'A excited Argentine man, rio platense accent', text: '¡Estás escuchando los clásicos de La 100, la radio más escuchada de Buenos Aires! Todos los éxitos, todo el día.' },
  { name: 'Cuento ES', lang: 'Spanish', instruct: 'A warm storyteller, gentle and slow, neutral Spanish', text: 'Había una vez, en un pueblo muy lejano, una niña que soñaba con poder volar.' },
  { name: 'News EN', lang: 'English', instruct: 'A professional male news anchor, neutral American accent', text: "Good evening. Here are tonight's top stories." },
  { name: 'Podcast EN', lang: 'English', instruct: 'A friendly podcast host, warm casual tone', text: 'Hey everyone, welcome back to the show. Today we have a great episode for you.' },
  { name: 'Calm EN', lang: 'English', instruct: 'A soft calm female voice, soothing and slow', text: 'Take a deep breath. Everything is going to be okay.' },
  { name: 'Hype EN', lang: 'English', instruct: 'An energetic hype announcer, loud and excited', text: "Are you ready? Let's go!" },
  { name: 'Brasil PT', lang: 'Portuguese', instruct: 'A cheerful Brazilian man, Rio de Janeiro accent', text: 'E aí, galera! Sejam muito bem-vindos ao programa de hoje.' },
  { name: 'Français', lang: 'French', instruct: 'A warm French man, Parisian accent', text: 'Bonjour à tous et bienvenue dans notre émission.' },
  { name: 'Italiano', lang: 'Italian', instruct: 'A passionate Italian man, warm tone', text: 'Ciao a tutti, benvenuti! Oggi vi racconto una storia.' },
  { name: 'Deutsch', lang: 'German', instruct: 'A calm German male voice, clear and friendly', text: 'Guten Abend und herzlich willkommen zur Sendung.' },
];
$('presets').innerHTML = PRESETS.map((p, i) =>
  `<button type="button" class="preset" data-i="${i}"><i class="ph ph-quotes"></i> ${p.name}</button>`).join('');
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('.preset'); if (!b) return;
  const p = PRESETS[+b.dataset.i];
  $('text').value = p.text;
  $('instruct').value = p.instruct;
  $('lang').value = p.lang;
  $('clone').value = '';
  $('voice').value = '';
  renderExamples();
});

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
function currentBody() {
  const b = { input: $('text').value, language: $('lang').value || 'Spanish', temperature: Number($('temp').value) || 0.7 };
  if ($('instruct').value.trim()) b.instruct = $('instruct').value.trim();
  if ($('voice').value) b.voice = $('voice').value;
  if ($('clone').value.trim()) b.clone = $('clone').value.trim();
  return b;
}

$('speak').onclick = async () => {
  const body = currentBody();
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
  const body = currentBody();
  const json = JSON.stringify(body);
  const jsonPretty = JSON.stringify(body, null, 2);
  return {
    curl: `curl -X POST ${url} \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${hdrKey}" \\
  -d '${json.replace(/'/g, "'\\''")}' \\
  --output out.wav`,
    js: `const res = await fetch("${url}", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "${hdrKey}" },
  body: JSON.stringify(${jsonPretty})
});
const blob = await res.blob(); // audio/wav`,
    python: `import requests
r = requests.post("${url}",
    headers={"x-api-key": "${hdrKey}"},
    json=${jsonPretty.replace(/true/g, 'True').replace(/false/g, 'False')})
open("out.wav", "wb").write(r.content)`,
    php: `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["content-type: application/json", "x-api-key: ${hdrKey}"],
  CURLOPT_POSTFIELDS => '${json.replace(/'/g, "\\'")}',
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

// live-update the examples as the form changes
['text', 'lang', 'temp', 'instruct', 'voice', 'clone'].forEach((id) =>
  $(id).addEventListener('input', renderExamples));

refresh();
setInterval(refresh, 8000);
