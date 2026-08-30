# SCOUT.md — Shared Context for RALPH Loop

## Requirement
> The user interactions in this site are shallow and not good enough. Rework them to offer the user genuine thought provoking and ENGAGING interactions. As an example, there are multiple instances where the user simply clicks a button to advance; this is not genuine interactivity. There is also not enough 3D, and the general aesthetic is extremely boring. Resolve all these issues, ensure that your solution still adheres to @SPEC.md.

## Files Retrieved

### Spec & constraints
1. `SPEC.md` — the requirements: static site on GitHub Pages, Apple-level UX, 3D "where it makes sense", interactive visualisations that **teach**, unit test for every interactive element, screenshot for every transition state, "make it fun, not intimidating".
2. `AGENTS.md` — production standards, minimal ARRANGE/ACT/ASSERT tests on end results, no excessive mocks, must validate UI via screenshots/Playwright, must verify any started app is stopped before finishing.
3. `README.md` — documents the determinism/freeze protocol, the "zero baselines rewritten" acceptance bar, the 72 committed screenshot baselines, and the two testing layers.
4. `package.json` — Vite 7 + vanilla TS + `three@0.185.1` + `@playwright/test@1.61.1` + vitest/jsdom; scripts: `test`, `build`, `e2e`, `e2e:update`, `verify`.
5. `playwright.config.ts` — 1280×800, `reducedMotion: 'reduce'`, `maxDiffPixelRatio: 0.02`, webServer = `build && vite preview` on 4173, `workers: 2` (SwiftShader memory).
6. `.github/workflows/ci.yml` — CI = build + unit tests + e2e; deploy to GitHub Pages on `main`.
7. `vite.config.ts` — `base: '/ai-concepts-viz/'` (GitHub Pages repo path; local dev/preview URLs include it).

