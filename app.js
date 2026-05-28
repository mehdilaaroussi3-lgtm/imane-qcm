// MICI QCM — single-page app (vanilla JS, hash-based routing)
'use strict';

// Surface ANY runtime error to the page so we never blank-screen silently.
function __showErr(label, err) {
  const el = document.getElementById('app');
  if (!el) return;
  const msg = (err && (err.stack || err.message)) || String(err);
  el.innerHTML = '<div style="margin:20px auto;max-width:640px;padding:18px 20px;border:1px solid #fecaca;background:#fef2f2;border-radius:14px;color:#7f1d1d;font-family:system-ui;font-size:14px;line-height:1.5"><strong>App error (' + label + ')</strong><pre style="margin-top:10px;padding:10px;background:white;border:1px solid #fecaca;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#991b1b">' + (msg + '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</pre><p style="margin-top:8px;font-size:12px">Reload (Cmd+R) or share this with Mehdi.</p></div>';
}
window.addEventListener('error', e => __showErr('window.error', e.error || e.message));
window.addEventListener('unhandledrejection', e => __showErr('promise', e.reason));

const $app = document.getElementById('app');
if (!$app) { document.body.insertAdjacentHTML('afterbegin', '<div style="padding:20px;color:red;font-family:system-ui">FATAL: #app missing from DOM</div>'); }

// ────── Motivational messages (English, addressed to Imane) ──────
const MESSAGES = {
  finish: [
    "Bravo Imane — that was solid! 🌟",
    "Another set down, you're getting closer 💪",
    "What a session — proud of you!",
    "You showed up — that's the win ✨",
    "Closer to that exam, Imane! 🎯",
    "Keep that energy, you're crushing it 💖"
  ],
  perfect: [
    "PERFECT SCORE Imane!!! 💯🔥",
    "Imane, you absolutely destroyed it! 🏆",
    "Future gastroenterologist confirmed 🩺✨",
    "Flawless! I'm so proud of you 💖"
  ],
  click: [
    "You're going to ace this exam, Imane!",
    "Keep going — I believe in you 💖",
    "So proud of you, Imane ✨",
    "Brilliant mind at work 🧠"
  ]
};
function pickMessage(kind) {
  const arr = MESSAGES[kind] || MESSAGES.finish;
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ────── Buddy controller (hidden until QCM-set ends) ──────
const Buddy = {
  el: null, bubble: null, bubbleTimer: null,
  init() {
    this.el = document.getElementById('buddy');
    this.bubble = document.getElementById('buddy-bubble');
    if (!this.el) return;
    this.el.addEventListener('click', () => {
      if (!this.el.classList.contains('visible')) return;
      this._state('wave', 1800);
      this._say(pickMessage('click'), 4000);
    });
  },
  _state(name, duration) {
    if (!this.el) return;
    ['happy','sad','cheer','clap','wave','blink'].forEach(c => this.el.classList.remove(c));
    void this.el.offsetWidth;
    this.el.classList.add(name);
    if (duration) setTimeout(() => this.el.classList.remove(name), duration);
  },
  _say(msg, duration) {
    if (!this.bubble) return;
    this.bubble.textContent = msg;
    this.bubble.classList.add('show');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), duration || 4500);
  },
  surprise(pct) {
    if (!this.el) return;
    let state, kind;
    if (pct === 100) { state = 'cheer'; kind = 'perfect'; }
    else if (pct >= 70) { state = pickFrom(['cheer','clap','happy']); kind = 'finish'; }
    else if (pct >= 50) { state = pickFrom(['clap','happy','wave']);  kind = 'finish'; }
    else                { state = pickFrom(['wave','happy']);         kind = 'finish'; }
    setTimeout(() => {
      this.el.classList.add('visible');
      this._state(state, state === 'cheer' ? 2400 : 1800);
      this._say(pickMessage(kind), 6000);
      let cycles = 0;
      const reCycle = setInterval(() => {
        cycles++;
        this._state(pickFrom(['happy','clap','wave']), 1500);
        if (cycles >= 2) clearInterval(reCycle);
      }, 3200);
    }, 700);
  },
  hide() {
    if (!this.el) return;
    this.el.classList.remove('visible');
    if (this.bubble) this.bubble.classList.remove('show');
    ['happy','sad','cheer','clap','wave','blink'].forEach(c => this.el.classList.remove(c));
  }
};

