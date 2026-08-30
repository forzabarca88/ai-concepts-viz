# PLAN.md — RALPH Implementation Plan

## Goal

Rework the site's shallow click-to-advance interactions into user-driven, decision-making experiences, add 3D to 10 of 11 sections, and replace the "boring" light-grey aesthetic with a distinctive dark "night observatory" theme — all while keeping the Page contract, section routing, and the determinism/freeze protocol intact, with every unit test, e2e spec, and screenshot baseline updated in lockstep.

## Shared conventions (apply to EVERY task below)

- **Determinism contract (non-negotiable):** randomness only from `mulberry32` (via `createStage3D`/`createStageKit` `rand`); no `Math.random()`, `Date`, or network in render paths; all copy/data hardcoded; stage heights state-invariant (any area whose content changes between states must reserve a fixed `min-height`); transitions are discrete control-gated states.
- **3D rules:** ≤ ~1,500 scene points per stage (+≤ 300 starfield), fixed camera, one `frame()` per state, `alpha: true` + CSS gradient backdrop via the kit (task 2), jsdom must render `.viz-fallback` and every visual state stays mirrored in the DOM.
- **3D "background layer" pattern** (for adding 3D to an existing DOM stage): a dedicated wrapper div with class `stage-3d-layer` (provided by task 1 in `base.css`: `position:absolute; inset:0; aria-hidden` layer inside the `position:relative` stage, DOM content on top at higher z-index). The wrapper's height never changes between states.
- **Per-section task checklist:** rewrite `viz.ts` (keep every `mount*(root): () => void` export name used by `page.ts`; return cleanup that removes the subtree and removes window listeners), update the section CSS (scoped under `.page--<name>`), rewrite the section unit test (ARRANGE/ACT/ASSERT, end-result assertions via `src/test/mountPage.ts`, include a `.viz-fallback` assertion for 3D sections and the balanced resize-listener hygiene test for any section using the kit), rewrite the e2e spec (import only from `./helper`; use the `scrollToSelector` house pattern; one `shot()` per transition state; names end `.png`), then run:
  1. `npm run test` → green
  2. `npx playwright test e2e/<spec>.spec.ts --update-snapshots`
  3. `npx playwright test e2e/<spec>.spec.ts` → green against the fresh baselines
  4. confirm no dev/preview server is left running (AGENTS.md)
- **Do NOT touch:** `src/router.ts`, `src/shell/nav.ts`, any `page.ts` (Page contract copy stays), `e2e/helper.ts`, `playwright.config.ts`, `src/shell/*` (only task 1), `src/three/helpers.ts` (only task 2), or other sections' files.

---

## Plan

### Task 1 — Global aesthetic re-theme: "night observatory" (shared foundation)

**Files:** `src/shell/tokens.css` (values only — keep every token name), `src/shell/base.css`, `src/shell/shell.css`, `src/shell/shell.ts` (token-field chips only).

**Design direction (fixed — all later tasks inherit this look):** deep ink-navy page with aurora radial glows, glassy dark panels, glowing multi-accent palette (periwinkle/amber/coral/mint), gradient stages, soft glow on interactive elements, constellation-style ambient glyph field. Avoid the AI-default looks (cream+serif, black+single acid accent, broadsheet).

**Exact changes:**

1. `tokens.css` — new values (names unchanged):
   - `--paper: #070B14; --surface: #0D1424; --stage: #0A101F; --stage-2: #16203A;`
   - `--ink: #EEF2FA; --ink-soft: #A9B4C9; --ink-faint: #64708A;`
   - `--on-stage: #F2F5FA; --on-stage-soft: #94A0B9;`
   - `--accent: #6E85FF; --accent-soft: rgba(110,133,255,.16); --accent-glow: #9FB0FF;`
   - `--amber: #FFB020; --amber-ink: #FFC966; --amber-glow: #FFD48A; --coral: #FF6B5E; --mint: #22C48E;`
   - `--shadow-soft: 0 1px 2px rgba(0,0,0,.45), 0 8px 24px rgba(0,0,0,.35); --shadow-stage: 0 32px 80px rgba(3,6,15,.65);`
   - `--text-hero: clamp(2.75rem, 6vw, 4.75rem);` (all other type/space/motion tokens unchanged)
2. `base.css` (component restyle, keep all class names, the `.pw` freeze block verbatim, the `prefers-reduced-motion` block, and flat single-class specificity):
   - `body`: `background: radial-gradient(1100px 700px at 75% -10%, rgba(110,133,255,.13), transparent 60%), radial-gradient(900px 600px at 5% 25%, rgba(255,176,32,.06), transparent 55%), var(--paper);`
   - `.btn-primary`: `background: linear-gradient(135deg, var(--accent), var(--accent-glow)); color: #070B14; box-shadow: 0 0 24px rgba(110,133,255,.30);` hover: `filter: brightness(1.1);`
   - `.btn-ghost`: border `rgba(148,160,185,.35)`, color `var(--ink-soft)`, hover border `var(--accent-glow)` + color `var(--on-stage)`.
   - `.card`, `.explain-card`: `background: var(--surface); border: 1px solid rgba(110,133,255,.14);` hover: `transform: translateY(-2px); border-color: rgba(110,133,255,.30);` (transition using existing tokens).
   - `.chip`: `background: var(--accent-soft); color: #C7D2FE;` (keep `.stage .chip` override with `--stage-2`).
   - `.stage`: `position: relative;` + `background: linear-gradient(160deg, #0C1226 0%, #0A101F 45%, #0B1A2A 100%); border: 1px solid rgba(110,133,255,.18); box-shadow: var(--shadow-stage);` plus a `::after` static radial glow overlay (`pointer-events: none`, `background: radial-gradient(600px 300px at 50% 0%, rgba(110,133,255,.10), transparent 70%);` z-index 0, and stage children `position: relative; z-index: 1;` via a single rule `.stage > * { position: relative; z-index: 1; }` EXCEPT elements with class `stage-3d-layer` which get z-index 0).
   - New shared utility (used by tasks 3, 7, 8, 9, 10, 11, 13): `.stage-3d-layer { position: absolute !important; inset: 0; z-index: 0 !important; pointer-events: none; background: radial-gradient(640px 320px at 50% 42%, rgba(110,133,255,.14), transparent 70%), var(--stage); }`
   - `.toggle[aria-checked='true']`: add `box-shadow: 0 0 16px rgba(110,133,255,.45);`
   - `.pager-link`: color `var(--accent-glow)`; `.metric-value`: `color: var(--on-stage);` with `text-shadow: 0 0 24px rgba(110,133,255,.25);`
   - `.viz-fallback`, `.stage-note`: keep, restyle with `--on-stage-soft` (already token-driven).
   - `.eyebrow`: color `var(--accent-glow)`.
3. `shell.css`:
   - `.token-chip`: `color: rgba(159,176,255,.12); text-shadow: 0 0 12px rgba(110,133,255,.35); font-size: .9375rem;` plus two accent variants `.token-chip--amber { color: rgba(255,176,32,.14); text-shadow: 0 0 12px rgba(255,176,32,.35); }` and `.token-chip--mint` (same with mint). Keep the drift keyframes, durations and negative delays exactly as they are (they are the determinism for the frozen ambient field).
   - `.site-header`: `background: rgba(7,11,20,.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(110,133,255,.12);`
   - `.brand-mark`: `background: linear-gradient(135deg, var(--accent), var(--accent-glow)); color: #070B14;`
   - `.nav-link[aria-current='page']`: color `var(--accent-glow)`; add `box-shadow: inset 0 -2px 0 var(--accent);`
   - `.site-footer-text`: color `var(--ink-faint)` (already); `.stage .btn-ghost` variants: border `rgba(148,160,185,.4)`, color `var(--on-stage)`, hover background `rgba(110,133,255,.10)`.
