# SoundPrint — [MYC]

Originally: AI platform to reverse-engineer sounds into stock DAW presets (Ableton/FL/Logic).
Stream tag [MYC] — repos/ catchall in /Users/spy/ToledoTech/STREAMS.md; no product stream assigned.

## STATUS: dormant + product direction in flux
- Last commits 2026-02-14 (Visual DAW PR #1); GitHub `tyzeeington/soundprint`.
- Org memory (MYC__project_soundprint_pivot): 2026-05-08 Sean pivoted SoundPrint toward a
  children's iPad toy at $5.99. Repo disposition undecided (repurpose vs archive vs new repo).
  The old adult audio-production direction (and the archived `soundprint-full` FastAPI backend
  elsewhere) is NOT the active trajectory. Treat this repo as reference/in-flux, not active build.
- The README's "Planned" backend/ML stack (FastAPI, Lambda, Librosa) was never built here.

## What actually exists (all static HTML/JS — no build system, no package.json, no tests)
- `landing-page/index.html` — static landing page with email capture
- `play/` — browser toy (index.html + play.js, Web Audio)
- `visual-daw/` — the most-developed piece: PWA visual DAW with sign-language control,
  sequencer, session view, MIDI follow, visualizer, voices/ (manifest.json + sw.js = installable)
- `docs/ARCHITECTURE.md`, `docs/BRAND.md`; root CONTRIBUTING.md, DEPLOYMENT.md, QUICKSTART.md

## Run / verify (only meaningful commands)
- Serve any piece locally: `python3 -m http.server 8000` from repo root, then open
  `/landing-page/`, `/play/`, or `/visual-daw/` (visual-daw needs a server for the service worker)
- Deploy: static hosting (GitHub Pages etc.) per DEPLOYMENT.md — no build step

## Gotchas
- Before building anything new here, check whether the children's-toy pivot has landed a
  decision — new adult-production features would be building against a dead direction
- `visual-daw/sw.js` caches aggressively; bump the cache name when changing assets
- QUICKSTART.md is first-push boilerplate (repo already on GitHub) — ignore its git setup steps