// ────── Storage ──────
const Storage = {
  KEY: 'mici-qcm-v1',
  load()   { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  save(s)  { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch {} },
  recordChapter(chapter, correct, total) {
    const s = this.load();
    if (!s.chapters) s.chapters = {};
    const cur = s.chapters[chapter] || { sessions: 0, bestCorrect: 0, bestTotal: 0 };
    cur.sessions += 1;
    cur.lastCorrect = correct; cur.lastTotal = total;
    if (!cur.bestTotal || correct / total > cur.bestCorrect / cur.bestTotal) {
      cur.bestCorrect = correct; cur.bestTotal = total;
    }
    s.chapters[chapter] = cur;
    this.save(s);
  },
  recordExam(correct, total, sec) {
    const s = this.load();
    if (!s.exams) s.exams = [];
    s.exams.unshift({ correct, total, sec, date: new Date().toISOString() });
    s.exams = s.exams.slice(0, 20);
    this.save(s);
  }
};

// ────── Data loading ──────
let META = null;
const chapterCache = new Map();

async function loadMeta() {
  if (META) return META;
  const r = await fetch('data/index.json');
  if (!r.ok) throw new Error('index.json failed: ' + r.status);
  META = await r.json();
  return META;
}
async function loadChapter(id) {
  if (chapterCache.has(id)) return chapterCache.get(id);
  const safeId = id.replace(/-/g, '_');
  try {
    const r = await fetch('data/chapters/ch' + safeId + '.json');
    if (!r.ok) throw new Error('chapter ' + id + ' failed: ' + r.status);
    const data = await r.json();
    chapterCache.set(id, data);
    return data;
  } catch (e) {
    console.warn(e);
    const empty = { chapter: id, title: (META && META.chapterMeta && META.chapterMeta[id] && META.chapterMeta[id].title) || ('Chapitre ' + id), questions: [] };
    chapterCache.set(id, empty);
    return empty;
  }
}
async function loadAllChapters() {
  await loadMeta();
  return Promise.all(Object.keys(META.chapterMeta).map(loadChapter));
}

// ────── Helpers ──────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function arraysEqual(a, b) {
  if (!b || !b.length) return false;
  const x = [...a].sort().join(',');
  const y = [...b].sort().join(',');
  return x === y;
}
const THEME_COLORS = {
  indigo:  { ring: 'ring-indigo-200',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  grad: 'from-indigo-500 to-violet-500' },
  sky:     { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-700',     grad: 'from-sky-500 to-cyan-500' },
  rose:    { ring: 'ring-rose-200',    bg: 'bg-rose-50',    text: 'text-rose-700',    grad: 'from-rose-500 to-pink-500' },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', grad: 'from-emerald-500 to-teal-500' },
  amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-700',   grad: 'from-amber-500 to-orange-500' },
};
function colorOf(c) { return THEME_COLORS[c] || THEME_COLORS.sky; }

// ────── Router ──────
const routes = [];
function on(pattern, handler) { routes.push({ pattern, handler }); }

function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, query] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query || '') };
}

async function render() {
  try {
    const { path, params } = parseHash();
    Buddy.hide(); // hide buddy on any navigation
    for (const { pattern, handler } of routes) {
      const m = path.match(pattern);
      if (m) {
        await handler(m, params);
        window.scrollTo({ top: 0 });
        return;
      }
    }
    $app.innerHTML = '<div class="text-center py-16"><p class="text-slate-600 mb-3">Page introuvable</p><a href="#/" class="text-sky-600 font-medium underline">Retour à l\'accueil</a></div>';
  } catch (err) {
    console.error('Render error:', err);
    $app.innerHTML = '<div class="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-800"><p class="font-semibold mb-1">Erreur de chargement</p><p class="text-sm">' + esc(err.message || String(err)) + '</p><p class="text-xs mt-3 text-rose-600">Rechargez la page (Cmd+R).</p></div>';
  }
}