4. `shell.ts` — in `TOKEN_CHIPS`, assign the two accent classes: chip index 1 (`tok_2941`) gets `token-chip--amber`, chip index 8 gets `token-chip--mint`; no other change (keep 12 chips, same positions/durations/delays, same `aria-hidden`).
5. **Note:** the two existing 3D stages (data, parameters) still use a solid in-scene background, so they will sit as flat rectangles over the new gradient stage. This is expected mid-migration; tasks 4 and 6 fix it by switching those stages to `alpha: true` + the kit. Do not touch those sections here.
6. No unit-test changes expected (`shell.test.ts` asserts structure/copy only) — run `npm run test` and confirm green.
7. Regenerate ALL baselines: `npm run e2e:update`, then `npm run e2e` to confirm the new set is byte-stable. Inspect at least `home`, `data`, `parameters` snapshots visually (read the PNGs) to verify the dark theme rendered as intended.

### Task 2 — 3D toolkit upgrade (shared foundation)

**Files:** `src/three/helpers.ts` (extend, don't break), new `src/three/helpers.test.ts`.

**Exact additions (later tasks code against this API verbatim):**

1. `Stage3DOptions` gains `alpha?: boolean`. When `alpha` is true: `new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: true })` and **no** `scene.background` (transparent canvas — the CSS gradient of the wrapper shows through). When absent/false: current behavior exactly (solid `#0b101f` background).
2. `export function makeGlowSprite(): THREE.Texture` — a 64×64 offscreen canvas with a radial gradient (white core alpha 1 → transparent edge), wrapped in a `THREE.CanvasTexture`. Fully procedural, no randomness.
3. `export function makeGlowPoints(positions: Float32Array, colors: Float32Array | null, size: number, opacity?: number): THREE.Points` — `PointsMaterial({ size, map: makeGlowSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: !!colors })` (+ `opacity` via optional 4th arg, default 1).
4. `export function addStarfield(handle: Stage3DHandle, count: number, radius: number, colorHex: string): THREE.Points | null` — `count` seeded points (via `handle.rand`, consumed in order) in a spherical shell of given `radius`, small fixed size 0.05, single color; returns null on fallback.
5. **The kit** (encapsulates the two resilience patterns — blit + context-loss rebuild — so new stages never hand-roll them):
   ```ts
   export interface Stage3DKitOptions {
     wrapper: HTMLElement;            // dedicated sized wrapper, position:relative by CSS
     stageOpts: Stage3DOptions;       // seed, camera, loop, alpha
     blitClass?: string;              // default 'stage-blit'
     build: (h: Stage3DHandle) => unknown | null;
     reapply: (refs: unknown | null, h: Stage3DHandle) => void; // restore state onto refs
   }
   export interface Stage3DKit {
     handle: Stage3DHandle;           // current handle (rebuilt on context loss)
     refs: unknown | null;            // build() result, or null in fallback/jsdom
     render(): void;                  // frame() + 2D blit of the GL canvas
     dispose(): void;                 // removes window resize listener, disposes stage + blit DOM
   }
   export function createStageKit(opts: Stage3DKitOptions): Stage3DKit
   ```
   Behavior: initial `createStage3D(wrapper, stageOpts)` → `refs = fallback ? null : build(handle)` → `reapply(refs, handle)` → `render()`. On `webglcontextlost` (unless already disposed): `event.preventDefault()`, dispose old handle, recreate stage in the same wrapper, `refs = build(...) ?? null`, `reapply`, `render`, re-wire the listener. `render()` = `handle.frame()` then, when not fallback, draw the GL canvas into a persistent 2D blit canvas appended to the wrapper (class `blitClass`, `position:absolute; inset:0; width:100%; height:100%; pointer-events:none`, `aria-hidden`), resizing the blit buffer when GL size changes. A `window.resize` listener re-renders (blit repaint) and is removed in `dispose()`. Never throws in jsdom (fallback path).
6. `src/three/helpers.test.ts` (new, small, end-result): (a) `mulberry32(7)` first 5 outputs equal the known fixed sequence (compute and hardcode); (b) `createStageKit` in jsdom with a 960×540 div renders a `.viz-fallback` node, `refs === null`, `render()` and `dispose()` don't throw, and the wrapper is empty after `dispose()`; (c) two kits with the same seed produce identical `rand()` streams.
7. Run `npm run test` and `npm run build`. No e2e baseline changes (no stage uses the new API yet). Confirm no server left running.

### Task 3 — Home: "You vs the model" prediction duel + 3D hero

**Files:** `src/sections/home/viz.ts`, `src/sections/home/home.css`, `src/sections/home/home.test.ts`, `e2e/home.spec.ts`, baselines for `e2e/home.spec.ts` **and** `e2e/env.spec.ts` (its `00-home.png` top shot now includes the re-themed hero). Keep `page.ts` (title/eyebrow/lede) untouched — `env.spec` asserts the h1 `How machines learn to talk`.

**Interaction (replaces "pick → one-liner → New sentence"):**
- Keep the existing 3 fixed `SENTENCES` and candidate data exactly (probs 38/27/4, 43/25/8, 42/26/8).
- State: `index` (0–2), `picks: number[]` (user pick per sentence, in order), `phase: 'pick' | 'reveal' | 'score'`.
- On pick (phase `reveal`): all 3 candidate buttons become `disabled`, chosen one keeps `aria-pressed=true`; the blank fills with the chosen text; a reveal line (`.nt-reveal`, `aria-live=polite`) shows:
  - if pick === model pick (argmax index, which is 0 for all three): `You and the model agree: "<chosen text>".`
  - else: `You said "<chosen text>". The model would say "<argmax text>" (<argmax prob>%). Both are possible — that is the game.`
- Stage bar: primary button `Next sentence` (sentences 1–2) / `See your score` (sentence 3), disabled until a pick; a score pill (`.nt-score`, mono) always visible: `Score: {m} / 3` where `m` = matches so far (pick === argmax). Initial: `Score: 0 / 3`.
- Phase `score` (after 3 picks): candidates and reveal line hidden; a result card shows `You matched the model {m} out of 3 times.` plus the fixed summary line indexed by `m` (0–3):
  - 0: `Zero matches — you think in a way no model has. That is the whole story of language.`
  - 1: `One match — close. Models lean on probability; you lean on sense.`
  - 2: `Two matches — you and the model share a sense of the likely. That is why it feels natural to read.`
  - 3: `Three matches — you just predicted like a machine. Welcome to the model's mind.`
  Ghost button `Play again` resets to sentence 1, `Score: 0 / 3`, phase `pick`.
- Keep the overview map and explain cards (re-styled by task 1; no logic change).
- **3D hero layer:** `.nt-canvas-wrap.stage-3d-layer` inside the stage; `createStageKit` with `{ seed: 20260207, camera: { position: [0, 0, 9], fov: 40 }, alpha: true }`. Scene (build order fixed): 3 candidate orbs — 90-point seeded spheres, radius 0.55, at x = −3 / 0 / +3 (y = 0, small seeded jitter), colors `#6E85FF` / `#FFB020` / `#94A0B9` (per candidate index); then an amber 60-point ring (radius 0.95, in the camera-facing xy-plane) around the argmax orb; then `addStarfield(handle, 250, 9, '#22304F')`. State: phase `pick` → all orbs `opacity 0.45`, ring hidden; `reveal` → chosen orb `opacity 1` and its group `scale 1.25`, model-pick ring visible, unchosen orbs `opacity 0.25`; `score` → all orbs `opacity 0.25`, ring hidden. (Materials per orb via `makeGlowPoints`; set `material.opacity`.)

**Tests:**
- `home.test.ts` rewrite: initial state (3 candidates with prob texts, `Score: 0 / 3`, `Next sentence` disabled, `.viz-fallback` present in jsdom); pick argmax on sentence 1 → exact agree line, `Score: 1 / 3`, candidates disabled; pick non-argmax (`you can practice`) → exact mismatch line; walk picks [0, 1, 0] → score phase with `You matched the model 2 out of 3 times.` + exact summary line; `Play again` resets (blank `___`, sentence 1 text, `Score: 0 / 3`); map + explain cards still render (keep existing assertions).
- `e2e/home.spec.ts` rewrite shots: `home-initial.png` (top), `home-pick-match.png` (scroll `.nt-stage`, pick `it never ends`), `home-pick-mismatch.png` (fresh goto, pick `you can practice`), `home-score-2of3.png` (picks 0,1,0 → score card), `home-map-card-focus.png` (keep), `home-mobile.png` (keep), plus the no-shot full-nav test (keep).

**Verify:** the 4 commands from the shared checklist with `e2e/home.spec.ts e2e/env.spec.ts` for the Playwright steps.

### Task 4 — Data: user-run filter console (three strictness decisions) + 3D upgrade

**Files:** `src/sections/data/viz.ts`, `src/sections/data/data.css`, `src/sections/data/data.test.ts`, `e2e/data.spec.ts`, its baselines.

**Interaction (replaces "Next filter ×3 / Start over"):** the user makes three real curation decisions; results are a pure function of the choices.
- State: `stageIndex` (0–3; 3 = done), `choices: number[]` (option index 0–2 per stage, filled as decided). Topic toggles (4, existing behavior + `applyMix`) stay unchanged.
- Fixed data:
  - Stage 1 `Curation`, question: `Ten million pages arrived. Which sources does the model get to read?` Options (label / description / rate / score):
    1. `Keep it broad` / `News, forums, wikis, blogs — almost everything.` / 0.85 / 0
    2. `Best sources only` / `Quality publications, educational sites, code repositories.` / 0.42 / 1
    3. `Books & scholarly articles` / `The highest-quality writing humans produce.` / 0.20 / 2
  - Stage 2 `Cleaning`, question: `The pages are in. How hard do we scrub the junk out of them?`
    1. `Light pass` / `Remove broken pages and boilerplate; leave the rest.` / 0.70 / 0
    2. `Standard scrub` / `Strip navigation, ads, duplicate blocks and encoding noise.` / 0.55 / 1
    3. `Surgical` / `Keep only coherent paragraphs a reader would actually finish.` / 0.40 / 2
  - Stage 3 `Deduplication`, question: `Finally: how aggressively do we remove near-copies?`
    1. `Keep near-duplicates` / `Variations of a page may carry variation the model should learn.` / 0.60 / 0
    2. `Standard dedup` / `Remove obvious copies and minor edits.` / 0.45 / 1
    3. `Aggressive dedup` / `Collapse anything that sounds even remotely familiar.` / 0.30 / 2
  - Computation: `pages(1)=10,000,000`; `pages(k+1)=round(pages(k) × rate(choice[k]))`; `tokens = pages(4) × 8`; `score = sum(option scores)` (0–6); `quality = 30 + 10 × score`.
  - Verdict lines (`.data-verdict`, indexed by score 0–6):
    - 0: `A wide, noisy diet — the model learns fast and loudly, including the spam.`
    - 1: `A little curation — mostly good, some junk.`
    - 2: `Decent filtering — the usual compromise of a big web crawl.`
    - 3: `Careful data — you would be proud of the reading list.`
    - 4: `Tight curation — small, clean and deliberate.`
    - 5: `Very strict — almost a curated library, not the open web.`
    - 6: `The rarest recipe of all: a tiny, perfect diet. Quality over quantity.`
- UI: the decision area (`.data-panel`, fixed `min-height: 224px` for state-invariant height) shows the current stage's question + 3 option buttons (`.data-option`, `aria-pressed`, each with label + description). Choosing an option sets `choices[stageIndex]`, advances `stageIndex`; at stage 3 it completes: decision area shows the verdict + a quality meter (`.data-quality`, progressbar `aria-valuenow=quality`, label `Data quality {quality}%`). Buttons in the stage bar: `← Back` (ghost, visible when `stageIndex > 0`, goes back one stage showing that stage's options with the current choice pre-pressed and re-selectable; changing it recomputes everything downstream) and `Start over` (ghost, resets all). The counter chain (4 metrics) shows raw `10,000,000 pages`, then each stage's result or `—` until reached, final metric label `tokens ready`.
- **3D:** migrate the existing river/rings/tokens scene to `createStageKit` (same `seed: 20260301`, same camera `[0, 0.2, 11.5]` fov 42, **`alpha: true`**, same point counts 2,000/3×120/3×120/180 and identical rand-consumption order so the river is pixel-identical), switching all point creation to `makeGlowPoints` and adding `addStarfield(handle, 200, 9, '#22304F')` last. Ring state: ring r is amber (active) while stage `r` is being decided, mint (passed) once decided, dim otherwise — mirrors the DOM ring labels (keep existing ring label element behavior, now driven by `choices`). Token cluster: lit count = `Math.round(180 × pages(4) / 10,000,000)` (pure function of choices), lit colors unchanged; dim color unchanged.
- **Tests:** `data.test.ts` rewrite — initial (stage-1 question + 3 options + `10,000,000 pages` + three `—` counters, `.viz-fallback` in jsdom); pick `Best sources only` → counter 2 `4,200,000 clean pages`, stage-2 question; full run [1,1,1] → `1,039,500 unique pages` and `8,316,000 tokens ready`, `Data quality 60%`, verdict line 3 exact; full run [2,2,2] → `240,000` pages, `1,920,000 tokens`, quality 90, verdict line 6 exact; Back + change stage-1 to option 0 → counters recompute (`8,500,000` at counter 2 with later choices intact); Start over resets; topic toggles re-weight mix (keep existing mix assertions); keep the mount/unmount resize-listener hygiene test.
- `e2e/data.spec.ts` rewrite shots: `data-initial.png`, `data-stage-2.png` (picked `Best sources only`), `data-stage-3.png` (picked `Standard scrub`), `data-complete.png` (picked `Standard dedup` → verdict + quality + lit tokens), `data-back.png` (after `← Back`), `data-topic-off.png` (one topic toggled off in initial state).

