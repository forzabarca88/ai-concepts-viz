/**
 * Pre-training visualisation — the "training gym" (Task 7).
 *
 *  - the user makes a real trade-off first: the 15T diet
 *    (Everything mixed / Rhymes & stories / Math & code). The four
 *    skill badges (Counting / Rhyming / Coding / Following rules) each
 *    unlock at a different threshold per diet, so the badge labels show
 *    the active trade-off before you commit;
 *  - "Teach a batch" (+100 tokens, capped at 15T) and the 4-stop log
 *    slider (1M/1B/100B/15T — the real Llama 3.1 figure); each batch
 *    appends the next example from a fixed 8-sentence "guess the next
 *    word" cycle;
 *  - a "See the raw model" toggle revealing the base model's
 *    next-word-reflex chat.
 *
 * Behind the DOM UI sits the 3D "diet bowl" layer
 * (`.pre-canvas-wrap.stage-3d-layer`): a 1,000-point paraboloid whose
 * points light up from the bowl's bottom as tokens accumulate, tinted
 * with the active diet's seeded colour split. The scene is built
 * through the `createStageKit` resilience kit (2D blit + context-loss
 * rebuild) with `alpha: true`, so the stage's CSS gradient shows
 * through the transparent canvas.
 *
 * ALL state also lives in the DOM (diet buttons, threshold labels,
 * badge state, counter, feed) — so every control keeps working in
 * jsdom, where the canvas is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

const MAX_TOKENS = 15_000_000_000_000; // the real Llama 3.1 figure: 15T
const BATCH_TOKENS = 100;
const LOG_MAX = Math.log10(MAX_TOKENS + 1); // lit-point scale (0 tokens → 0 lit)

/** The four log-scale stops of the slider (a log slider: 4 stops). */
const SLIDER_STOPS = [
  { tokens: 1_000_000, label: '1M' },
  { tokens: 1_000_000_000, label: '1B' },
  { tokens: 100_000_000_000, label: '100B' },
  { tokens: 15_000_000_000_000, label: '15T' },
] as const;

interface Example {
  /** Prompt with the blank the model has to fill. */
  prompt: string;
  /** The word the model guesses next — fixed, never generated. */
  guess: string;
}

/** Fixed 8-sentence "guess the next word" cycle. */
const EXAMPLES: readonly Example[] = [
  { prompt: 'The cat sat on the ___', guess: 'mat' },
  { prompt: 'Once upon a time, there was a ___', guess: 'little' },
  { prompt: 'Two plus two is ___', guess: 'four' },
  { prompt: 'She tied her shoes so she could ___', guess: 'run' },
  { prompt: 'The soup was hot, so I blew on the ___', guess: 'spoon' },
  { prompt: 'To make tea, first pour hot ___', guess: 'water' },
  { prompt: 'A rainbow ends with blue, indigo and ___', guess: 'violet' },
  { prompt: 'The moon rises in the east and sets in the ___', guess: 'west' },
];

/** How many example sentences the practice feed starts with. */
const INITIAL_LINES = 3;

/** Fixed badge order: Counting / Rhyming / Coding / Following rules. */
const BADGE_LABELS = ['Counting', 'Rhyming', 'Coding', 'Following rules'] as const;

interface Diet {
  name: string;
  /** Unlock thresholds in badge order (tokens at which each skill surfaces). */
  thresholds: readonly [number, number, number, number];
  /** 3D bowl palette for this diet — the seeded split assigns them. */
  palette: readonly string[];
  /** Cumulative cutoffs of the seeded split (palette.length − 1 values). */
  splits: readonly number[];
}