// ────── View: Home ──────
on(/^\/$/, async () => {
  const meta = await loadMeta();
  const stats = Storage.load();
  const totalSessions = Object.values(stats.chapters || {}).reduce((a, c) => a + (c.sessions || 0), 0);
  const totalQuestions = Object.values(meta.chapterMeta || {}).length;

  let themesHtml = '';
  for (const t of meta.themes) {
    const c = colorOf(t.color);
    const n = t.chapters.length;
    themesHtml += `
      <a href="#/theme/${t.id}" class="card-hover group block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center text-white shadow-sm shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${t.icon}"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-tight">${esc(t.title)}</h3>
            <p class="text-[13px] text-slate-500 mt-1 leading-snug">${esc(t.subtitle)}</p>
            <p class="text-[12px] ${c.text} mt-2.5 font-semibold">${n} chapitre${n > 1 ? 's' : ''} →</p>
          </div>
        </div>
      </a>`;
  }

  $app.innerHTML = `
    <section class="text-center mb-8 fade-in">
      <p class="text-[11px] font-bold uppercase tracking-[0.15em] text-sky-600 mb-2">Préparation Examen · Gastro-entérologie</p>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight max-w-2xl mx-auto">${esc(meta.title)}</h1>
      <p class="mt-3 text-slate-600 text-[15px] max-w-xl mx-auto">${esc(meta.subtitle)}</p>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 fade-in">
      <a href="#/mixed" class="card-hover block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white mb-3 shadow-sm">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        </div>
        <h3 class="font-bold text-slate-900">Mode Mixte</h3>
        <p class="text-[13px] text-slate-500 mt-1">20 QCM tirés au hasard parmi tous les chapitres.</p>
      </a>
      <a href="#/exam" class="card-hover block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white mb-3 shadow-sm">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h3 class="font-bold text-slate-900">Examen Blanc</h3>
        <p class="text-[13px] text-slate-500 mt-1">40 QCM · 60 min · correction à la fin.</p>
      </a>
      <a href="#/stats" class="card-hover block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white mb-3 shadow-sm">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17v-6m6 6V7m6 10v-4m6 4V11"/></svg>
        </div>
        <h3 class="font-bold text-slate-900">Mes Statistiques</h3>
        <p class="text-[13px] text-slate-500 mt-1">${totalSessions} session(s) · ${totalQuestions} chapitres dispo.</p>
      </a>
    </section>

    <section class="fade-in">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Thèmes</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${themesHtml}</div>
    </section>
  `;
});

// ────── View: Theme ──────
on(/^\/theme\/([^/]+)$/, async ([, themeId]) => {
  const meta = await loadMeta();
  const theme = meta.themes.find(t => t.id === themeId);
  if (!theme) { $app.innerHTML = '<p class="text-slate-500">Thème introuvable.</p>'; return; }
  const c = colorOf(theme.color);
  const chapters = await Promise.all(theme.chapters.map(loadChapter));
  const stats = Storage.load();
  const total = chapters.reduce((s, ch) => s + (ch.questions ? ch.questions.length : 0), 0);

  let chHtml = '';
  for (const ch of chapters) {
    const m = (meta.chapterMeta && meta.chapterMeta[ch.chapter]) || {};
    const stat = (stats.chapters || {})[ch.chapter];
    const best = stat ? (stat.bestCorrect + '/' + stat.bestTotal) : '—';
    const n = (ch.questions || []).length;
    chHtml += `
      <a href="#/chapter/${ch.chapter}" class="card-hover flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${c.grad} flex items-center justify-center text-white font-bold text-sm shrink-0">${ch.chapter.split('-')[0]}</div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-slate-900 truncate">${esc(m.title || ch.title || 'Chapitre ' + ch.chapter)}</div>
          <div class="text-[12px] text-slate-500 mt-0.5">${n} questions · meilleur score : ${best}</div>
        </div>
        <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </a>`;
  }

  $app.innerHTML = `
    <nav class="text-[13px] text-slate-500 mb-3 fade-in"><a href="#/" class="hover:text-slate-900">← Accueil</a></nav>
    <header class="${c.bg} border ${c.ring} rounded-2xl p-5 sm:p-6 mb-5 fade-in">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">${esc(theme.title)}</h1>
      <p class="text-slate-600 mt-1">${esc(theme.subtitle)}</p>
      <p class="text-xs text-slate-500 mt-2">${chapters.length} chapitres · ${total} questions</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="#/theme/${theme.id}/mixed" class="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Mix de ce thème</a>
        <a href="#/theme/${theme.id}/exam"  class="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">Examen sur ce thème</a>
      </div>
    </header>
    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Chapitres</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 fade-in">${chHtml}</div>
  `;
});

