// MICI QCM — single-page app
// Vanilla JS, hash-based routing. All data loaded lazily from /data.

(() => {
  'use strict';


  // ─── Motivational messages (English, addressed to Imane) ─────────────────
  const MESSAGES = {
    click: [
      "You're going to ace this exam, Imane!",
      "Keep going — I believe in you 💖",
      "Your future patients are so lucky.",
      "Take a deep breath — you know this stuff.",
      "So proud of you, Imane ✨",
      "Brilliant mind at work 🧠",
      "Almost there, future gastro queen 👑",
      "One more set, one step closer."
    ],
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
    ]
  };

  function pickMessage(kind) {
    const arr = MESSAGES[kind] || MESSAGES.finish;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Buddy (easter-egg avatar) ───────────────────────────────────────────
  // Hidden by default. Surprise-appears only at the end of a QCM set.
  const buddy = (() => {
    const el = document.getElementById('buddy');
    const bubble = document.getElementById('buddy-bubble');
    let hideTimer = null;
    let bubbleTimer = null;
    let blinkInterval = null;

    function clearState() {
      ['happy', 'sad', 'cheer', 'clap', 'wave', 'blink'].forEach(c => el.classList.remove(c));
    }

    function applyState(state, duration = 1800) {
      clearState();
      void el.offsetWidth;
      if (state) el.classList.add(state);
      if (state && state !== 'blink' && duration) {
        setTimeout(() => el.classList.remove(state), duration);
      }
    }

    function say(message, duration = 4500) {
      bubble.textContent = message;
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
    }

    function hide() {
      el.classList.remove('visible');
      bubble.classList.remove('show');
      clearState();
      if (blinkInterval) { clearInterval(blinkInterval); blinkInterval = null; }
    }

    // Surprise appearance at the end of a QCM set
    function surprise({ pct = 0, mode = 'finish' } = {}) {
      // pick celebration animation based on score
      let state;
      let kind;
      if (mode === 'perfect' || pct === 100) { state = 'cheer'; kind = 'perfect'; }
      else if (pct >= 70) { state = pickFrom(['cheer', 'clap', 'happy']); kind = 'finish'; }
      else if (pct >= 50) { state = pickFrom(['clap', 'happy', 'wave']); kind = 'finish'; }
      else                { state = pickFrom(['wave', 'happy']);          kind = 'finish'; }

      // Delay slightly so it feels like a surprise pop-in
      setTimeout(() => {
        el.classList.add('visible');
        applyState(state, state === 'cheer' ? 2400 : 1800);
        say(pickMessage(kind), 6000);

        // Idle blink while visible
        if (blinkInterval) clearInterval(blinkInterval);
        blinkInterval = setInterval(() => {
          if (!['happy','sad','cheer','clap','wave'].some(c => el.classList.contains(c))) {
            applyState('blink', 150);
          }
        }, 4500);

        // Re-celebrate periodically while visible
        let cycles = 0;
        const reCycle = setInterval(() => {
          cycles++;
          const s = pickFrom(['happy', 'clap', 'wave']);
          applyState(s, 1500);
          if (cycles >= 2) clearInterval(reCycle);
        }, 3200);
      }, 700);
    }

    // Click while visible → wave + new message
    el.addEventListener('click', () => {
      if (!el.classList.contains('visible')) return;
      applyState('wave', 1800);
      say(pickMessage('click'), 4000);
    });

    function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    return { surprise, hide };
  })();

  // Auto-hide buddy on navigation away from a results screen
  window.addEventListener('hashchange', () => buddy.hide());

  // ─── Storage ─────────────────────────────────────────────────────────────
  const Storage = {
    KEY: 'mici-qcm-v1',
    load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
    save(s) { localStorage.setItem(this.KEY, JSON.stringify(s)); },
    recordChapterScore(chapter, correct, total) {
      const s = this.load();
      if (!s.chapters) s.chapters = {};
      const cur = s.chapters[chapter] || { sessions: 0, bestCorrect: 0, bestTotal: 0, lastCorrect: 0, lastTotal: 0 };
      cur.sessions += 1;
      cur.lastCorrect = correct;
      cur.lastTotal = total;
      if (correct / total > (cur.bestCorrect || 0) / (cur.bestTotal || 1)) {
        cur.bestCorrect = correct; cur.bestTotal = total;
      }
      s.chapters[chapter] = cur;
      this.save(s);
    },
    recordExam(correct, total, durationSec) {
      const s = this.load();
      if (!s.exams) s.exams = [];
      s.exams.unshift({ correct, total, durationSec, date: new Date().toISOString() });
      s.exams = s.exams.slice(0, 20);
      this.save(s);
    }
  };

  // ─── Data loading ────────────────────────────────────────────────────────
  let META = null;
  const chapterCache = new Map();

  async function loadMeta() {
    if (META) return META;
    META = await fetch('data/index.json').then(r => r.json());
    return META;
  }
  async function loadChapter(id) {
    if (chapterCache.has(id)) return chapterCache.get(id);
    const safe = id.replace(/-/g, '_');
    try {
      const data = await fetch(`data/chapters/ch${safe}.json`).then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      });
      chapterCache.set(id, data);
      return data;
    } catch {
      const empty = { chapter: id, title: META?.chapterMeta?.[id]?.title || `Chapitre ${id}`, questions: [] };
      chapterCache.set(id, empty);
      return empty;
    }
  }
  async function loadAllChapters() {
    await loadMeta();
    const ids = Object.keys(META.chapterMeta);
    return Promise.all(ids.map(loadChapter));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const colors = {
    indigo:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  grad: 'from-indigo-500 to-indigo-400' },
    sky:     { bg: 'bg-sky-50',     ring: 'ring-sky-200',     text: 'text-sky-700',     dot: 'bg-sky-500',     grad: 'from-sky-500 to-cyan-400' },
    rose:    { bg: 'bg-rose-50',    ring: 'ring-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500',    grad: 'from-rose-500 to-pink-400' },
    emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', grad: 'from-emerald-500 to-teal-400' },
    amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   grad: 'from-amber-500 to-orange-400' },
  };

  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function answersEqual(picked, correct) {
    if (!correct || correct.length === 0) return false;
    const a = [...picked].sort().join(',');
    const b = [...correct].sort().join(',');
    return a === b;
  }

  // ─── Router ──────────────────────────────────────────────────────────────
  const routes = [];
  function on(pattern, handler) { routes.push({ pattern, handler }); }
  function navigate(hash) { window.location.hash = hash; }

  function parseHash() {
    const raw = (window.location.hash || '#/').slice(1);
    const [pathPart, queryPart] = raw.split('?');
    const params = new URLSearchParams(queryPart || '');
    return { path: pathPart || '/', params };
  }

  async function render() {
    const { path, params } = parseHash();
    for (const { pattern, handler } of routes) {
      const m = path.match(pattern);
      if (m) {
        $app.classList.remove('animate-fade-in');
        void $app.offsetWidth;
        $app.classList.add('animate-fade-in');
        await handler(m, params);
        window.scrollTo({ top: 0 });
        return;
      }
    }
    $app.innerHTML = `<div class="text-center py-12"><p class="text-slate-500">Page introuvable.</p><a href="#/" class="text-indigo-600 underline">Retour à l'accueil</a></div>`;
  }

  window.addEventListener('hashchange', render);

  // ─── View: Home ──────────────────────────────────────────────────────────
  on(/^\/$/, async () => {
    await loadMeta();
    const stats = Storage.load();
    const totalDone = Object.values(stats.chapters || {}).reduce((s, c) => s + (c.sessions || 0), 0);

    $app.innerHTML = `
      <section class="text-center mb-10 animate-slide-up">
        <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">Préparation Examen · Gastro-entérologie</p>
        <h1 class="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight">${escapeHtml(META.title)}</h1>
        <p class="mt-3 text-slate-600 max-w-2xl mx-auto">${escapeHtml(META.subtitle)} — entraînement par chapitre, par thème, mix aléatoire ou examen blanc chronométré.</p>
      </section>

      <section class="grid sm:grid-cols-3 gap-4 mb-10">
        <a href="#/mixed" class="theme-card bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white mb-3">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z"/></svg>
          </div>
          <h3 class="font-bold text-slate-900">Mode Mixte</h3>
          <p class="text-sm text-slate-500 mt-1">Tirage aléatoire de QCM de tous les chapitres.</p>
        </a>
        <a href="#/exam" class="theme-card bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white mb-3">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="font-bold text-slate-900">Examen Blanc</h3>
          <p class="text-sm text-slate-500 mt-1">Chronométré, sans correction immédiate. Comme le jour J.</p>
        </a>
        <a href="#/stats" class="theme-card bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white mb-3">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17v-6m6 6V7m6 10v-4m6 4V11"/></svg>
          </div>
          <h3 class="font-bold text-slate-900">Mes Statistiques</h3>
          <p class="text-sm text-slate-500 mt-1">${totalDone} session(s) réalisée(s).</p>
        </a>
      </section>

      <section>
        <h2 class="text-xl font-bold text-slate-900 mb-4">Thèmes</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${META.themes.map(t => {
            const c = colors[t.color] || colors.indigo;
            const chapterCount = t.chapters.length;
            return `
              <a href="#/theme/${t.id}" class="theme-card group block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div class="flex items-start gap-3">
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center text-white shadow-sm">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="${t.icon}"/>
                    </svg>
                  </div>
                  <div class="flex-1">
                    <h3 class="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">${escapeHtml(t.title)}</h3>
                    <p class="text-sm text-slate-500 mt-0.5">${escapeHtml(t.subtitle)}</p>
                    <p class="text-xs ${c.text} mt-2 font-medium">${chapterCount} chapitre${chapterCount > 1 ? 's' : ''} ›</p>
                  </div>
                </div>
              </a>`;
          }).join('')}
        </div>
      </section>
    `;

  });

  // ─── View: Theme ─────────────────────────────────────────────────────────
  on(/^\/theme\/([^/]+)$/, async ([, themeId]) => {
    await loadMeta();
    const theme = META.themes.find(t => t.id === themeId);
    if (!theme) { $app.innerHTML = `<p>Thème introuvable.</p>`; return; }
    const c = colors[theme.color] || colors.indigo;
    const chapters = await Promise.all(theme.chapters.map(loadChapter));
    const stats = Storage.load();
    const themeTotal = chapters.reduce((s, ch) => s + (ch.questions?.length || 0), 0);

    $app.innerHTML = `
      <nav class="text-sm text-slate-500 mb-4"><a href="#/" class="hover:text-slate-900">Accueil</a> › <span class="text-slate-900 font-medium">${escapeHtml(theme.title)}</span></nav>

      <header class="mb-6 ${c.bg} border ${c.ring} rounded-2xl p-5 sm:p-6">
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">${escapeHtml(theme.title)}</h1>
        <p class="text-slate-600 mt-1">${escapeHtml(theme.subtitle)}</p>
        <p class="text-xs text-slate-500 mt-2">${chapters.length} chapitres · ${themeTotal} questions</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <a href="#/theme/${themeId}/mixed" class="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Mix de ce thème</a>
          <a href="#/theme/${themeId}/exam" class="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-white">Examen sur ce thème</a>
        </div>
      </header>

      <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Chapitres</h2>
      <div class="grid sm:grid-cols-2 gap-3">
        ${chapters.map(ch => {
          const meta = META.chapterMeta[ch.chapter];
          const stat = (stats.chapters || {})[ch.chapter];
          const best = stat ? `${stat.bestCorrect}/${stat.bestTotal}` : '—';
          const total = ch.questions?.length || 0;
          return `
            <a href="#/chapter/${ch.chapter}" class="theme-card flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${c.grad} flex items-center justify-center text-white font-bold">${ch.chapter.split('-')[0]}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-900 truncate">${escapeHtml(meta?.title || ch.title || ch.chapter)}</div>
                <div class="text-xs text-slate-500 mt-0.5">${total} questions · meilleur score: ${best}</div>
              </div>
              <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </a>`;
        }).join('')}
      </div>
    `;
  });

  // ─── View: Chapter quiz ──────────────────────────────────────────────────
  on(/^\/chapter\/([^/]+)$/, async ([, id], params) => {
    const ch = await loadChapter(id);
    await loadMeta();
    const meta = META.chapterMeta[id] || {};
    const themeColor = colors[(META.themes.find(t => t.id === meta.themeId) || {}).color] || colors.indigo;

    if (!ch.questions || ch.questions.length === 0) {
      $app.innerHTML = `
        <nav class="text-sm text-slate-500 mb-4"><a href="#/" class="hover:text-slate-900">Accueil</a> › ${escapeHtml(meta.title || id)}</nav>
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p class="text-amber-800 font-semibold">Ce chapitre est en cours de préparation.</p>
          <p class="text-amber-700 text-sm mt-2">Les QCM seront disponibles très bientôt.</p>
          <a href="#/" class="inline-block mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium">Retour</a>
        </div>`;
      return;
    }

    const mode = params.get('mode') || 'train';
    const shuffled = params.get('shuffle') === '1' ? shuffle(ch.questions) : ch.questions;
    startQuiz({
      title: meta.title || ch.title || id,
      subtitle: `Chapitre ${id}`,
      backHref: meta.themeId ? `#/theme/${meta.themeId}` : '#/',
      questions: shuffled,
      mode,
      color: themeColor,
      onFinish: ({ correctCount, total }) => Storage.recordChapterScore(id, correctCount, total),
    });
  });

  // ─── View: Mixed mode (random from all) ──────────────────────────────────
  on(/^\/mixed$/, async (m, params) => {
    const all = await loadAllChapters();
    const pool = all.flatMap(ch => (ch.questions || []).map(q => ({ ...q, _ch: ch.chapter, _chTitle: ch.title })));
    const desired = parseInt(params.get('n') || '20', 10);
    const picked = shuffle(pool).slice(0, Math.min(desired, pool.length));
    startQuiz({
      title: 'Mode Mixte',
      subtitle: `${picked.length} questions tirées de tous les chapitres`,
      backHref: '#/',
      questions: picked,
      mode: 'train',
      color: colors.indigo,
      showChapterLabel: true,
    });
  });

  // ─── View: Theme mixed ───────────────────────────────────────────────────
  on(/^\/theme\/([^/]+)\/mixed$/, async ([, themeId], params) => {
    await loadMeta();
    const theme = META.themes.find(t => t.id === themeId);
    const chs = await Promise.all(theme.chapters.map(loadChapter));
    const pool = chs.flatMap(ch => (ch.questions || []).map(q => ({ ...q, _ch: ch.chapter, _chTitle: ch.title })));
    const desired = parseInt(params.get('n') || '20', 10);
    const picked = shuffle(pool).slice(0, Math.min(desired, pool.length));
    startQuiz({
      title: `Mix · ${theme.title}`,
      subtitle: `${picked.length} questions tirées des chapitres du thème`,
      backHref: `#/theme/${themeId}`,
      questions: picked,
      mode: 'train',
      color: colors[theme.color] || colors.indigo,
      showChapterLabel: true,
    });
  });

  // ─── View: Exam (timed, no immediate feedback) ───────────────────────────
  on(/^\/exam$/, async (m, params) => {
    const all = await loadAllChapters();
    const pool = all.flatMap(ch => (ch.questions || []).map(q => ({ ...q, _ch: ch.chapter, _chTitle: ch.title })));
    const desired = parseInt(params.get('n') || '40', 10);
    const minutes = parseInt(params.get('t') || '60', 10);
    const picked = shuffle(pool).slice(0, Math.min(desired, pool.length));
    startQuiz({
      title: 'Examen Blanc',
      subtitle: `${picked.length} questions · ${minutes} min`,
      backHref: '#/',
      questions: picked,
      mode: 'exam',
      examDurationSec: minutes * 60,
      color: colors.rose,
      showChapterLabel: true,
      onFinish: ({ correctCount, total, durationSec }) => Storage.recordExam(correctCount, total, durationSec),
    });
  });

  on(/^\/theme\/([^/]+)\/exam$/, async ([, themeId], params) => {
    await loadMeta();
    const theme = META.themes.find(t => t.id === themeId);
    const chs = await Promise.all(theme.chapters.map(loadChapter));
    const pool = chs.flatMap(ch => (ch.questions || []).map(q => ({ ...q, _ch: ch.chapter, _chTitle: ch.title })));
    const desired = parseInt(params.get('n') || '30', 10);
    const minutes = parseInt(params.get('t') || '45', 10);
    const picked = shuffle(pool).slice(0, Math.min(desired, pool.length));
    startQuiz({
      title: `Examen · ${theme.title}`,
      subtitle: `${picked.length} questions · ${minutes} min`,
      backHref: `#/theme/${themeId}`,
      questions: picked,
      mode: 'exam',
      examDurationSec: minutes * 60,
      color: colors[theme.color] || colors.indigo,
      showChapterLabel: true,
    });
  });

  // ─── View: Stats ─────────────────────────────────────────────────────────
  on(/^\/stats$/, async () => {
    await loadMeta();
    const s = Storage.load();
    const chapters = s.chapters || {};
    const exams = s.exams || [];
    $app.innerHTML = `
      <nav class="text-sm text-slate-500 mb-4"><a href="#/" class="hover:text-slate-900">Accueil</a> › Statistiques</nav>
      <h1 class="text-3xl font-extrabold text-slate-900 mb-6">Mes statistiques</h1>

      <section class="mb-8">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Par chapitre</h2>
        ${Object.keys(chapters).length === 0
          ? `<p class="text-slate-500 text-sm">Aucune session enregistrée pour l'instant.</p>`
          : `<div class="grid sm:grid-cols-2 gap-3">${Object.entries(chapters).map(([id, c]) => {
              const meta = META.chapterMeta[id] || {};
              const pct = c.bestTotal ? Math.round(100 * c.bestCorrect / c.bestTotal) : 0;
              return `
                <a href="#/chapter/${id}" class="theme-card block bg-white border border-slate-200 rounded-xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <div class="font-semibold text-slate-900 truncate">${escapeHtml(meta.title || id)}</div>
                    <span class="text-xs font-semibold ${pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}">${pct}%</span>
                  </div>
                  <div class="progress-bar"><div style="width:${pct}%"></div></div>
                  <div class="text-xs text-slate-500 mt-2">${c.sessions} session(s) · meilleur ${c.bestCorrect}/${c.bestTotal}</div>
                </a>`;
            }).join('')}</div>`}
      </section>

      <section>
        <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Examens blancs</h2>
        ${exams.length === 0
          ? `<p class="text-slate-500 text-sm">Aucun examen blanc passé pour l'instant.</p>`
          : `<div class="bg-white border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-sm"><thead class="bg-slate-50"><tr><th class="text-left p-3">Date</th><th class="text-left p-3">Score</th><th class="text-left p-3">Durée</th></tr></thead><tbody>${exams.map(e => `<tr class="border-t border-slate-100"><td class="p-3">${new Date(e.date).toLocaleString('fr-FR')}</td><td class="p-3 font-medium">${e.correct}/${e.total} (${Math.round(100*e.correct/e.total)}%)</td><td class="p-3 text-slate-500">${Math.round(e.durationSec/60)} min</td></tr>`).join('')}</tbody></table></div>`}
      </section>

      <div class="mt-8 text-center">
        <button id="reset-stats" class="text-xs text-rose-600 hover:underline">Réinitialiser mes statistiques</button>
      </div>
    `;
    document.getElementById('reset-stats')?.addEventListener('click', () => {
      if (confirm('Effacer toutes les statistiques ?')) { localStorage.removeItem(Storage.KEY); render(); }
    });
  });

  // ─── Quiz engine ─────────────────────────────────────────────────────────
  function startQuiz({ title, subtitle, backHref, questions, mode = 'train', color, examDurationSec, showChapterLabel = false, onFinish }) {
    if (!questions || questions.length === 0) {
      $app.innerHTML = `<div class="text-center py-12 text-slate-500">Aucune question disponible.</div>`;
      return;
    }

    const state = {
      idx: 0,
      picks: questions.map(() => new Set()),
      revealed: questions.map(() => false),
      mode,
      startedAt: Date.now(),
      streak: 0,
    };

    let examTimer = null;
    function startExamTimer() {
      if (mode !== 'exam' || !examDurationSec) return;
      const endAt = state.startedAt + examDurationSec * 1000;
      examTimer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
        const el = document.getElementById('exam-timer');
        if (el) {
          const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
          const ss = String(remaining % 60).padStart(2, '0');
          el.textContent = `${mm}:${ss}`;
          if (remaining < 60) el.classList.add('text-rose-600');
        }
        if (remaining === 0) { clearInterval(examTimer); finish(); }
      }, 500);
    }

    function renderQuestion() {
      const q = questions[state.idx];
      const total = questions.length;
      const progress = Math.round(((state.idx + 1) / total) * 100);
      const isMulti = q.type === 'multiple';
      const picks = state.picks[state.idx];
      const revealed = state.revealed[state.idx];
      const c = color || colors.indigo;
      const meta = META?.chapterMeta?.[q._ch] || {};

      $app.innerHTML = `
        <nav class="text-sm text-slate-500 mb-3"><a href="${backHref}" class="hover:text-slate-900">← ${escapeHtml(title)}</a></nav>

        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">${escapeHtml(subtitle)}</div>
            <div class="text-sm text-slate-700 mt-0.5">Question ${state.idx + 1} / ${total}${showChapterLabel && q._ch ? ` · <span class="text-slate-500">${escapeHtml(meta.short || meta.title || `Ch ${q._ch}`)}</span>` : ''}</div>
          </div>
          ${mode === 'exam' ? `<div class="text-right"><div class="text-[10px] uppercase tracking-wider text-slate-500">Temps</div><div id="exam-timer" class="font-mono font-bold text-xl text-slate-900">--:--</div></div>` : ''}
        </div>

        <div class="progress-bar mb-5"><div style="width:${progress}%"></div></div>

        <article class="${c.bg} border ${c.ring} rounded-2xl p-5 sm:p-6 shadow-sm">
          <div class="flex items-start gap-3 mb-4">
            <span class="inline-flex items-center justify-center w-7 h-7 rounded-full ${c.dot} text-white text-xs font-bold flex-shrink-0">${q.number || state.idx + 1}</span>
            <div class="flex-1">
              <p class="text-slate-900 font-semibold leading-relaxed">${escapeHtml(q.question)}</p>
              ${q.instruction ? `<p class="text-xs text-slate-500 mt-1.5 italic">${escapeHtml(q.instruction)}</p>` : ''}
              <p class="text-[11px] text-slate-500 mt-1">${isMulti ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</p>
            </div>
          </div>

          <div class="space-y-2.5">
            ${Object.entries(q.options || {}).map(([letter, text]) => {
              if (!text) return '';
              let stateCls = '';
              const isPicked = picks.has(letter);
              if (revealed) {
                const isCorrect = (q.correct || []).includes(letter);
                if (isCorrect && isPicked) stateCls = 'correct';
                else if (isCorrect && !isPicked) stateCls = 'missed';
                else if (!isCorrect && isPicked) stateCls = 'wrong';
              } else if (isPicked) {
                stateCls = 'selected';
              }
              return `
                <button data-letter="${letter}" class="opt-card ${isMulti ? 'multiple' : ''} ${stateCls}" ${revealed && mode === 'train' ? 'disabled' : ''}>
                  <span class="opt-mark">${stateCls === 'correct' || stateCls === 'wrong' || stateCls === 'missed' ? (stateCls === 'wrong' ? '✕' : '✓') : ''}</span>
                  <span><span class="opt-letter">${letter}.</span>${escapeHtml(text)}</span>
                </button>`;
            }).join('')}
          </div>

          ${revealed && mode === 'train' ? renderFeedback(q) : ''}
        </article>

        <div class="flex items-center justify-between mt-5 gap-3">
          <button id="prev-btn" class="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium ${state.idx === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white'}" ${state.idx === 0 ? 'disabled' : ''}>← Précédent</button>
          <div class="flex items-center gap-2">
            ${mode === 'train' && !revealed ? `<button id="check-btn" class="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40" ${picks.size === 0 ? 'disabled' : ''}>Valider</button>` : ''}
            ${state.idx < total - 1
              ? `<button id="next-btn" class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Suivant →</button>`
              : `<button id="finish-btn" class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Terminer ✓</button>`
            }
          </div>
        </div>

        <p class="text-[11px] text-slate-400 mt-6 text-center">
          <span class="kbd">←</span> précédent · <span class="kbd">→</span> suivant · <span class="kbd">a-e</span> sélectionner · <span class="kbd">Entrée</span> valider/suivant
        </p>
      `;

      bindQuestionEvents(q);

      if (mode === 'exam' && !examTimer) startExamTimer();
    }

    function renderFeedback(q) {
      const picks = state.picks[state.idx];
      const correct = q.correct || [];
      const ok = answersEqual([...picks], correct);
      const noKey = correct.length === 0;
      if (noKey) {
        return `<div class="mt-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          La correction de cette question n'a pas pu être identifiée automatiquement (question à vérifier).
        </div>`;
      }
      return `<div class="mt-5 p-4 rounded-xl ${ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}">
        <p class="font-semibold ${ok ? 'text-emerald-800' : 'text-rose-800'}">${ok ? '✓ Bonne réponse !' : '✗ Réponse incorrecte'}</p>
        <p class="text-sm ${ok ? 'text-emerald-700' : 'text-rose-700'} mt-1">Bonne réponse : <strong>${correct.map(l => l.toUpperCase()).join(', ')}</strong></p>
      </div>`;
    }

    function bindQuestionEvents(q) {
      const isMulti = q.type === 'multiple';
      const picks = state.picks[state.idx];
      const revealed = state.revealed[state.idx];

      $app.querySelectorAll('.opt-card').forEach(btn => {
        btn.addEventListener('click', () => {
          if (revealed && mode === 'train') return;
          const letter = btn.dataset.letter;
          if (isMulti) {
            picks.has(letter) ? picks.delete(letter) : picks.add(letter);
          } else {
            picks.clear(); picks.add(letter);
            if (mode === 'train') {
              state.revealed[state.idx] = true;
              handleReveal(q);
              return;
            }
          }
          renderQuestion();
        });
      });

      document.getElementById('prev-btn')?.addEventListener('click', () => { if (state.idx > 0) { state.idx -= 1; renderQuestion(); } });
      document.getElementById('next-btn')?.addEventListener('click', () => { if (state.idx < questions.length - 1) { state.idx += 1; renderQuestion(); } });
      document.getElementById('check-btn')?.addEventListener('click', () => {
        state.revealed[state.idx] = true;
        handleReveal(q);
      });
      document.getElementById('finish-btn')?.addEventListener('click', finish);
    }

    function handleReveal(q) {
      const picks = state.picks[state.idx];
      const correct = q.correct || [];
      const ok = correct.length > 0 && answersEqual([...picks], correct);
      if (ok) state.streak += 1; else state.streak = 0;
      renderQuestion();
    }

    function finish() {
      if (examTimer) { clearInterval(examTimer); examTimer = null; }
      const total = questions.length;
      let correctCount = 0;
      const detailed = questions.map((q, i) => {
        const picks = [...state.picks[i]];
        const ok = (q.correct || []).length > 0 && answersEqual(picks, q.correct);
        if (ok) correctCount += 1;
        return { q, picks, ok };
      });
      const durationSec = Math.round((Date.now() - state.startedAt) / 1000);
      const pct = Math.round(100 * correctCount / total);

      if (onFinish) onFinish({ correctCount, total, durationSec });

      // 🎉 Easter egg: buddy surprise-appears at the end of the QCM set
      buddy.surprise({ pct });

      $app.innerHTML = `
        <nav class="text-sm text-slate-500 mb-4"><a href="${backHref}" class="hover:text-slate-900">← Retour</a></nav>
        <section class="text-center mb-8 animate-slide-up">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">${escapeHtml(title)}</p>
          <div class="my-4 inline-flex items-baseline gap-1.5">
            <span class="text-6xl font-extrabold ${pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}">${correctCount}</span>
            <span class="text-2xl text-slate-400 font-bold">/ ${total}</span>
          </div>
          <p class="text-slate-700 font-medium">${pct}% de bonnes réponses</p>
          <p class="text-xs text-slate-500 mt-1">Durée : ${Math.floor(durationSec / 60)} min ${durationSec % 60}s</p>
        </section>

        <section>
          <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Correction détaillée</h2>
          <div class="space-y-3">
            ${detailed.map(({ q, picks, ok }, i) => {
              const correct = (q.correct || []).map(l => l.toUpperCase()).join(', ') || '—';
              const yours = picks.length ? picks.map(l => l.toUpperCase()).join(', ') : '(rien)';
              return `<details class="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <summary class="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50">
                  <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${ok ? '✓' : '✗'}</span>
                  <span class="text-sm font-medium text-slate-900 flex-1">Q${i + 1}. ${escapeHtml(q.question.slice(0, 90))}${q.question.length > 90 ? '…' : ''}</span>
                  <span class="text-xs text-slate-500">Vous: ${yours} · Bon: ${correct}</span>
                </summary>
                <div class="px-4 pb-4 border-t border-slate-100 pt-3">
                  <p class="text-sm text-slate-700 mb-3">${escapeHtml(q.question)}</p>
                  <ul class="space-y-1.5 text-sm">
                    ${Object.entries(q.options || {}).map(([letter, text]) => {
                      if (!text) return '';
                      const isCorr = (q.correct || []).includes(letter);
                      const isPick = picks.includes(letter);
                      const cls = isCorr ? 'text-emerald-700 font-medium' : isPick ? 'text-rose-700' : 'text-slate-600';
                      const mark = isCorr ? '✓' : isPick ? '✗' : '·';
                      return `<li class="${cls}"><span class="inline-block w-4">${mark}</span> <strong>${letter}.</strong> ${escapeHtml(text)}</li>`;
                    }).join('')}
                  </ul>
                </div>
              </details>`;
            }).join('')}
          </div>
        </section>

        <div class="mt-8 flex flex-wrap gap-3 justify-center">
          <button id="retry" class="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Refaire</button>
          <a href="${backHref}" class="px-5 py-2.5 rounded-lg border border-slate-300 font-medium hover:bg-white">Retour</a>
          <a href="#/stats" class="px-5 py-2.5 rounded-lg border border-slate-300 font-medium hover:bg-white">Mes stats</a>
        </div>
      `;
      document.getElementById('retry').addEventListener('click', () => render());
    }

    // Keyboard shortcuts
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const q = questions[state.idx];
      if (!q) return;
      if (e.key === 'ArrowLeft' && state.idx > 0) { state.idx -= 1; renderQuestion(); }
      else if (e.key === 'ArrowRight') {
        if (state.idx < questions.length - 1) { state.idx += 1; renderQuestion(); }
      } else if (e.key === 'Enter') {
        const checkBtn = document.getElementById('check-btn');
        const nextBtn = document.getElementById('next-btn');
        const finishBtn = document.getElementById('finish-btn');
        if (checkBtn && !checkBtn.disabled) checkBtn.click();
        else if (nextBtn) nextBtn.click();
        else if (finishBtn) finishBtn.click();
      } else if (/^[a-eA-E]$/.test(e.key)) {
        const letter = e.key.toLowerCase();
        if (!q.options[letter]) return;
        const btn = $app.querySelector(`.opt-card[data-letter="${letter}"]`);
        if (btn && !btn.disabled) btn.click();
      }
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

    renderQuestion();
  }

  // ─── Boot ────────────────────────────────────────────────────────────────
  render();
})();