const DIETS: readonly Diet[] = [
  {
    name: 'Everything mixed',
    thresholds: [200, 300, 1_000_000_000, 15_000_000_000_000],
    palette: ['#FFB020', '#6E85FF', '#22C48E'], // 40 / 35 / 25 %
    splits: [0.4, 0.75],
  },
  {
    name: 'Rhymes & stories',
    thresholds: [500, 100, 1_000_000_000, 15_000_000_000_000],
    palette: ['#FF6B5E', '#FFB020'], // 70 / 30 %
    splits: [0.7],
  },
  {
    name: 'Math & code',
    thresholds: [100, 800, 200_000_000, 15_000_000_000_000],
    palette: ['#6E85FF', '#22C48E'], // 60 / 40 %
    splits: [0.6],
  },
];

const RAW_PROMPT = 'Tell me a joke';
const RAW_ANSWER = ' the the the of and …';
const RAW_NOTE = 'No meaning yet — just the next-word reflex.';

const HINT_BUSY = 'Each batch = 100 tokens — a sliver of the 15T diet.';
const HINT_DONE = 'All 15T tokens read — the base model is ready for its next lesson.';

const nf = new Intl.NumberFormat('en-US');

/** Compact counter: 0→"0", 100→"100", 1e6→"1M", 1e9→"1B", 100e9→"100B", 15e12→"15T". */
function formatTokens(n: number): string {
  if (n >= 1e12) return `${trimNum(n / 1e12)}T`;
  if (n >= 1e9) return `${trimNum(n / 1e9)}B`;
  if (n >= 1e6) return `${trimNum(n / 1e6)}M`;
  return nf.format(n);
}

function trimNum(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, '');
}

/** Lit bowl points for a token count (0 tokens → 0 lit; 15T → all 1,000). */
const litCountFor = (tokens: number): number =>
  Math.round((BOWL_COUNT * Math.log10(tokens + 1)) / LOG_MAX);

/* ============================================================
   The training-gym stage
   ============================================================ */