// ────── View: Chapter quiz ──────
on(/^\/chapter\/([^/]+)$/, async ([, id], params) => {
  const meta = await loadMeta();
  const ch = await loadChapter(id);
  const m = (meta.chapterMeta && meta.chapterMeta[id]) || {};
  const theme = meta.themes.find(t => m.themeId && t.id === m.themeId);
  const themeColor = theme ? theme.color : 'sky';
  if (!ch.questions || ch.questions.length === 0) {
    $app.innerHTML = `
      <nav class="text-[13px] text-slate-500 mb-3"><a href="#/" class="hover:text-slate-900">← Accueil</a></nav>
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p class="text-amber-800 font-semibold">Chapitre en cours de préparation.</p>
      </div>`;
    return;
  }
  const qs = params.get('shuffle') === '1' ? shuffle(ch.questions) : ch.questions;
  startQuiz({
    title: m.title || ch.title || id,
    subtitle: 'Chapitre ' + id,
    backHref: m.themeId ? ('#/theme/' + m.themeId) : '#/',
    questions: qs,
    mode: 'train',
    color: themeColor,
    onFinish: ({ correct, total }) => Storage.recordChapter(id, correct, total)
  });
});

// ────── View: Mixed (all chapters) ──────
on(/^\/mixed$/, async (m, params) => {
  const all = await loadAllChapters();
  const pool = [];
  for (const ch of all) for (const q of (ch.questions || [])) pool.push(Object.assign({}, q, { _ch: ch.chapter }));
  const n = parseInt(params.get('n') || '20', 10);
  const picks = shuffle(pool).slice(0, Math.min(n, pool.length));
  startQuiz({
    title: 'Mode Mixte',
    subtitle: picks.length + ' questions tirées de tous les chapitres',
    backHref: '#/',
    questions: picks,
    mode: 'train',
    color: 'indigo',
    showChapterLabel: true
  });
});

// ────── View: Theme mixed ──────
on(/^\/theme\/([^/]+)\/mixed$/, async ([, themeId], params) => {
  const meta = await loadMeta();
  const theme = meta.themes.find(t => t.id === themeId);
  if (!theme) { $app.innerHTML = '<p class="text-slate-500">Thème introuvable.</p>'; return; }
  const chs = await Promise.all(theme.chapters.map(loadChapter));
  const pool = [];
  for (const ch of chs) for (const q of (ch.questions || [])) pool.push(Object.assign({}, q, { _ch: ch.chapter }));
  const n = parseInt(params.get('n') || '20', 10);
  const picks = shuffle(pool).slice(0, Math.min(n, pool.length));
  startQuiz({
    title: 'Mix · ' + theme.title,
    subtitle: picks.length + ' questions du thème',
    backHref: '#/theme/' + themeId,
    questions: picks,
    mode: 'train',
    color: theme.color,
    showChapterLabel: true
  });
});

// ────── View: Exam ──────
on(/^\/exam$/, async (m, params) => {
  const all = await loadAllChapters();
  const pool = [];
  for (const ch of all) for (const q of (ch.questions || [])) pool.push(Object.assign({}, q, { _ch: ch.chapter }));
  const n = parseInt(params.get('n') || '40', 10);
  const minutes = parseInt(params.get('t') || '60', 10);
  const picks = shuffle(pool).slice(0, Math.min(n, pool.length));
  startQuiz({
    title: 'Examen Blanc',
    subtitle: picks.length + ' questions · ' + minutes + ' min',
    backHref: '#/',
    questions: picks,
    mode: 'exam',
    examSec: minutes * 60,
    color: 'rose',
    showChapterLabel: true,
    onFinish: ({ correct, total, sec }) => Storage.recordExam(correct, total, sec)
  });
});