### Task 5 — Tokenisation: "type your own sentence" live tokenizer

**Files:** `src/sections/tokenisation/viz.ts`, `src/sections/tokenisation/tokenisation.css`, `src/sections/tokenisation/tokenisation.test.ts`, `e2e/tokenisation.spec.ts`, its baselines.

**Interaction (additive — the fixed-sentence stage, grain slider, emoji button, inspector and "Now you try" mini all stay exactly as they are; no 3D here: the chips ARE the concept):**
- New panel card `.tok-typed` (4th card in the existing `.tok-panels` grid): title `Type your own sentence`, sub `Watch your words become tokens — the same rules apply.`, a text input (`.tok-typed-input`, `aria-label` `Your sentence`, placeholder `Type a sentence…`), buttons: `Tokenise it` (primary, `.tok-typed-go`) and `Back to the example` (ghost, `.tok-typed-reset`, disabled while the example is active). An empty-input note `.tok-typed-empty` (`Type something first.`, hidden otherwise).
- **Deterministic demo tokenizer (exact spec):** for the trimmed input: split into "words" (maximal runs of `[A-Za-z0-9']`) and single other characters (each punctuation/symbol char is its own token; whitespace ignored). For each word (case-insensitive lookup): if in the fixed dictionary → one token, badge `word`, id = the dictionary id. Dictionary (word → id, 48 entries): `i:52, love:418, learning:1159, about:623, ai:65211, the:21, a:10, an:16, is:32, are:38, was:41, were:47, am:26, be:24, to:12, of:18, in:14, on:20, at:28, it:30, you:56, me:58, my:62, your:66, we:70, they:74, he:78, she:82, this:86, that:90, and:94, or:98, but:104, not:110, no:116, yes:122, good:128, bad:134, big:140, small:146, run:152, walk:158, jump:164, happy:170, sad:176, cat:182, dog:188, sun:194, moon:200, star:206, hello:212, world:218, time:224, day:230, night:236, water:242, fire:248`.
  - Otherwise the word is "unfamiliar": split into 3-letter chunks (`while length > 3: take 3; the remainder (1–2 letters) is the final chunk`) — e.g. `xylophone → xyl, oph, one`; `robotics → rob, oti, cs`; `abcd → abc, d`. Each chunk: badge `unfamiliar piece`, id = `djb2(chunk) % 100000` where `djb2` is exactly: `let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0) % 100000;` — a pure function of the input (allowed: no time/randomness/network).
  - Punctuation/symbol tokens: badge `punctuation`, id shown as `—`.
