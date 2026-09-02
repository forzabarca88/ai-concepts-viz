# How Machines Talk — ai-concepts-viz

A friendly, interactive tour of large language models for a **non-technical** audience. No math required — just curiosity.

The site is a ten-lesson course. Every lesson teaches one LLM concept through an original, hands-on visualisation in which **you make the decisions** — and 10 of the 11 lessons add a 3D layer — all deliberately calm and well-crafted. The golden rule: **make learning about LLMs fun, not intimidating** (see `SPEC.md`).

Technically it is a static single-page app — **Vite 7 + vanilla TypeScript + hash routing + Three.js** — with every dependency pinned to an exact version, so it builds identically everywhere and deploys to GitHub Pages as-is.

## The tour

| #   | Route              | Section                     |
| --- | ------------------ | --------------------------- |
| 00  | `#/`               | Start here — next-token prediction hero + map of the course |
| 01  | `#/data`           | Data to train an LLM        |
| 02  | `#/tokenisation`   | Tokenisation                |
| 03  | `#/parameters`     | Parameters & learning       |
| 04  | `#/pretraining`    | Pre-training                |
| 05  | `#/sft`            | Supervised fine-tuning      |
| 06  | `#/preferences`    | Preference fine-tuning      |
| 07  | `#/tool-calling`   | Tool calling                |
| 08  | `#/skills`         | Skills                      |
| 09  | `#/mcp`            | MCP servers                 |
| 10  | `#/agent`          | AI agent demo               |

The sections are grouped like a curriculum — **Core ideas** (01–03), **How it's trained** (04–06), **Going agentic** (07–10). The numbers are intentional: order carries meaning.

Routes are hash-based and auto-discovered: each section is a folder `src/sections/<name>/` exporting a `page.ts`, and the router (`src/router.ts`) picks them up via `import.meta.glob` — folder name = route.

## Quickstart

Requires **Node 24+** (developed on Node 24.15).

```sh
npm ci            # install the exact pinned toolchain
npm run dev       # dev server → http://localhost:5173/ai-concepts-viz/
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build → http://localhost:4173/ai-concepts-viz/
```

The `/ai-concepts-viz/` prefix in both URLs is the Vite `base` path — local serving is byte-for-byte the same as the GitHub Pages deployment (see [Deployment](#deployment-github-pages)).

## Scripts

| Script              | What it does                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`       | Vite dev server on `:5173` (strict port).                                          |
| `npm run build`     | `tsc --noEmit` typecheck, then Vite production build to `dist/`.                   |
| `npm run preview`   | Serve `dist/` on `:4173` (strict port).                                            |
| `npm run test`      | Unit tests (Vitest + Testing Library, jsdom).                                      |
| `npm run e2e`       | Playwright e2e + screenshot suite (builds and previews the app itself).            |
| `npm run e2e:update`| Same as `e2e` but rewrites the screenshot baselines — only after an intentional visual change. |
| `npm run verify`    | The full gate: `test` → `build` → `e2e`.                                           |

## Testing strategy

Two layers, matching the spec: **every interactive element has a unit test, and every transition state has a screenshot.**

### 1. Unit tests — the end result, no mocks

Vitest + `@testing-library/dom` in jsdom. A test clicks a real control (button, toggle, slider, picker) and asserts the **visible end result** — label text, ARIA state, DOM output — never internal implementation. There are no mocks: pages are mounted through the real shell (`src/test/mountPage.ts`). Three.js scenes degrade in jsdom (a `.viz-fallback` note replaces the canvas), and every state a canvas would show is mirrored into the DOM, so the controls stay fully testable without WebGL.

### 2. Screenshots — every state, byte-stable

Playwright, pinned to `@playwright/test@1.61.1` (which matches the locally cached Chromium revision, so no browser download is needed during local development — on a fresh environment or in CI, run `npx playwright install --with-deps chromium` first, exactly as the CI workflow does), drives the production build at 1280×800. Each section has an `*-initial` shot plus one shot per interactive/transition state; the **63 baselines** are committed under `e2e/*-snapshots/` (per-platform `*-linux.png` names).

**The `.pw` freeze protocol.** Screenshot determinism comes from freezing time, not from tolerance:

- the shared fixture (`e2e/helper.ts` — the only entry point specs may import) `addInitScript`s `class="pw"` onto `<html>` before any app code runs;
- `base.css` then pauses every CSS animation and disables transitions under `.pw`;
- `reducedMotion: "reduce"` is set in `playwright.config.ts`;
- `shot(name)` waits for `document.fonts.ready`, fast-forwards any in-flight animation to its end state, then captures with `maxDiffPixelRatio: 0.02` — a deliberately minimal capture path (the `animations: "disabled"` screenshot option is a no-op under the freeze, so it is intentionally not used);
- `createStage3D` detects the `.pw` class and renders exactly **one frame** per state change instead of spinning a `requestAnimationFrame` loop.

**Determinism rules** — every pixel is a pure function of the UI state:

- **Seeded PRNG only:** `mulberry32` in `src/three/helpers.ts`; `Math.random()` is banned in any render/test path (3D point positions, knob schedules, particle mixes are all seed-derived).
- **Fixed copy:** every example sentence, model answer and counter value is a hardcoded list — nothing is generated at runtime.
- **User-typed text (the tokenisation section)** is tokenized by a fixed dictionary plus a deterministic djb2 hash of the input — a pure function of the input, never of time or randomness.
- **No `Date`, no network, no ambient time.**
- **State-invariant stage heights:** a section's stage keeps the same height in every state (fixed-height scroll regions pinned to the bottom), so all states of a section share one scroll position and one framing.
- **No tweens:** transitions are discrete, control-gated states applied immediately.

The acceptance bar: repeated `npm run e2e` runs must pass with **zero baselines rewritten** (byte-identical PNGs). Flake is treated as a freeze-protocol bug to fix — never by widening the pixel tolerance.

## Deployment (GitHub Pages)

The site is a static build — the only hard constraint from `SPEC.md`.

1. Push the repo to GitHub (repo name **ai-concepts-viz**).
2. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. That's it. On every push to `main`, the `ci` job gates the `deploy` job (`.github/workflows/ci.yml`), which builds and publishes `dist/` via `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`. The deploy step runs under the `github-pages` environment — that is how GitHub Pages + Actions authentication works (GitHub only lets workflows running under that environment publish to the repo's Pages site).

Live site: **https://forzabarca88.github.io/ai-concepts-viz/**

**Why is `base: '/ai-concepts-viz/'` set in `vite.config.ts`?** GitHub Pages serves a repo site from a path named after the repo — not from `/`. Every asset URL therefore needs the `/ai-concepts-viz/` prefix, and that `base` is also why the local dev/preview URLs include it.

**Why no `404.html`?** The app is hash-routed (`#/tokenisation`): the server only ever sees the root path — everything after `#` is handled in the browser — so deep links can never 404.

## Project layout

```
.github/workflows/ci.yml        CI + GitHub Pages deployment
e2e/                            Playwright specs + committed screenshot baselines
  helper.ts                     shared test fixture (.pw freeze + shot())
  <name>.spec.ts-snapshots/     per-section baselines
public/                         static assets (favicon), copied to dist/
src/
  main.ts · router.ts           entry + hash router (auto-discovers sections)
  shell/                        nav data, page template, design system (tokens.css, base.css)
  sections/<name>/              one folder per section (page.ts + scoped CSS + viz)
  three/helpers.ts              seeded PRNG + freeze-aware createStage3D
  test/mountPage.ts             jsdom mounting helper for unit tests
```