on(/^\/theme\/([^/]+)\/exam$/, async ([, themeId], params) => {
  const meta = await loadMeta();
  const theme = meta.themes.find(t => t.id === themeId);
  if (!theme) { $app.innerHTML = '<p class="text-slate-500">Thème introuvable.</p>'; return; }
  const chs = await Promise.all(theme.chapters.map(loadChapter));
  const pool = [];
  for (const ch of chs) for (const q of (ch.questions || [])) pool.push(Object.assign({}, q, { _ch: ch.chapter }));
  const n = parseInt(params.get('n') || '30', 10);
  const minutes = parseInt(params.get('t') || '45', 10);
  const picks = shuffle(pool).slice(0, Math.min(n, pool.length));
  startQuiz({
    title: 'Examen · ' + theme.title,
    subtitle: picks.length + ' questions · ' + minutes + ' min',
    backHref: '#/theme/' + themeId,
    questions: picks,
    mode: 'exam',
    examSec: minutes * 60,
    color: theme.color,
    showChapterLabel: true
  });
});

// ────── View: Stats ──────
on(/^\/stats$/, async () => {
  const meta = await loadMeta();
  const s = Storage.load();
  const cs = s.chapters || {};
  const exs = s.exams || [];
  let chHtml = '';
  const keys = Object.keys(cs);
  if (keys.length === 0) chHtml = '<p class="text-slate-500 text-sm">Aucune session enregistrée pour l\'instant.</p>';
  else {
    chHtml = '<div class="grid sm:grid-cols-2 gap-3">';
    for (const id of keys) {
      const c = cs[id]; const m = (meta.chapterMeta && meta.chapterMeta[id]) || {};
      const pct = c.bestTotal ? Math.round(100 * c.bestCorrect / c.bestTotal) : 0;
      const pctClass = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';
      chHtml += `
        <a href="#/chapter/${id}" class="card-hover block bg-white border border-slate-200 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="font-semibold text-slate-900 truncate">${esc(m.title || id)}</div>
            <span class="text-xs font-bold ${pctClass}">${pct}%</span>
          </div>
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-sky-500 to-indigo-500" style="width:${pct}%"></div></div>
          <div class="text-[12px] text-slate-500 mt-2">${c.sessions} session(s) · meilleur ${c.bestCorrect}/${c.bestTotal}</div>
        </a>`;
    }
    chHtml += '</div>';
  }

  let exHtml = '';
  if (exs.length === 0) exHtml = '<p class="text-slate-500 text-sm">Aucun examen blanc passé pour l\'instant.</p>';
  else {
    exHtml = '<div class="bg-white border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-sm"><thead class="bg-slate-50 text-slate-600"><tr><th class="text-left p-3 font-medium">Date</th><th class="text-left p-3 font-medium">Score</th><th class="text-left p-3 font-medium">Durée</th></tr></thead><tbody>';
    for (const e of exs) exHtml += `<tr class="border-t border-slate-100"><td class="p-3">${new Date(e.date).toLocaleString('fr-FR')}</td><td class="p-3 font-semibold">${e.correct}/${e.total} (${Math.round(100*e.correct/e.total)}%)</td><td class="p-3 text-slate-500">${Math.round(e.sec/60)} min</td></tr>`;
    exHtml += '</tbody></table></div>';
  }

  $app.innerHTML = `
    <nav class="text-[13px] text-slate-500 mb-3"><a href="#/" class="hover:text-slate-900">← Accueil</a></nav>
    <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">Mes statistiques</h1>
    <section class="mb-8">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Par chapitre</h2>
      ${chHtml}
    </section>
    <section>
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Examens blancs</h2>
      ${exHtml}
    </section>
    <div class="mt-8 text-center">
      <button id="reset-stats" class="text-xs text-rose-600 hover:underline">Réinitialiser mes statistiques</button>
    </div>
  `;
  const btn = document.getElementById('reset-stats');
  if (btn) btn.addEventListener('click', () => {
    if (confirm('Effacer toutes les statistiques ?')) { localStorage.removeItem(Storage.KEY); render(); }
  });
});