- Behavior: `Tokenise it` re-renders the stage chip row (`.tok-chips`) with the typed tokens (chips keep the exact existing look/click→inspector behavior; the grain slider and `Add an emoji` are `disabled` while a typed sentence is active, with the sub-note `Grain view uses the example sentence.`). `Back to the example` restores the fixed sentence chips and re-enables them. The chip-count line in the grain panel updates to the active chip count.
- **Tests:** `tokenisation.test.ts` — keep all existing passing behaviors; add: initial typed panel state (reset disabled, note hidden); typing `The cat sat on the moon!` + go → exactly 7 chips in order `The, cat, sat, on, the, moon, !`; `moon` chip click → inspector `id 200`, badge `word`; `!` chip → badge `punctuation`, inspector id `—`; typing `xylophone` + go → 3 chips `xyl, oph, one` each badged `unfamiliar piece`; empty input + go → note visible; `Back to the example` → 6 chips and grain slider enabled.
- `e2e/tokenisation.spec.ts` rewrite: keep existing shot states with new names where the UI changed, plus: `tokenisation-initial.png`, `tokenisation-chip.png` (click ` love` → `id 418`), `tokenisation-grain-0.png`, `tokenisation-grain-2.png`, `tokenisation-emoji.png`, `tokenisation-typed.png` (type `The cat sat on the moon!` → 7 chips), `tokenisation-typed-unfamiliar.png` (type `xylophone` → 3 fragmented chips).

### Task 6 — Parameters: pick what it learns + named knob cards + glow 3D

**Files:** `src/sections/parameters/viz.ts`, `src/sections/parameters/parameters.css`, `src/sections/parameters/parameters.test.ts`, `e2e/parameters.spec.ts`, its baselines.

**Interaction (replaces "Inspect a knob" blind cycling; the 10-step train rhythm stays — it becomes meaningful via the topic):**
- State: `topic` (0–2), `step` (0–10), `size` (0–2), `inspected` (0–3 or null).
- Topic picker (3 buttons `.par-topic`, `aria-pressed`, in the side panel under `Model size` label row): `Poetry` / `Facts` / `Code`. Switching topic never resets `step`; it changes the milestone captions, the test card, and the highlighted "favorite" knob card.
- Fixed topic data (milestone status-line strings at steps 3 / 6 / 10; generic step line for other steps: `Step {step} of 10 — {step × 200} of 2,000 knobs nudged so far.`):
  - Poetry (accent `#FF6B5E`, favorite knob index 1): 3: `It can rhyme "rose" with "goes" — barely.` · 6: `It writes passable haiku with a suspicious amount of "moon".` · 10: `It finished the poetry course. Ask it for a haiku about coffee.` Test card: prompt `Write a haiku about coffee` → answer `Steam curls, then stills — / the cup holds the morning sun / one sip, and the day starts`
  - Facts (accent `#FFB020`, favorite index 2): 3: `It knows Paris, but only when you ask nicely.` · 6: `Dates and capitals: getting there.` · 10: `It finished the facts course. Ask it where the Nile flows.` Test: `Where does the Nile flow?` → `The Nile flows north, all the way to the Mediterranean.`
  - Code (accent `#22C48E`, favorite index 3): 3: `It can close a bracket. That is a start.` · 6: `Loops and variables: mostly right.` · 10: `It finished the code course. Ask it to print the numbers 1 to 3.` Test: `Print the numbers 1 to 3` → `1 / 2 / 3`
- Knob cards: the side panel's right column now holds 4 clickable knob cards (`.par-knob-card`, `aria-pressed`, fixed): `The "is"-after-"the" knob` (id `4,291,114`, value `0.42`, point 137), `The "moon"-in-poems knob` (id `612,084`, value `0.87`, point 1518), `The "capital-cities" knob` (id `6,930,551`, value `0.13`, point 402), `The "brackets" knob` (id `1,547,302`, value `0.66`, point 1873). Clicking selects (spotlight ring + tooltip `Knob #{id} · value {value}` exactly as today); clicking the selected card again deselects. The current topic's favorite card carries class `par-knob-card--fav` (amber ring).
- `Test the model` card (`.par-test`, fixed `min-height: 132px`, placeholder `Finish training to test the model.`): after `step === 10` shows the topic's test prompt; answer hidden behind a one-shot `Reveal answer` ghost button (disabled after reveal).
- **3D:** migrate to `createStageKit` (`seed: 20260305`, camera `[0, 0, 8.6]` fov 45, `alpha: true`, identical 2,000-knob cloud + seeded Fisher–Yates order + spotlight rings, same rand order), all points via `makeGlowPoints`; the "nudged" color becomes the topic accent; add `addStarfield(handle, 150, 8, '#22304F')` last.
- **Tests:** `parameters.test.ts` — initial (topic buttons, 4 knob cards with exact names/ids, `Train one step` enabled, `.viz-fallback` in jsdom); topic Poetry + 3 steps → exact milestone-3 string; +3 more → milestone-6; +4 → milestone-10 + test card prompt visible; `Reveal answer` → exact answer, button disabled; switch topic to Facts at step 10 → status stays milestone-10 (Facts line) and test prompt changes; knob card select/deselect (tooltip text exact); favorite card class follows topic; size slider 1M/7B/70B values (keep existing); keep resize-listener hygiene test.
- `e2e/parameters.spec.ts` rewrite shots: `par-initial.png`, `par-topic-poetry.png`, `par-step-3.png`, `par-step-6.png`, `par-done.png` (10 steps + revealed test answer), `par-knob-inspect.png` (moon-in-poems selected), `par-size-70b.png`.

### Task 7 — Pre-training: diet picker + 3D diet bowl

**Files:** `src/sections/pretraining/viz.ts`, `src/sections/pretraining/pretraining.css`, `src/sections/pretraining/pretraining.test.ts`, `e2e/pretraining.spec.ts`, its baselines.