export function mountPreViz(root: HTMLElement): () => void {
  let tokens = 0;
  let presses = 0;
  let diet = 0; // "Everything mixed" by default

  const stage = document.createElement('section');
  stage.className = 'stage pre-stage';
  stage.setAttribute('aria-label', 'Pre-training training gym');

  /* 3D layer: the kit owns canvas + blit inside this absolute-fill
     wrapper, behind the stage UI (shared `.stage-3d-layer` utility). */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'pre-canvas-wrap stage-3d-layer';

  /* ---------- head: title, diet picker, raw-model toggle ---------- */

  const head = document.createElement('header');
  head.className = 'pre-head';
  const headText = document.createElement('div');
  headText.className = 'pre-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'The training gym';
  const sub = document.createElement('p');
  sub.className = 'pre-sub';
  sub.textContent =
    'One press is one tiny lesson: read a text, guess the next word, try again. But the 15T diet is yours to choose — and what it eats first decides what it learns first.';

  /* diet picker — the trade-off decision, in the head row */
  const diets = document.createElement('div');
  diets.className = 'pre-diets';
  diets.setAttribute('role', 'group');
  diets.setAttribute('aria-label', 'Choose its diet');
  const dietLabel = document.createElement('span');
  dietLabel.className = 'pre-diets-label';
  dietLabel.textContent = 'Choose its diet';
  diets.appendChild(dietLabel);
  const dietBtns: HTMLButtonElement[] = DIETS.map((d, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pre-diet pre-diet--${i}`;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = d.name;
    diets.appendChild(btn);
    return btn;
  });
  headText.append(h2, sub, diets);

  const toggleRow = document.createElement('div');
  toggleRow.className = 'pre-toggle-row';
  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'pre-toggle-label';
  toggleLabel.textContent = 'See the raw model';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', 'false');
  toggle.setAttribute('aria-label', 'See the raw model');
  toggleRow.append(toggleLabel, toggle);

  head.append(headText, toggleRow);

  /* ---------- gym grid: counter+slider | feed+badges ---------- */

  const gym = document.createElement('div');
  gym.className = 'pre-gym';

  const left = document.createElement('div');
  left.className = 'pre-left';

  const metric = document.createElement('div');
  metric.className = 'metric';
  const counter = document.createElement('p');
  counter.className = 'metric-value pre-counter';
  const counterLabel = document.createElement('p');
  counterLabel.className = 'metric-label';
  counterLabel.textContent = 'tokens read';
  metric.append(counter, counterLabel);

  const scale = document.createElement('div');
  scale.className = 'pre-scale';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'pre-scale-slider';
  slider.min = '0';
  slider.max = '3';
  slider.step = '1';
  slider.value = '0';
  slider.setAttribute('aria-label', 'Token scale');
  const ticks = document.createElement('div');
  ticks.className = 'pre-scale-ticks';
  const tickEls = SLIDER_STOPS.map((stop) => {
    const tick = document.createElement('span');
    tick.className = 'pre-scale-tick';
    tick.textContent = stop.label;
    ticks.appendChild(tick);
    return tick;
  });
  scale.append(slider, ticks);
  left.append(metric, scale);

  const right = document.createElement('div');
  right.className = 'pre-right';

  const feedHead = document.createElement('p');
  feedHead.className = 'pre-feed-head';
  feedHead.textContent = 'Guess the next word';

  const feed = document.createElement('ul');
  feed.className = 'pre-feed';
  feed.setAttribute('aria-label', 'Example next-word guesses');

  const skills = document.createElement('div');
  skills.className = 'pre-skills';
  const skillsHead = document.createElement('p');
  skillsHead.className = 'pre-skills-head';
  skillsHead.textContent = 'Skills it is picking up';
  const badgeList = document.createElement('ul');
  badgeList.className = 'pre-badges';
  const badgeEls: HTMLElement[] = [];
  const badgeAtEls: HTMLElement[] = [];
  BADGE_LABELS.forEach((label) => {
    const li = document.createElement('li');
    li.className = 'pre-badge';
    li.dataset.unlocked = 'false';
    const name = document.createElement('span');
    name.className = 'pre-badge-name';
    name.textContent = label;
    const at = document.createElement('span');
    at.className = 'pre-badge-at';
    li.append(name, at);
    badgeList.appendChild(li);
    badgeEls.push(li);
    badgeAtEls.push(at);
  });
  const skillCount = document.createElement('p');
  skillCount.className = 'pre-skill-count';
  skills.append(skillsHead, badgeList, skillCount);
  right.append(feedHead, feed, skills);

  gym.append(left, right);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const batchBtn = document.createElement('button');
  batchBtn.type = 'button';
  batchBtn.className = 'btn btn-primary pre-batch';
  batchBtn.textContent = 'Teach a batch';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(batchBtn, hint);

  /* ---------- base-model reveal panel ----------
     Sits in a fixed-height zone so the stage (and the 3D canvas
     behind it) never resizes between the hidden/revealed states. */
  const raw = document.createElement('section');
  raw.className = 'pre-raw';
  raw.hidden = true;
  raw.setAttribute('aria-label', 'Base model chat');
  const rawTitle = document.createElement('p');
  rawTitle.className = 'pre-raw-title';
  rawTitle.textContent = 'Base model, unfiltered';
  const chat = document.createElement('div');
  chat.className = 'pre-raw-chat';
  const userMsg = document.createElement('p');
  userMsg.className = 'pre-msg pre-msg--user';
  userMsg.textContent = RAW_PROMPT;
  const modelMsg = document.createElement('p');
  modelMsg.className = 'pre-msg pre-msg--model';
  modelMsg.textContent = RAW_ANSWER;
  chat.append(userMsg, modelMsg);
  const rawNote = document.createElement('p');
  rawNote.className = 'pre-raw-note';
  rawNote.textContent = RAW_NOTE;
  raw.append(rawTitle, chat, rawNote);
  const rawZone = document.createElement('div');
  rawZone.className = 'pre-raw-zone';
  rawZone.appendChild(raw);

  /* ---------- behaviour ---------- */

  const appendLine = (ex: Example) => {
    const li = document.createElement('li');
    li.className = 'pre-line';
    const prompt = document.createElement('span');
    prompt.className = 'pre-line-prompt';
    prompt.textContent = ex.prompt;
    const guess = document.createElement('span');
    guess.className = 'pre-line-guess';
    // Leading space so the concatenated line text reads "___ → word"
    // (the spans are separate inline boxes).
    guess.textContent = ` → ${ex.guess}`;
    li.append(prompt, guess);
    feed.appendChild(li);
    // Deterministic feed position: pin to the newest line with an
    // immediate jump (no CSS scroll animation), so the content
    // position is a pure function of the state.
    feed.scrollTop = feed.scrollHeight;
  };

  const render = () => {
    counter.textContent = formatTokens(tokens);
    const thresholds = DIETS[diet].thresholds;
    let unlocked = 0;
    badgeEls.forEach((li, i) => {
      const on = tokens >= thresholds[i];
      li.classList.toggle('pre-badge--on', on);
      li.dataset.unlocked = String(on);
      // The badge label always shows the active diet's threshold, so
      // the trade-off is visible before you commit.
      badgeAtEls[i].textContent = formatTokens(thresholds[i]);
      if (on) unlocked += 1;
    });
    skillCount.textContent = `Skills unlocked: ${unlocked} / ${BADGE_LABELS.length}`;
    dietBtns.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === diet)));
    const done = tokens >= MAX_TOKENS;
    batchBtn.disabled = done;
    hint.textContent = done ? HINT_DONE : HINT_BUSY;
    tickEls.forEach((tick, i) =>
      tick.classList.toggle('pre-scale-tick--active', tokens === SLIDER_STOPS[i].tokens),
    );
    slider.style.setProperty('--pre-fill', `${(Number(slider.value) / 3) * 100}%`);
    renderScene();
  };

  batchBtn.addEventListener('click', () => {
    if (tokens >= MAX_TOKENS) return;
    tokens = Math.min(tokens + BATCH_TOKENS, MAX_TOKENS);
    presses += 1;
    appendLine(EXAMPLES[(INITIAL_LINES + presses - 1) % EXAMPLES.length]);
    render();
  });

  slider.addEventListener('input', () => {
    tokens = SLIDER_STOPS[Number(slider.value)].tokens;
    render();
  });

  dietBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (diet === i) return;
      diet = i;
      render();
    });
  });

  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(on));
    raw.hidden = !on;
  });

  stage.append(canvasWrap, head, gym, bar, rawZone);
  root.appendChild(stage);

  /* ----- 3D diet bowl + starfield (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     state onto the refs (and tolerates null refs — jsdom fallback).
     It reads the closure state at call time, which is what makes the
     post-context-loss rebuild re-apply correctly. */
  const applyScene = (refs: BowlRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.apply(diet, litCountFor(tokens));
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260402,
      camera: { position: [0, 0.6, 9], fov: 45 },
      alpha: true,
    },
    build: (h) => buildBowlScene(h),
    reapply: (refs) => applyScene(refs as BowlRefs | null),
  });

  const renderScene = (): void => {
    applyScene(kit.refs as BowlRefs | null);
    kit.render();
  };

  /* ---------- initial paint ---------- */

  for (const ex of EXAMPLES.slice(0, INITIAL_LINES)) {
    appendLine(ex);
  }
  render();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ============================================================
   3D diet-bowl scene
   ============================================================ */

interface BowlRefs {
  /**
   * Re-tint the bowl for the active diet and light the first `lit`
   * points (points are ordered from the bowl's bottom to its rim, so
   * the fill rises as tokens accumulate).
   */
  apply(diet: number, lit: number): void;
}

/* Point budget: 1,000 bowl + 120 starfield (≤ ~1,500 + 300). */
const BOWL_COUNT = 1_000;
const BOWL_RADIUS = 3.2;

function buildBowlScene(handle: Stage3DHandle): BowlRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const dimColor = new THREE.Color('#10182B');
  const palettes = DIETS.map((d) => d.palette.map((hex) => new THREE.Color(hex)));

  /* ----- the 1,000-point paraboloid bowl -----
     rand() consumption order is frozen: for each point i, (1) the
     radius jitter, (2) the angle — two calls per point. Any change
     here shifts the whole bowl. */
  const positions = new Float32Array(BOWL_COUNT * 3);
  for (let i = 0; i < BOWL_COUNT; i += 1) {
    const jitter = (rand() - 0.5) * 0.16; // ±0.08
    const r = BOWL_RADIUS * Math.sqrt(i / BOWL_COUNT) + jitter;
    const angle = rand() * Math.PI * 2;
    positions[i * 3] = r * Math.cos(angle);
    positions[i * 3 + 1] = -1.7 + 2.2 * Math.pow(r / BOWL_RADIUS, 2);
    positions[i * 3 + 2] = r * Math.sin(angle);
  }

  /* ----- one shared base colour set per diet -----
     The seeded split consumes one rand() per point per diet, diet 0
     first, then 1, then 2 (1,000 draws each). Lit points wear their
     diet colour; unlit ones wear the dim colour. */
  const base: Uint8Array[] = [];
  for (let d = 0; d < DIETS.length; d += 1) {
    const splits = DIETS[d].splits;
    const arr = new Uint8Array(BOWL_COUNT);
    for (let i = 0; i < BOWL_COUNT; i += 1) {
      const v = rand();
      let ci = splits.length;
      for (let k = 0; k < splits.length; k += 1) {
        if (v < splits[k]) {
          ci = k;
          break;
        }
      }
      arr[i] = ci;
    }
    base.push(arr);
  }

  const colors = new Float32Array(BOWL_COUNT * 3);
  const bowl = makeGlowPoints(positions, colors, 0.14);
  scene.add(bowl);
  const colAttr = bowl.geometry.getAttribute('color') as THREE.BufferAttribute;

  addStarfield(handle, 120, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  let appliedDiet = -1;
  let appliedLit = -1;
  return {
    apply(nextDiet, lit) {
      if (nextDiet === appliedDiet && lit === appliedLit) return;
      appliedDiet = nextDiet;
      appliedLit = lit;
      const b = base[nextDiet];
      const pal = palettes[nextDiet];
      for (let i = 0; i < BOWL_COUNT; i += 1) {
        const c = i < lit ? pal[b[i]] : dimColor;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      colAttr.needsUpdate = true;
    },
  };
}

/* ============================================================
   Explain cards (the shared three-card grid)
   ============================================================ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '§',
    title: "What's happening",
    body: 'That button is the whole job of pre-training, shrunk: read a text, guess the next word, get a tiny nudge. Real models repeat it until the guesses stop being random.',
  },
  {
    glyph: '∞',
    title: 'Why it matters',
    body: 'No skill is ever taught — it is discovered. Counting and rhyming surface almost immediately, while true rule-following only appears at the far end of the scale. Volume, not lectures, is the teacher.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Llama 3.1’s pre-training diet was 15 trillion tokens — roughly ten million average books, or about 27,000 years of reading at one book a day.',
  },
];

export function mountPreExplain(root: HTMLElement): () => void {
  const grid = document.createElement('div');
  grid.className = 'explain-grid';
  for (const card of EXPLAIN) {
    const article = document.createElement('article');
    article.className = 'explain-card';
    const glyph = document.createElement('span');
    glyph.className = 'explain-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = card.glyph;
    const h3 = document.createElement('h3');
    h3.textContent = card.title;
    const p = document.createElement('p');
    p.textContent = card.body;
    article.append(glyph, h3, p);
    grid.appendChild(article);
  }
  root.appendChild(grid);
  return () => grid.remove();
}