// ────── Quiz engine ──────
function startQuiz(opts) {
  const { title, subtitle, backHref, questions, mode, examSec, color, showChapterLabel, onFinish } = opts;
  if (!questions || questions.length === 0) { $app.innerHTML = '<p class="text-slate-500">Aucune question disponible.</p>'; return; }
  const themeColor = colorOf(color);

  const state = {
    idx: 0,
    picks: questions.map(() => new Set()),
    revealed: questions.map(() => false),
    startedAt: Date.now()
  };
  let examTimerId = null;

  function startTimer() {
    if (mode !== 'exam' || !examSec) return;
    const endAt = state.startedAt + examSec * 1000;
    examTimerId = setInterval(() => {
      const rem = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
      const t = document.getElementById('exam-timer');
      if (t) {
        const mm = String(Math.floor(rem / 60)).padStart(2, '0');
        const ss = String(rem % 60).padStart(2, '0');
        t.textContent = mm + ':' + ss;
        if (rem < 60) t.classList.add('text-rose-600');
      }
      if (rem === 0) { clearInterval(examTimerId); finish(); }
    }, 500);
  }

  function paint() {
    const q = questions[state.idx];
    const total = questions.length;
    const progress = Math.round(((state.idx + 1) / total) * 100);
    const isMulti = q.type === 'multiple';
    const picks = state.picks[state.idx];
    const revealed = state.revealed[state.idx];
    const meta = (META && META.chapterMeta && META.chapterMeta[q._ch]) || {};

    let optsHtml = '';
    const letters = Object.keys(q.options || {});
    for (const letter of letters) {
      const text = q.options[letter];
      if (!text) continue;
      let cls = '';
      const isPicked = picks.has(letter);
      if (revealed) {
        const isCorr = (q.correct || []).includes(letter);
        if (isCorr && isPicked) cls = 'correct';
        else if (isCorr && !isPicked) cls = 'missed';
        else if (!isCorr && isPicked) cls = 'wrong';
      } else if (isPicked) cls = 'selected';
      const mark = cls === 'correct' || cls === 'missed' ? '✓' : (cls === 'wrong' ? '✕' : letter);
      const disabled = (revealed && mode === 'train') ? 'disabled' : '';
      optsHtml += `
        <button type="button" data-letter="${letter}" class="opt-card ${isMulti ? 'is-multi' : ''} ${cls}" ${disabled}>
          <span class="opt-mark">${mark}</span>
          <span class="flex-1 text-[14px] sm:text-[15px] leading-snug">${esc(text)}</span>
        </button>`;
    }

    let feedback = '';
    if (revealed && mode === 'train') {
      const correct = q.correct || [];
      const ok = correct.length > 0 && arraysEqual([...picks], correct);
      if (!correct.length) {
        feedback = '<div class="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[13px]">Correction non disponible pour cette question.</div>';
      } else {
        feedback = `<div class="mt-4 p-3.5 rounded-xl ${ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}">
          <p class="font-semibold text-sm ${ok ? 'text-emerald-800' : 'text-rose-800'}">${ok ? '✓ Bonne réponse !' : '✗ Réponse incorrecte'}</p>
          <p class="text-[13px] mt-1 ${ok ? 'text-emerald-700' : 'text-rose-700'}">Bonne réponse : <strong>${correct.map(l => l.toUpperCase()).join(', ')}</strong></p>
        </div>`;
      }
    }

    const chapterLabel = (showChapterLabel && q._ch) ? ` · <span class="text-slate-500">${esc(meta.short || meta.title || 'Ch ' + q._ch)}</span>` : '';

    $app.innerHTML = `
      <nav class="text-[13px] text-slate-500 mb-3"><a href="${backHref}" class="hover:text-slate-900">← ${esc(title)}</a></nav>

      <div class="flex items-end justify-between mb-3">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${esc(subtitle)}</div>
          <div class="text-sm text-slate-700 mt-0.5">Question <strong>${state.idx + 1}</strong> / ${total}${chapterLabel}</div>
        </div>
        ${mode === 'exam' ? `<div class="text-right"><div class="text-[10px] uppercase tracking-wider text-slate-500">Temps</div><div id="exam-timer" class="font-mono font-bold text-xl text-slate-900 leading-none">--:--</div></div>` : ''}
      </div>

      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div class="h-full bg-gradient-to-r ${themeColor.grad} transition-all duration-300" style="width:${progress}%"></div>
      </div>

      <article class="${themeColor.bg} border ${themeColor.ring} rounded-2xl p-5 sm:p-6 shadow-sm fade-in">
        <div class="flex items-start gap-3 mb-4">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-slate-700 border border-slate-200 text-sm font-bold shrink-0">${q.number || state.idx + 1}</span>
          <div class="flex-1 min-w-0">
            <p class="text-slate-900 font-semibold text-[15px] sm:text-[17px] leading-relaxed">${esc(q.question)}</p>
            ${q.instruction ? `<p class="text-[12px] text-slate-500 mt-1.5 italic">${esc(q.instruction)}</p>` : ''}
            <p class="text-[11px] text-slate-500 mt-1.5">${isMulti ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</p>
          </div>
        </div>
        <div class="space-y-2.5">${optsHtml}</div>
        ${feedback}
      </article>

      <div class="flex items-center justify-between gap-3 mt-5">
        <button id="prev-btn" class="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium ${state.idx === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}" ${state.idx === 0 ? 'disabled' : ''}>← Précédent</button>
        <div class="flex items-center gap-2">
          ${mode === 'train' && !revealed ? `<button id="check-btn" class="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40" ${picks.size === 0 ? 'disabled' : ''}>Valider</button>` : ''}
          ${state.idx < total - 1
            ? '<button id="next-btn" class="px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">Suivant →</button>'
            : '<button id="finish-btn" class="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Terminer ✓</button>'}
        </div>
      </div>

      <p class="hidden sm:block text-[11px] text-slate-400 mt-6 text-center">
        <span class="kbd">←</span> précédent · <span class="kbd">→</span> suivant · <span class="kbd">a-e</span> sélectionner · <span class="kbd">Entrée</span> valider/suivant
      </p>
    `;
    wire(q);
    if (mode === 'exam' && !examTimerId) startTimer();
  }

  function wire(q) {
    const isMulti = q.type === 'multiple';
    const picks = state.picks[state.idx];
    const revealed = state.revealed[state.idx];
    $app.querySelectorAll('.opt-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if (revealed && mode === 'train') return;
        const L = btn.dataset.letter;
        if (isMulti) { picks.has(L) ? picks.delete(L) : picks.add(L); paint(); }
        else {
          picks.clear(); picks.add(L);
          if (mode === 'train') { state.revealed[state.idx] = true; }
          paint();
        }
      });
    });
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');
    const check = document.getElementById('check-btn');
    const fin = document.getElementById('finish-btn');
    if (prev) prev.addEventListener('click', () => { if (state.idx > 0) { state.idx--; paint(); } });
    if (next) next.addEventListener('click', () => { if (state.idx < questions.length - 1) { state.idx++; paint(); } });
    if (check) check.addEventListener('click', () => { state.revealed[state.idx] = true; paint(); });
    if (fin) fin.addEventListener('click', finish);
  }

  function finish() {
    if (examTimerId) { clearInterval(examTimerId); examTimerId = null; }
    let correctCount = 0;
    const items = questions.map((q, i) => {
      const picks = [...state.picks[i]];
      const ok = (q.correct || []).length > 0 && arraysEqual(picks, q.correct);
      if (ok) correctCount++;
      return { q, picks, ok };
    });
    const total = questions.length;
    const sec = Math.round((Date.now() - state.startedAt) / 1000);
    const pct = Math.round(100 * correctCount / total);

    if (onFinish) onFinish({ correct: correctCount, total, sec });

    Buddy.surprise(pct);

    let detail = '';
    items.forEach((it, i) => {
      const yours = it.picks.length ? it.picks.map(l => l.toUpperCase()).join(', ') : '(rien)';
      const corr = (it.q.correct || []).map(l => l.toUpperCase()).join(', ') || '—';
      let optsList = '';
      for (const L of Object.keys(it.q.options || {})) {
        const t = it.q.options[L]; if (!t) continue;
        const isCorr = (it.q.correct || []).includes(L);
        const isPick = it.picks.includes(L);
        const mark = isCorr ? '✓' : isPick ? '✕' : '·';
        const cls = isCorr ? 'text-emerald-700 font-medium' : isPick ? 'text-rose-700' : 'text-slate-600';
        optsList += `<li class="${cls}"><span class="inline-block w-4 text-center">${mark}</span><strong>${L}.</strong> ${esc(t)}</li>`;
      }
      detail += `
        <details class="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <summary class="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 list-none">
            <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${it.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} shrink-0">${it.ok ? '✓' : '✕'}</span>
            <span class="text-[13px] font-medium text-slate-900 flex-1 truncate">Q${i + 1}. ${esc(it.q.question.slice(0, 80))}${it.q.question.length > 80 ? '…' : ''}</span>
            <span class="text-[11px] text-slate-500 shrink-0 hidden sm:block">Vous: ${yours} · Bon: ${corr}</span>
          </summary>
          <div class="px-4 pb-4 pt-3 border-t border-slate-100">
            <p class="text-sm text-slate-700 mb-3">${esc(it.q.question)}</p>
            <ul class="space-y-1.5 text-[13px] sm:text-sm">${optsList}</ul>
          </div>
        </details>`;
    });

    const pctClass = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';
    $app.innerHTML = `
      <nav class="text-[13px] text-slate-500 mb-3"><a href="${backHref}" class="hover:text-slate-900">← Retour</a></nav>
      <section class="text-center mb-8 fade-in">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${esc(title)}</p>
        <div class="my-4 inline-flex items-baseline gap-1.5">
          <span class="text-6xl font-extrabold ${pctClass}">${correctCount}</span>
          <span class="text-2xl text-slate-400 font-bold">/ ${total}</span>
        </div>
        <p class="text-slate-700 font-medium">${pct}% de bonnes réponses</p>
        <p class="text-[12px] text-slate-500 mt-1">${Math.floor(sec / 60)} min ${sec % 60}s</p>
      </section>
      <section>
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">Correction détaillée</h2>
        <div class="space-y-2.5">${detail}</div>
      </section>
      <div class="mt-8 flex flex-wrap gap-2 justify-center">
        <button id="retry" class="px-5 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700">Refaire</button>
        <a href="${backHref}" class="px-5 py-2.5 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-50">Retour</a>
        <a href="#/stats" class="px-5 py-2.5 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-50">Mes stats</a>
      </div>
    `;
    const retry = document.getElementById('retry');
    if (retry) retry.addEventListener('click', () => render());
  }

  // Keyboard shortcuts
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const q = questions[state.idx]; if (!q) return;
    if (e.key === 'ArrowLeft' && state.idx > 0) { state.idx--; paint(); }
    else if (e.key === 'ArrowRight' && state.idx < questions.length - 1) { state.idx++; paint(); }
    else if (e.key === 'Enter') {
      const c = document.getElementById('check-btn');
      const n = document.getElementById('next-btn');
      const f = document.getElementById('finish-btn');
      if (c && !c.disabled) c.click();
      else if (n) n.click();
      else if (f) f.click();
    } else if (/^[a-eA-E]$/.test(e.key)) {
      const L = e.key.toLowerCase();
      if (!q.options || !q.options[L]) return;
      const btn = $app.querySelector('.opt-card[data-letter="' + L + '"]');
      if (btn && !btn.disabled) btn.click();
    }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  paint();
}

// ────── Boot ──────
window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => { Buddy.init(); render(); });
if (document.readyState !== 'loading') { Buddy.init(); render(); }