**Interaction (replaces mindless "Teach a batch" mashing with a real trade-off decision):**
- State: `tokens` (0 → 15T cap, existing math), `diet` (0–2). The batch button (`Teach a batch`, +100), the 4-stop log slider (1M/1B/100B/15T), the 8-line guess feed, and the `See the raw model` toggle all keep their current behavior.
- Diet picker: 3 buttons (`.pre-diet`, `aria-pressed`) in the head row: `Everything mixed` / `Rhymes & stories` / `Math & code`. Switching diet recomputes badge unlocks (pure function of `(tokens, diet)`):
  - `Everything mixed`: Counting @200, Rhyming @300, Coding @1B, Following rules @15T (current values)
  - `Rhymes & stories`: Counting @500, Rhyming @100, Coding @1B, Following rules @15T
  - `Math & code`: Counting @100, Rhyming @800, Coding @200M, Following rules @15T
  - Each badge's threshold label (`formatTokens`) displays the active diet's value, so the trade-off is visible before you commit.
- **3D diet bowl:** `.pre-canvas-wrap.stage-3d-layer`; `createStageKit` `{ seed: 20260402, camera: { position: [0, 0.6, 9], fov: 45 }, alpha: true }`. Scene (build order fixed): 1,000 seeded bowl points — for point `i`: `r = 3.2 × sqrt(i/1000)` with seeded jitter (±0.08), angle seeded, `y = -1.7 + 2.2 × (r/3.2)²`, x/z from angle×r; single shared color set per diet (lit vs dim `#10182B`): Mixed = seeded split 40% `#FFB020` / 35% `#6E85FF` / 25% `#22C48E`; Rhymes = 70% `#FF6B5E` / 30% `#FFB020`; Math = 60% `#6E85FF` / 40% `#22C48E`; lit count = `Math.round(1000 × log10(tokens + 1) / log10(15e12 + 1))` (0 tokens → 0 lit); then `addStarfield(handle, 120, 8, '#22304F')`.
- **Tests:** `pretraining.test.ts` — initial (3 diet buttons, mixed thresholds `200/300/1B/15T` visible, `.viz-fallback` in jsdom); switch to `Math & code` → thresholds show `100/800/200M/15T`; diet 2 + 3 batches (300 tokens) → `Skills unlocked: 1 / 4` (Counting only); diet 1 + 1 batch (100 tokens) → Rhyming unlocked, Counting not; slider to 15T → `4 / 4` unlocked in any diet; feed appends one line per batch (keep existing); raw-model toggle (keep existing).
- `e2e/pretraining.spec.ts` rewrite shots: `pre-initial.png`, `pre-diet-math.png`, `pre-batch-3.png` (diet 2, three batches), `pre-15t.png` (slider at 15T), `pre-raw.png` (raw model toggle on).

### Task 8 — SFT: "what did it get wrong?" picker + coaching slider + twin-cloud 3D

**Files:** `src/sections/sft/viz.ts`, `src/sections/sft/sft.css`, `src/sections/sft/sft.test.ts`, `e2e/sft.spec.ts`, its baselines.

**Interaction (replaces "Add 10 examples ×2" + one-shot pair reveal):**
- State: `promptIndex` (0–2, existing picker/panels unchanged), `stopIndex` (0–2), `mistakeIndex` (0–2 or null).
- The "Training data" strip's button becomes a 3-stop slider `.sft-quality-slider` (`aria-label` `Coaching intensity`, stops `1` / `10` / `100` examples; quality 20/60/90 as today; `Quality beats quantity` note at stop 100 as today).
- New `What did it get wrong?` picker (3 buttons `.sft-mistake`, `aria-pressed`) above the pair card. Selecting one reveals the fixed pair card (same `.sft-pair` card, now per-mistake); re-clicking deselects (card hides, hint `Pick a mistake to see the coaching pair.` returns). Fixed data (instruction / response / note):
  - `Rambles on`: instruction `Write a haiku about autumn.` response `Red leaves let go slow / a gust takes them all away / one bare branch remains` note `The base model kept going for 400 words. The pair teaches it to stop.`
  - `Ignores the question`: instruction `What color is the sky?` response `Blue. (Sometimes grey, sometimes pink at sunset.)` note `The base model gave a history of optics. The pair teaches it to answer, then stop.`
  - `Wrong format`: instruction `List the days of the week.` response `Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday` note `The base model wrote an essay about calendars. The pair teaches it the shape of the answer.`
  (Response lines joined with newlines, rendered like the current pair card.)
- **3D twin clouds:** `.sft-canvas-wrap.stage-3d-layer`; kit `{ seed: 20260408, camera: { position: [0, 0, 9], fov: 45 }, alpha: true }`. Scene (build order fixed): left "base" cloud — 500 seeded sphere points, radius 1.3, centered x=−2.2, color `#4A5878`, static; right "instruct" cloud — 500 seeded sphere points, radius 1.3, centered x=+2.2, each point pulled to `pos × (1 − 0.45 × quality/100)` from its cloud center, color `lerp(#6E85FF, #22C48E, quality/100)`; then `addStarfield(handle, 100, 8, '#22304F')`. So at 20% the right cloud is loose and blue; at 90% tight and mint.
- **Tests:** `sft.test.ts` — initial (slider at stop 1, quality `20%`, no mistake selected, pair hidden, `.viz-fallback` in jsdom); each mistake → exact instruction/response/note strings; re-click deselects; slider to 100 → `90%` + `Quality beats quantity`; prompt picker swaps both panels (keep existing assertions).
- `e2e/sft.spec.ts` rewrite shots: `sft-initial.png`, `sft-mistake-0.png`, `sft-mistake-1.png`, `sft-mistake-2.png`, `sft-quality-90.png` (slider 100 + mistake 0 selected).

### Task 9 — Preferences: label three pairs, one training run, 3D seesaw

**Files:** `src/sections/preferences/viz.ts`, `src/sections/preferences/preferences.css`, `src/sections/preferences/preferences.test.ts`, `e2e/preferences.spec.ts`, its baselines.

**Interaction (replaces vote + 2 train presses with a 3-pair labeling queue the user actually curates):**
- State: `votes: (null | 'A' | 'B')[3]`, `trained: boolean`.
- Three fixed prompt pairs, stacked answer cards (each card: label, text, `This one!` vote button `aria-pressed`, and after voting a chip `Voted A` / `Voted B` on the chosen card; voting the other card moves the vote):
  1. `How do I make scrambled eggs?` — A: `Fluffy scrambled eggs in five minutes: 1. Whisk three eggs with a splash of milk and a pinch of salt. 2. Melt a knob of butter in a non-stick pan over medium heat. 3. Pour the eggs in and stir slowly — don't rush. 4. Take them off the heat while still a little soft. They finish on the plate.` B: `Eggs are bad for you, don't.`
  2. `Explain quantum physics in one sentence.` — A: `Tiny bits of the universe come in packets, and until you look, they behave like ripples instead of things.` B: `Quantum physics is hard. Read a book.`
  3. `Should I cancel my gym membership?` — A: `Maybe not cancel it — try going twice a week for a month first. If it is still a struggle, pause the membership instead of losing it.` B: `No, you will quit in three weeks, I guarantee it.`
