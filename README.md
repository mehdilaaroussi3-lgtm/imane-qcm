# MICI QCM — Préparation Examen Gastro-entérologie

Independent QCM training app built for Imane's gastro-entérologie exam prep.

## Stack

- 100% static SPA — **no build step**
- Vanilla HTML / Tailwind (CDN) / vanilla JS
- All questions stored as JSON in `data/chapters/`
- Deploys to Vercel as a static site (no Node needed)

## Folder layout

```
imane-qcm-app/
├── index.html          single-page entry
├── app.js              router + quiz engine + buddy controller
├── styles.css          buddy animations + option-card styling
├── vercel.json         static-host config + cache headers
├── .vercelignore       keeps _work/ out of the deploy
├── data/
│   ├── index.json      themes + chapter manifest
│   └── chapters/
│       ├── ch1.json …  one file per chapter (22 in total)
└── public/
    └── avatar.svg
```

## Content

**22 chapter files** covering 246 questions across MICI (Maladies Inflammatoires Chroniques de l'Intestin):

| # | Chapter | Theme |
|---|---|---|
| 1 | Épidémiologie | Fondamentaux |
| 2 | Génétique | Fondamentaux |
| 3 | Microbiote | Fondamentaux |
| 4 | Facteurs de risque | Fondamentaux |
| 5 | Réponse inflammatoire | Fondamentaux |
| 6 | Diagnostic | Diagnostic & Évolution |
| 7 | Histoire naturelle | Diagnostic & Évolution |
| 8 | Endoscopie | Diagnostic & Évolution |
| 9 | Surveillance | Diagnostic & Évolution |
| 10 | LAP | Atteintes spécifiques |
| 11-12-13 | Manifestations extra-digestives | Atteintes spécifiques |
| 14 | Grossesse | Atteintes spécifiques |
| 15 | Cancer | Atteintes spécifiques |
| 16 | Nutrition | Atteintes spécifiques |
| 17 | Traitements non immunosuppresseurs | Traitements |
| 18 | Corticoïdes | Traitements |
| 19 | Traitements immunosuppresseurs | Traitements |
| 20 | Biothérapie | Traitements |
| 21 | Futurs traitements | Traitements |
| 22-23 | Chirurgie | Chirurgie & Stratégie |
| 24 | MICI pédiatrique | Chirurgie & Stratégie |
| 25-26 | Stratégie thérapeutique | Chirurgie & Stratégie |

Each question has `{ id, number, type (single|multiple), question, options{a-e}, correct[], source_image, unmarked }`.

## Features

- **Chapter mode** — work through every question in a chapter (immediate feedback)
- **Theme mode** — see all chapters in a theme
- **Mixed mode** — random 20 from all chapters
- **Examen blanc** — timed (default 60 min, 40 questions), no feedback until end, full review
- **Theme-restricted exam** — timed exam restricted to one theme's chapters
- **Stats** — per-chapter best score + recent exams (localStorage, no backend)
- **Keyboard shortcuts** — `a-e` to pick, `←/→` to navigate, `Enter` to validate / advance
- **Easter egg** — surprise buddy avatar pops up at the end of every QCM set with motivational messages (English)

## Run locally

It's pure static. Any local HTTP server works:

```bash
cd imane-qcm-app
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Vercel

**Option A — Drag & drop (no install needed):**

1. Open <https://vercel.com/new>
2. Click **"Other"** / **"Deploy"**
3. Drag the entire `imane-qcm-app/` folder onto the upload area
4. Project name: `imane-qcm` (or anything)
5. Click **Deploy**

The site is live in ~30 seconds. No build step.

**Option B — Vercel CLI:**

```bash
# install Node first (one-time):
brew install node

cd imane-qcm-app
npx vercel             # first deploy (preview URL)
npx vercel --prod      # production URL
```

You'll be asked to log in on first run.

**Option C — GitHub + Vercel dashboard:**

1. Push the `imane-qcm-app/` folder to a new GitHub repo
2. On <https://vercel.com/new>, import the repo
3. Framework preset: **Other** (static)
4. Build command: _(empty)_
5. Output directory: `.`
6. Click Deploy

Either way it lives in seconds — no Node build needed.

## Audit

A full audit comparing every extracted question to the docx reference is in `_work/AUDIT_REPORT.md`. Result on the final pass:

- **246** questions across 22 chapters
- **245** matched to the correct reference question (number + stem)
- **6** flagged `unmarked: true` (image was illegible — needs a clean screenshot)
- **0** real misnumberings remaining