### Core framework
8. `src/main.ts` — imports self-hosted fonts + CSS, calls `startRouter()`.
9. `src/router.ts` — hash router; **`Page` contract (lines 20–30) must not change shape**; auto-discovers `src/sections/*/page.ts` via `import.meta.glob`; `startRouter()` handles shell, hashchange, cleanup, focus management.
10. `src/shell/shell.ts` — persistent chrome: ambient token field (12 hardcoded drifting chips), header + grouped nav, shared page template (`renderPage`: `.page-hero` + `.page-content` + `.pager`), footer.
11. `src/shell/nav.ts` — single source of truth: 10 sections in 3 curriculum groups (Core ideas 01–03, How it's trained 04–06, Going agentic 07–10).
12. `src/three/helpers.ts` — `mulberry32` seeded PRNG (the **only** allowed randomness); `createStage3D()` with **freeze protocol** (`<html class="pw">` → single `frame()` per state, no rAF), WebGL fallback (`.viz-fallback` note), `dispose()`, and a `loop: boolean` option for ambient rAF loops that are **disabled under freeze** — this is the sanctioned way to add live 3D motion.

### Design system (the "boring aesthetic" lives here)
13. `src/shell/tokens.css` — **authoritative design tokens**: header comment says "All tasks must use these exact names; do not add or rename." Palette: paper `#F4F5F7`, white surface, stage `#0B101F`, ink `#101418`, accent blue `#3452FF`, amber `#FFB020`, coral `#FF6B5E`, mint `#22C48E`. Type: display/body/mono fonts, hero clamp 2.75–4.25rem. Motion: `--ease-out`, `--dur-fast/med/slow`. (Values may be re-themed; names must stay.)
14. `src/shell/base.css` — reset, type scale, `.btn` (pill), `.chip`, `.toggle` (switch), `.stage` (dark card, `min-height: 420px`), `.explain-grid` (3 white cards), `.metric`, `.pager`, focus-visible, responsive @48rem, `prefers-reduced-motion`, and **the `.pw` freeze** (lines 400–412: pause all animations, kill all transitions).
15. `src/shell/shell.css` — token-field drift keyframes, sticky header, nav strip, `page-enter` transition, stage-bar hint styles, footer.

### Sections (each: `page.ts` + `viz.ts` + scoped CSS + vitest file)
16. `src/sections/home/viz.ts` — next-token hero (3 fixed sentences × 3 candidates with % bars; pick → fills blank + one-line explainer; "New sentence" cycles), overview map (10 link cards), explain cards.
17. `src/sections/data/viz.ts` — **3D section 1**: 2,900-point "river of pages" down a Catmull-Rom tube past 3 filter rings + 180 token chips; **click-to-advance** "Next filter" ×3 gated steps + "Start over", 4 topic toggles that re-weight the river/mix bar. Contains the **two reusable 3D resilience patterns** (lines ~240–330): 2D blit of GL frame after every `frame()`, and `webglcontextlost` → full stage teardown + seeded rebuild + state re-apply.
18. `src/sections/tokenisation/viz.ts` — DOM/CSS: sentence as clickable token chips (inspector shows vocab id), 3-stop grain slider (character/subword/word), "Add an emoji" (rocket = 3 tokens), "Now you try" mini next-token.
19. `src/sections/parameters/viz.ts` — **3D section 2**: 2,000-point "knob cloud" sphere + spotlight rings; **click-to-advance** "Train one step" ×10 (seeded Fisher–Yates: 200 knobs/step), "Inspect a knob" cycles 4 fixed knobs, 3-stop size slider (1M/7B/70B rescales via `group.scale.setScalar()`), knowledge meter.
20. `src/sections/pretraining/viz.ts` — DOM: "training gym"; **click-to-advance** "Teach a batch" (+100 tokens, appends next of 8 fixed guess-the-next-word lines), 4-stop **log** slider (1M→15T Llama 3.1 figure), 4 skill badges unlocking at thresholds, "See the raw model" toggle.
21. `src/sections/sft/viz.ts` — DOM: Base vs Instruct chat panels answering same prompt (3-option picker), **click-to-advance** "Add 10 examples" (1→10→100, quality 20→60→90%), "Show a training pair" one-shot reveal.
22. `src/sections/preferences/viz.ts` — DOM: prompt + answer A (good) vs B (bad), "This one!" votes, reward meter 50/50 → 80/20, **click-to-advance** "Train on that" ×2, "Reset vote".
23. `src/sections/tool-calling/viz.ts` — SVG flow: user → model → tool hexagon → answer, 4-beat gutter; 3-option question picker; "Tools: on/off" switch; **click-to-advance** "Step through the call" ×4.
24. `src/sections/skills/viz.ts` — DOM/SVG robot with 3 chest lights; **click-to-advance** "Teach a skill" cycles 3 fixed skills into backpack, 3-task board, readiness line = pure function of (learned, task).
25. `src/sections/mcp/viz.ts` — DOM/SVG: 2 apps · USB-C socket · 3 server plugs; per-app docked sets, "connected: X" chips, "N tools ready" status, "Unplug all". (The least shallow section already — toggle-based.)
26. `src/sections/agent/viz.ts` — DOM: goal card + timeline; **click-to-advance** "Next step" walks a fixed 6-entry run (tools on) or 3-entry failure run (tools off); "Skip to the end", "Restart", Tools switch; Think→Act→Observe loop badge.

### Testing infrastructure
27. `src/test/mountPage.ts` — mounts a `Page` through the **real** router template in jsdom; no mocks.
28. `e2e/helper.ts` — the only entry point for e2e: `addInitScript` adds `class="pw"` before app code; `shot(name)` waits `document.fonts.ready`, finishes in-flight animations, asserts `toHaveScreenshot(name, { maxDiffPixelRatio: 0.02 })`; name must end `.png`; baselines per-platform `*-linux.png`.
29. `e2e/data.spec.ts` — representative e2e: `scrollToSelector` + per-state shots.
30. `e2e/agent.spec.ts` — canonical **click-advance** e2e pattern: `nextStep(page).click()` repeated N times, one shot per visited state.
31. `src/sections/data/data.test.ts` — representative unit test: DOM-mirror assertions, `.viz-fallback` check, `window.resize` listener hygiene (balanced add/remove across mount/unmount cycles).
32. `src/sections/home/home.test.ts` — unit test style: `@testing-library/dom` queries, ARRANGE/ACT/ASSERT comments, end-result assertions.
33. All 11 section unit tests: `src/sections/{home,data,tokenisation,parameters,pretraining,sft,preferences,tool-calling,skills,mcp,agent}/*.test.ts` + `src/shell/shell.test.ts`, `src/router.test.ts` — **all assert the current interaction names/behaviours and will need rework in lockstep**.
34. 12 e2e specs: `e2e/{env,home,data,tokenisation,parameters,pretraining,sft,preferences,tool-calling,skills,mcp,agent}.spec.ts` — **72 committed baselines** in `e2e/*-snapshots/`.
35. Screenshots examined: `e2e/home.spec.ts-snapshots/home-initial-linux.png`, `e2e/data.spec.ts-snapshots/data-initial-linux.png` + `data-complete-linux.png`, `e2e/parameters.spec.ts-snapshots/par-step-5-linux.png`.

## Key Code

### The Page contract (do not change — `src/router.ts` lines 20–30)
```typescript
export interface Page {
  title: string;      // h1
  eyebrow: string;    // e.g. "02 · Core ideas"
  lede: string;       // one plain-English sentence
  mount(root: HTMLElement): () => void;  // MUST return a cleanup function
}
```

### The 3D helper — freeze protocol + the `loop` escape hatch (`src/three/helpers.ts`)
```typescript
export interface Stage3DOptions {
  seed?: number;          // deterministic PRNG (mulberry32)
  camera?: Stage3DCameraOptions; // fixed camera — screenshots must never move it
  loop?: boolean;         // rAF ambient loop; IGNORED under <html class="pw"> and in jsdom
}
export interface Stage3DHandle {
  fallback: boolean;      // true → .viz-fallback note rendered, scene/camera/renderer null
  scene: THREE.Scene | null; camera: THREE.PerspectiveCamera | null; renderer: THREE.WebGLRenderer | null;
  rand: () => number;
  frame(): void;          // render exactly one frame; call after every state change
  dispose(): void;        // releases GL context, geometries, materials, DOM
}
```
Note: current scenes hardcode `scene.background = new THREE.Color('#0b101f')` inside the helper — a global aesthetic lever.

### The two mandatory 3D resilience patterns (`src/sections/data/viz.ts` ~lines 240–330, replicated in `parameters/viz.ts`)
```typescript
// (a) 2D blit: preserveDrawingBuffer:false → GL buffer cleared by compositor;
// every frame() is followed in the same task by copy into a persistent 2D canvas.
const render = () => {
  handle.frame();
  if (!handle.fallback && blit) {
    const gl = handle.renderer?.domElement;
    if (blit.canvas.width !== gl.width || blit.canvas.height !== gl.height) { /* resize */ }
    blit.ctx.drawImage(gl, 0, 0);
  }
};
// (b) SwiftShader evicts WebGL contexts → on webglcontextlost: dispose,
// recreate createStage3D, buildScene, re-apply current DOM state, render.
h.renderer?.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  handle.dispose();
  handle = createStage3D(canvasWrap, stageOpts);
  refs = handle.fallback ? null : buildScene(handle);
  refs?.setRiver(activeTopics); refs?.setRings(step);
  render();
  wireLost(handle);
});
```
Any new/expanded 3D stage **must** replicate both, plus the `window.resize` blit-repaint listener (removed in cleanup — there's a dedicated leak test).

### Design tokens — authoritative names (`src/shell/tokens.css`)
```css
:root {
  --paper: #F4F5F7;  --surface: #FFFFFF;
  --stage: #0B101F;  --stage-2: #131C33;
  --ink: #101418;    --ink-soft: #46505E;  --ink-faint: #8A94A6;
  --on-stage: #F2F5FA;  --on-stage-soft: #9FA8BC;
  --accent: #3452FF;   --accent-soft: #E4E9FF;  --accent-glow: #6E85FF;
  --amber: #FFB020;    --amber-ink: #8A5A00;    --amber-glow: #FFC966;
  --coral: #FF6B5E;    --mint: #22C48E;
  /* + font stacks, text scale, space/radius/shadow, --ease-out, --dur-fast/med/slow */
}
```

### The `.pw` freeze — every screenshot depends on it (`src/shell/base.css` lines 400–412)
```css
.pw *, .pw *::before, .pw *::after {
  animation-play-state: paused !important;
  transition: none !important;
}
```

## Architecture

**Stack**: static Vite SPA, vanilla TS, hash routing, Three.js. `main.ts` → `startRouter()` builds shell chrome once (`renderShell`), then per route fills `main.page` with the shared template (hero + `.page-content` + `.pager`) and calls `page.mount(host)`, which returns a cleanup run on every route change. Sections are auto-discovered folders: folder name = route.

**Every section** = `page.ts` (Page contract) + `viz.ts` (one or more `mount*(root): () => void` functions that build DOM in jsdom-safe way and return cleanup removing their subtree) + section CSS scoped under `.page--<name>` + a vitest file + an e2e spec with per-state screenshot baselines.

**Two visualisation tiers**:
- **3D tier** (only `data` + `parameters`): `createStage3D` + `THREE.Points` only (no meshes/lights/shadows; ≤3,000-point budget; seeded positions; fixed camera; one `frame()` per state; blit + context-loss rebuild). All visible state is **mirrored in DOM** so jsdom tests and the fallback path keep working.
- **DOM/CSS/SVG tier** (the other 8 sections): pure DOM state machines — every visual state is a pure function of a small state object; `render()` rebuilds/patches; no canvas.

**Determinism contract** (README, non-negotiable for the rework): seeded PRNG only (`mulberry32`; `Math.random()` banned in render/test paths), fixed hardcoded copy, no `Date`/network, state-invariant stage heights (fixed scroll framing), no tweens in test-observed state, byte-identical screenshots across repeated `npm run e2e` runs.

**Testing pyramid**: unit = vitest + jsdom + Testing Library through the *real* shell (`mountPage.ts`), asserting visible end results, no mocks; e2e = Playwright on the production build, one `shot()` per transition state (72 baselines total).

## Findings against the three complaints

### 1. "Shallow click-to-advance" — inventory (8 sections affected)
| Section | Current interaction | Why it's shallow |
|---|---|---|
| data | "Next filter" ×3, "Start over" | scripted 4-step walk; user only watches |
| parameters | "Train one step" ×10, "Inspect a knob" (cycles 4 fixed) | 10 identical presses; inspect never follows user intent |
| pretraining | "Teach a batch" (100 tok/press) | button-mash; the 8 example sentences are appended, never *played* |
| sft | "Add 10 examples" ×2, "Show a training pair" | 2 presses + one reveal; panels are read-only |
| preferences | "This one!" then "Train on that" ×2 | 3 clicks total to "finish" the concept |
| tool-calling | "Step through the call" ×4 | 4 identical captions; question is pre-chosen from 3 |
| skills | "Teach a skill" (cycles fixed order) | user can't pick *which* skill to teach |
| agent | "Next step" ×6/×3, "Skip" | entire run is a hardcoded script; user has zero agency |
Already better (keep the patterns): home (pick-a-candidate), tokenisation (chip click / grain slider / emoji), mcp (plug toggles).

### 2. "Not enough 3D"
Only 2/11 sections have any 3D, and both are flat `PointsMaterial` dot-clouds on a solid `#0B101F` background. 9 sections are pure 2D DOM/SVG. Candidate upgrades per concept: tokenisation (tokens as 3D chips/orbiting fragments), pretraining (growing 3D "diet" volume / loss-landscape), sft (two 3D model "brains" diverging), preferences (3D seesaw/scale for the reward meter), tool-calling (3D relay of message packets), skills (3D backpack/robot), mcp (3D plug-and-socket), agent (3D loop orbit), home (3D hero). All must obey: ≤~3k points/meshes light enough for SwiftShader, fixed camera for shots, blit + contextlost patterns, DOM state mirror.

### 3. "Boring aesthetic"
The current look is a light-grey page with white cards and a flat dark-navy stage; single blue accent used almost everywhere; ambient token chips at 5% opacity; minimal color, no gradients/glow/depth; type is clean but the whole thing reads corporate-default. The design system (`tokens.css` + `base.css` + `shell.css`) is small and centralized — a re-theme is high-leverage: token *names* are frozen but *values* can change; the frozen `.pw` protocol means richer CSS (gradients, glows, more keyframed motion) is safe as long as end-states are deterministic. A `frontend-design` skill is available at `/home/forza/.pi/agent/skills/frontend-design/SKILL.md` (brainstorm a compact token system + one "signature" element, avoid AI-default looks, two-pass plan→critique→build) and is directly on-brief for the aesthetic rework.

## Risks / Anti-patterns to watch
- **Do not** change the `Page` contract or section-folder routing.
- **Do not** add `Math.random()`, `Date`, or network anywhere in render paths; any new "randomness" must come from `mulberry32`.
- **Do not** let stage heights change between states (breaks deterministic e2e scroll framing).
- **Do not** use `animations: 'disabled'` in Playwright screenshot options.
- **Do not** rename/add design tokens; re-theme by changing values.
- Any **new 3D stage** must: pass the jsdom fallback (`.viz-fallback`), replicate blit + contextlost + resize-listener hygiene, and keep a DOM mirror of every visual state.
- User-driven camera motion (e.g. drag-to-orbit) is only screenshot-safe if the *initial* and *post-interaction* states are deterministic.
- All 72 screenshot baselines and ~13 unit-test files assert current copy/controls/behaviours; rework of interactions **requires** synchronized test updates + `npm run e2e:update` (README: baselines rewritten "only after an intentional visual change" — this task is that change).
- AGENTS.md: if you start `vite preview`/dev server for screenshots, verify it is stopped before completing.

## Start Here
1. **`SPEC.md` + README "Determinism rules"** — the two rulebooks.
2. **`src/shell/tokens.css` + `src/shell/base.css` + `src/shell/shell.css`** — re-theme here first (one pass touches all 11 pages).
3. **`src/three/helpers.ts`** — extend the 3D toolkit (shared glow/backdrop, richer material helpers) so 6–8 new 3D stages can reuse it.
4. **`src/sections/data/viz.ts` + `parameters/viz.ts`** — the reference implementations of the 3D resilience patterns.
5. **Per-section rework** — attack the click-to-advance sections; for each: redesign interaction → update `viz.ts` (keep DOM mirror) → update section unit test → update e2e spec → regenerate that spec's baselines.
6. **`e2e/helper.ts` + `playwright.config.ts`** — read once before writing e2e.
7. Finish with `npm run verify` (test → build → e2e) and confirm the preview server is stopped.