- Reward meter: with `v` votes cast and `a` of them A: `shareA = round(100 × a / v)` (show `—` at 0 votes). After all 3 votes: values are 0 / 33 / 67 / 100.
- `Train on my votes` (primary) is disabled until all 3 votes are cast; one press → `trained`: the `New model answer` panel shows the final draft `Best draft yet: fluffy scrambled eggs in five minutes. Whisk three eggs with a splash of milk and a pinch of salt. Melt a knob of butter over medium heat, pour the eggs in and stir slowly, then take them off the heat while still a little soft — they finish on the plate.` plus the fixed training note — if all 3 votes were A: `Trained on your three votes — the new draft keeps the helpful details and drops the attitude.` otherwise: `Trained on your three votes — one of them was B, so the model also learned to be a little more careful with big claims.` `Start over` (ghost) resets votes + `trained`. Pre-training, the panel shows the existing draft text (`I can write about scrambled eggs, but I don't know which answer was better. Point at one and I'll take notes.`) with chip `no notes yet`; chip becomes `trained` after.
- **3D seesaw:** `.pref-canvas-wrap.stage-3d-layer`; kit `{ seed: 20260409, camera: { position: [0, 0.4, 9], fov: 42 }, alpha: true }`. Scene (build order fixed): beam — 160 points along x from −3.2 to +3.2 at y 0.5, inside a group rotated `z = −(shareA − 50)/50 × 0.21` rad (0 votes → 0; A-heavy → left side down); fulcrum — 60 points in a small triangle below the beam center, color `#22304F`; left cloud (A) — 300 seeded sphere points radius 0.8 at (−2.6, −0.6, 0), color `#22C48E`, `opacity = shareA/100` (0 votes → 0.5/0.5); right cloud (B) — 300 points at (2.6, −0.6, 0), color `#FF6B5E`, `opacity = (100 − shareA)/100`; then `addStarfield(handle, 100, 8, '#22304F')`.
- **Tests:** `preferences.test.ts` — initial (3 pairs, votes none, train disabled, meter `—`, `.viz-fallback` in jsdom); vote A p1 → chip `Voted A`, meter `100`; vote B p2 → meter `50`; vote A p3 → meter `67` + train enabled; train → mixed note (exact) + final draft text + chip `trained`; reset and vote B,B,B → meter `0`, train → mixed note; reset and vote A,A,A → train → all-A note (exact); changing a vote (A→B on p1) recomputes the meter.
- `e2e/preferences.spec.ts` rewrite shots: `pref-initial.png`, `pref-vote-1.png` (A on pair 1), `pref-vote-3.png` (A, B, A → meter 67), `pref-trained.png` (train), `pref-all-b.png` (fresh: B, B, B + train).

### Task 10 — Tool calling: pick the right tool (wrong tools fail) + one-click run + 3D relay

**Files:** `src/sections/tool-calling/viz.ts`, `src/sections/tool-calling/tool-calling.css`, `src/sections/tool-calling/tool-calling.test.ts`, `e2e/tool-calling.spec.ts`, its baselines.

**Interaction (replaces "Step through the call ×4" — the user makes the one decision that matters, then the whole call runs in one click):**
- State: `questionIndex` (0–2), `toolsOn` (bool), `pickedTools: Set<number>` (tools already tried wrong), `finished: boolean` (correct tool ran). Keep the question picker, the tools switch, the tools-off path (`I can't check that — I can't see the world!`) and the 4-beat gutter.
- Tools on + not finished: below the flow, `Which tool does it call?` with 3 buttons `.tool-try` (labels `get_weather` / `get_time` / `calculator`, `aria-pressed=false`). The correct tool per question: q0→`get_weather`, q1→`get_time`, q2→`calculator`.
  - Correct pick: `finished = true` — the gutter lights all 4 beats (amber), the tool card shows the call + result, the answer bubble shows the existing `answerLine` (mint tone), caption: `Four beats, one click: Think → Call tool → Read result → Answer.` Tool buttons disabled; tried-wrong buttons keep a `Tried — no help` tag.
  - Wrong pick: adds the tool to `pickedTools` (button disabled + `Tried — no help` tag); the flow shows that wrong call/result and the fixed wrong answer (coral tone, tag `Wrong tool`), caption: `The model picked the wrong tool — it can try again.` Fixed wrong data (call / result / answer):
    - q0: `get_time` → `get_time("Tokyo")` / `9:00 am` / `It is 9:00 am in Tokyo.` · `calculator` → `calculator("Tokyo")` / `Error: not a number` / `I got an error back. That is not a forecast.`
    - q1: `get_weather` → `get_weather("Sydney")` / `22°C, cloudy` / `It is 22°C and cloudy in Sydney.` · `calculator` → `calculator("Sydney")` / `Error: not a number` / `The calculator sent back an error. No time there.`
    - q2: `get_weather` → `get_weather("7")` / `Error: unknown city` / `I asked a weather service for a number. It was not helpful.` · `get_time` → `get_time("13 × 7")` / `Error: bad input` / `The clock does not multiply. That was my mistake.`
  - Switching question or flipping tools resets `pickedTools`/`finished` (existing reset behavior).
- **3D packet relay:** `.tool-canvas-wrap.stage-3d-layer`; kit `{ seed: 20260410, camera: { position: [0, 0.2, 9], fov: 40 }, alpha: true }`. Scene (build order fixed): three node orbs (120 seeded points each, radius 0.5): user at (−2.6, 1.4, 0) `#6E85FF`, model at (0, −0.9, 0) `#FFB020`, tool at (2.6, 1.4, 0) `#22C48E`; 40 packet points (size 0.07): on `finished` → 20 along the model→user segment and 20 along the tool→model segment (evenly spaced, mint); on a wrong pick → 20 along the model→tool segment (coral) and 20 dimmed along tool→model; none (idle) → all packets dim `#10182B` parked at the model node; then `addStarfield(handle, 120, 8, '#22304F')`.
- **Tests:** `tool-calling.test.ts` — initial tools-off state (keep existing); tools on → 3 `.tool-try` buttons; wrong pick on q0 (`calculator`) → exact wrong call/result/answer + `Tried — no help` + `finished` false; then `get_weather` → exact `answerLine` + all 4 gutter beats active + buttons disabled; question switch resets; tools-off shows the fixed off-answer (keep existing).
- `e2e/tool-calling.spec.ts` rewrite shots: `tc-initial.png` (tools off), `tc-tools-on.png` (picker visible), `tc-wrong.png` (q0 + calculator), `tc-run.png` (q0 + weather → full run), `tc-time.png` (q1 run), `tc-calc.png` (q2 run).

### Task 11 — Skills: pick which skill to teach + "Try the task" results + 3D skill dock

**Files:** `src/sections/skills/viz.ts`, `src/sections/skills/skills.css`, `src/sections/skills/skills.test.ts`, `e2e/skills.spec.ts`, its baselines.

**Interaction (replaces the blind "Teach a skill" cycle; user chooses order and then actually runs the task):**
- State: `learned: Set<string>` (as today), `taskId: string | null` (as today), plus `triedTasks: Set<string>`.
- Replace the single `Teach a skill` button with 3 skill cards (`.skill-teach-card`, one per existing skill in the fixed order `Browse the web 🌐 / Write code 💻 / Summarize 📝`), each with a `Teach` button (`aria-pressed = learned`). Teaching adds the skill (same inventory/card/`Learned!`/`Forget` behavior as today). The stage-bar hint becomes a pure function: no skills → `Teach a skill — pick which one first.`; some → `The backpack holds {n} of 3 skills.`; full → `All 3 skills learned — the backpack is full.`
- Task board (unchanged 3 tasks + readiness logic): when the selected task is ready, a `Try the task` primary button (`.skill-try`) appears in the readiness row. Pressing it adds the task to `triedTasks`, appends its fixed result line to the results area (`.skill-results`, **fixed `min-height: 84px`** — always present; empty state text `No results yet — teach it a skill, pick a task, then try it.`):
  - `trail`: `It opened three tabs, compared reviews and settled on: Maple Ridge, 8.4 miles, one good chocolate shop at the trailhead.`
  - `script`: `It wrote a 6-line script, ran it on a test folder, then ran it for real. All 41 files renamed.`
  - `article`: `It read the 4,000-word article and replied with three bullets. You can argue with bullet two.`
  The tried task's button card shows a `Done ✓` badge and `Try the task` is disabled for it; forgetting the task's skill re-enables it (task leaves `triedTasks` if its skill is forgotten — keep it simple: forgetting a skill also removes its task from `triedTasks` and clears its result line).
- **3D skill dock:** `.skill-canvas-wrap.stage-3d-layer`; kit `{ seed: 20260411, camera: { position: [0, 0.2, 8.5], fov: 45 }, alpha: true }`. Scene (build order fixed): core orb — 90 seeded points radius 0.6 at origin, color `#6E85FF`; 3 skill orbs — 90 points each, radius 0.45, angles 90°/210°/330°; unlearned at orbit radius 3.4 (dim `#4A5878`), learned at dock radius 1.6 in skill colors (`browse #6E85FF`, `code #FFB020`, `summarize #22C48E`, full opacity); then `addStarfield(handle, 100, 8, '#22304F')`.
- **Tests:** `skills.test.ts` — initial (3 teach cards unpressed, empty inventory line, results placeholder exact, `.viz-fallback` in jsdom); teach `browse` → inventory `1 / 3`, chest light 1 on, `Learned!` badge; select `trail` → readiness `Ready! 🎒` + `Try the task` enabled; try → exact result line + `Done ✓` + button disabled; forget `browse` → task readiness `Not ready` / `Missing: Browse the web` and result line cleared; teach all 3 → hint `All 3 skills learned — the backpack is full.` (keep existing task-selection assertions).
- `e2e/skills.spec.ts` rewrite shots: `sk-initial.png`, `sk-teach-browse.png`, `sk-ready.png` (task selected), `sk-done.png` (tried → result), `sk-forget.png` (forget → missing state).

### Task 12 — MCP: "Ask the app" live replies + 3D socket

**Files:** `src/sections/mcp/viz.ts`, `src/sections/mcp/mcp.css`, `src/sections/mcp/mcp.test.ts`, `e2e/mcp.spec.ts`, its baselines.

**Interaction (the plug toggles already work well — add a payoff: asking the app):**
- State: existing `activeApp` + per-app `docked` sets, unchanged behavior for app picker, plug toggles, `Unplug all`, `N tools ready` status line and `connected: X` chips.
- Add `Ask the app` primary button (`.mcp-ask`, enabled iff the active app has ≥1 docked server) in the stage bar; and a reply panel (`.mcp-reply`, **fixed `min-height: 96px`**, always present; empty state `Nothing to ask yet — plug something in.`). The reply is a deterministic template recomputed on every state change (live): per-server clause in fixed SERVERS order — `files`: `the hike photos are in Hike 2024.zip` · `calendar`: `Saturday is free` · `maps`: `the trail is 8.4 miles`; reply = `ChatBot asked its tools: {clauses joined with "; "}.` or `CodePal checked its tools: {clauses joined with "; "}.` (e.g. only Calendar docked on ChatBot → `ChatBot asked its tools: Saturday is free.`).
- **3D socket (replaces the SVG socket column — keep the same 252px height so framing is invariant):** `.mcp-canvas-wrap { height: 252px; position: relative; }` with `createStageKit` `{ seed: 20260412, camera: { position: [0, 0, 8], fov: 40 }, alpha: true }`. Scene (build order fixed): socket block — a flat 12×20 grid of dim points (`#22304F`, size 0.05) forming a rounded-rectangle plate; 3 slot rings — 40 points each (radius 0.35) at y = +0.9 / 0 / −0.9, x = 0.9, dim `#33405F`; docked plugs — per docked server an 80-point cluster (radius 0.3) seated in its slot + a 24-point cable line from the cluster to x = 2.6; server colors `files #FFB020`, `calendar #FF6B5E`, `maps #22C48E`; then `addStarfield(handle, 80, 7, '#22304F')`. (Total ≤ ~672 points.) Remove the old `buildSocket` SVG entirely.
- **Tests:** `mcp.test.ts` — initial (2 apps, 3 plugs, `0 tools ready`, `Ask the app` disabled, reply placeholder exact, `.viz-fallback` in jsdom); plug `files` into ChatBot → chip `connected: Files`, `1 tool ready`, ask enabled; ask → reply `ChatBot asked its tools: the hike photos are in Hike 2024.zip.`; dock `calendar` too → reply `ChatBot asked its tools: the hike photos are in Hike 2024.zip; Saturday is free.` (clause order = SERVERS order: files, calendar, maps); switch to CodePal → its chips/ask state; `Unplug all` → `0 tools ready` + placeholder (keep existing toggle assertions).
- `e2e/mcp.spec.ts` rewrite shots: `mcp-initial.png`, `mcp-plug-files.png`, `mcp-ask.png`, `mcp-codepal.png` (switch + plug `calendar` + ask), `mcp-unplug.png`.

### Task 13 — Agent: steer every move (wrong moves stall the run) + 3D loop orbit

**Files:** `src/sections/agent/viz.ts`, `src/sections/agent/agent.css`, `src/sections/agent/agent.test.ts`, `e2e/agent.spec.ts`, its baselines.

**Interaction (replaces the hardcoded 6-press script — the user makes each "Act" decision and wrong decisions cost time):**
- State: `toolsOn`, `count` (entries shown), `completed`, `choice: 1 | 2 | null` (which act decision is pending), `wrongTries: { act1: boolean, act2: boolean }`.
- Tools-on run structure (presses = `Next step` presses + choice clicks; entry kinds `thought | act | observe | stall | done`):
  1. `Next step` → THOUGHT `I need the date first.` → choice 1 pending.
  2. Choice 1 (`.agent-choice` buttons, panel `.agent-choices`, fixed `min-height: 96px`, always present with empty text `The loop decides when there is nothing to choose.`): `calendar.check("Saturday")` (correct) or `web.search("Saturday weather Portland")` (wrong).
     - Correct → ACT entry (that call) + OBSERVE `Saturday: free` → choice 2 pending.
     - Wrong → ACT entry (that call) + STALL entry `Useless — I still do not know if Saturday is free.` (coral, tag `STALLED`); the wrong button gets disabled + a `Tried — no help` tag; choice 1 stays pending.
  3. Choice 2: `web.search("Portland chocolate + hiking")` (correct) or `email.draft(...)` (wrong). Wrong → STALL `Too early — I have no trail to write about.` + same tried/disabled treatment.
  4. Correct choice 2 → ACT `web.search("Portland chocolate + hiking")` + OBSERVE `Maple Ridge trail ✓` → `Next step` enabled again.
  5. `Next step` → ACT `email.draft(...)` + DONE `Done! Email drafted ✅` → `completed`.
  - Minimum path = 4 `Next step` presses + 2 choice clicks → 7 entries (identical texts to today's run). Each wrong try adds 2 entries.
- Tools-off run unchanged (3 entries: thought / `Action failed: no calendar tool` / `Gave up — and asked you instead`). `Skip to the end` fills the remaining entries via the CORRECT path (ignoring `wrongTries`). `Restart` clears everything including `wrongTries`. The loop badge logic stays (phase of newest entry; `Done ✓` / stopped states). Hint strings: initial `Press Next step to start — then steer every move.`; choice pending `Your call: what should it do?`; done (on) `Done! Steered {n} of {n} moves` where n = total moves taken (4 + wrongTries count×1) — fixed template `Done! {n} moves, {w} wobbles.` with `w = wrongTries.act1 + wrongTries.act2` (`Done! 4 moves, 0 wobbles.` on the clean path); done (off) unchanged.
- **3D loop orbit:** `.agent-canvas-wrap.stage-3d-layer`; kit `{ seed: 20260413, camera: { position: [0, 0.8, 8.5], fov: 45 }, alpha: true }`. Scene (build order fixed): orbit ring — 240 points, radius 2.6 in the xz-plane at y 0 (tilted toward camera by the camera's elevated position), color `#33405F`; cursor orb — 60 points radius 0.4, angle `= −90° + (count / 7) × 360°` (count = entries shown, capped at 7; 0 → −90° top), color = newest entry's phase color (`think #6E85FF`, `act #FFB020`, `observe #22C48E`, `stall #FF6B5E`, `done #22C48E` bright opacity 1, `failed`/`gaveup #FF6B5E`); then `addStarfield(handle, 120, 8, '#22304F')`.
- **Tests:** `agent.test.ts` — initial (choices panel shows empty text, `.viz-fallback` in jsdom); `Next step` → thought entry + choice 1 visible with both exact options; wrong choice 1 → stall text exact + wrong button disabled + `Tried — no help`; correct choice 1 → `Saturday: free` + choice 2; correct choice 2 → `Maple Ridge trail ✓`; `Next step` → 7 entries ending `Done! Email drafted ✅`, hint `Done! 4 moves, 0 wobbles.`; wrong+wrong path → 9 entries, hint `Done! 6 moves, 2 wobbles.`; `Skip to the end` from mid-choice fills correct path; tools-off 3-entry run (keep existing assertions); `Restart` clears `wrongTries`.
- `e2e/agent.spec.ts` rewrite shots: `ag-initial.png`, `ag-choice-1.png` (after first thought), `ag-wrong.png` (picked the search), `ag-done.png` (clean full run), `ag-notools-final.png` (tools-off run).

### Task 14 — Final integration: full verify, baseline hygiene, docs

**Files:** `README.md`, orphaned baselines under `e2e/*-snapshots/`, (read-only check of everything else).

1. **Baseline hygiene:** for each of the 13 spec files, list every `shot('name.png')` reference and delete any `e2e/<spec>-snapshots/*-linux.png` file whose name is no longer referenced (leftovers from removed states). Do not delete `e2e/*-snapshots/` directories themselves.
2. Run `npm run verify` (unit → build → e2e) — must pass with zero snapshot failures.
3. Run `npm run e2e` a **second time** — acceptance bar: byte-identical, zero baselines rewritten, zero flake. If any diff appears, treat it as a freeze-protocol bug (state-dependent height, un-frozen animation, non-seeded pixel) and fix the offending section; do not widen `maxDiffPixelRatio`.
4. Grep the codebase for banned nondeterminism in render paths: `Math.random`, `new Date(`, `performance.now`, `fetch(` under `src/` — zero hits (test helpers allowed to use timers).
5. **README.md:** update the committed-baseline count from 72 to the actual new count (count files under `e2e/*-snapshots/`); in the "Determinism rules" list add one bullet: `User-typed text (the tokenisation section) is tokenized by a fixed dictionary plus a deterministic djb2 hash of the input — a pure function of the input, never of time or randomness.`; optionally update the one-line "ten-lesson course" description to mention the hands-on decision-making (keep it to one sentence).
6. Confirm no dev/preview server is left running (AGENTS.md): check port 4173/5173 are free (e.g. `lsof -i :4173 -i :5173` returns nothing) before marking complete.

## Files to Modify

- `src/shell/tokens.css` — re-themed token values (task 1)
- `src/shell/base.css` — dark-theme component restyle + `.stage-3d-layer` utility (task 1)
- `src/shell/shell.css` — header/footer/chip/brand restyle (task 1)
- `src/shell/shell.ts` — token-chip accent classes (task 1)
- `src/three/helpers.ts` — `alpha` option, glow points, starfield, `createStageKit` (task 2)
- `src/sections/home/{viz.ts,home.css,home.test.ts}` + `e2e/home.spec.ts` (task 3)
- `src/sections/data/{viz.ts,data.css,data.test.ts}` + `e2e/data.spec.ts` (task 4)
- `src/sections/tokenisation/{viz.ts,tokenisation.css,tokenisation.test.ts}` + `e2e/tokenisation.spec.ts` (task 5)
- `src/sections/parameters/{viz.ts,parameters.css,parameters.test.ts}` + `e2e/parameters.spec.ts` (task 6)
- `src/sections/pretraining/{viz.ts,pretraining.css,pretraining.test.ts}` + `e2e/pretraining.spec.ts` (task 7)
- `src/sections/sft/{viz.ts,sft.css,sft.test.ts}` + `e2e/sft.spec.ts` (task 8)
- `src/sections/preferences/{viz.ts,preferences.css,preferences.test.ts}` + `e2e/preferences.spec.ts` (task 9)
- `src/sections/tool-calling/{viz.ts,tool-calling.css,tool-calling.test.ts}` + `e2e/tool-calling.spec.ts` (task 10)
- `src/sections/skills/{viz.ts,skills.css,skills.test.ts}` + `e2e/skills.spec.ts` (task 11)
- `src/sections/mcp/{viz.ts,mcp.css,mcp.test.ts}` + `e2e/mcp.spec.ts` (task 12)
- `src/sections/agent/{viz.ts,agent.css,agent.test.ts}` + `e2e/agent.spec.ts` (task 13)
- All `e2e/*-snapshots/*-linux.png` baselines — regenerated by tasks 1–13 (orphaned ones deleted in task 14)
- `README.md` — baseline count + determinism note (task 14)

## New Files

- `src/three/helpers.test.ts` — unit tests for PRNG determinism, jsdom fallback, and `dispose()` DOM hygiene (task 2)

## Risks

1. **SwiftShader memory/eviction with 10 live 3D stages** (two e2e workers in parallel): the context-loss rebuild pattern mitigates it, but new stages could still flake on first baseline capture. Mitigation: each section task verifies its baselines are byte-stable on a re-run before finishing; task 14 re-runs the full suite a second time. If a stage is too heavy, reduce its point count — never widen pixel tolerance.
2. **`alpha: true` renderer change alters the two existing stages** (tasks 4/6): the flat `#0b101f` rectangle becomes a transparent canvas over the CSS gradient. Intended, but the river/cloud must keep its exact rand-consumption order or the scene shifts; the "pixel-identical rebuild" property of the kit depends on build() being a pure function of the seed.
3. **Stage-height invariance**: several new states change content volume (data panel, sft pair, mcp reply, skills results, agent choices). Fixed `min-height` reservations are specified per task, but a worker who shrinks one will get scroll-framing drift in shots — catchable only by visual inspection of the regenerated PNGs (each task must eyeball its own baselines).
4. **Exact-copy coupling**: unit tests and e2e specs assert the exact strings given in this plan. Any paraphrase by a worker breaks tests in lockstep; the strings above are normative.
5. **djb2 tokenizer**: `(h * 33 + c) | 0` wrapping must be implemented exactly as specified or unit-test expected ids diverge; it is a pure function of input so determinism is safe either way — only test consistency is at risk.
6. **Mid-migration visual inconsistency**: after task 1, data/parameters stages look temporarily out of place over the new gradient (solid GL background). Expected; resolved in tasks 4/6. Baselines at that point are transitional by design.
7. **Baseline count drift**: the README's "72 baselines" figure changes as states are added/removed; task 14 recomputes it from the filesystem to avoid a wrong hardcoded number.
8. **Server hygiene**: Playwright's `webServer` auto-stops, but any worker who manually starts `vite preview`/`dev` for eyeballing must stop it (AGENTS.md) — called out in every task's verification step.
