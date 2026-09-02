/**
 * Supervised fine-tuning visualisation (Task 8) — "what did it get wrong?"
 *
 *  - the stage shows two chat panels side-by-side (Base | Instruct)
 *    answering the SAME user prompt, driven by a 3-option prompt picker;
 *  - the "Training data" strip's stepper button is a 3-stop coaching
 *    slider (1 → 10 → 100 examples; quality 20% → 60% → 90%; the
 *    "Quality beats quantity" note appears at 100);
 *  - a "What did it get wrong?" picker reveals the fixed
 *    instruction/response coaching pair for that mistake (re-clicking
 *    deselects and the hint returns);
 *  - behind the DOM UI sits the 3D "twin clouds" layer
 *    (`.sft-canvas-wrap.stage-3d-layer`): a loose, dim base-model cloud
 *    vs. an instruct cloud that tightens and turns mint as the coaching
 *    quality rises. Built through the `createStageKit` resilience kit
 *    (2D blit + context-loss rebuild) with `alpha: true`, so the stage's
 *    CSS gradient shows through the transparent canvas.
 *
 * ALL state is mirrored in the DOM (slider, quality bar, mistake
 * picker, pair card, hints) — so every control keeps working in jsdom,
 * where the canvas is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

interface PromptPair {
  /** Picker button text — the user prompt shown in both panels. */
  label: string;
  /** Base model: a raw next-word continuation (no formatting). */
  base: string;
  /** Instruct model: the coached, helpful answer. */
  instruct: string;
}

/** Fixed Q&A pairs — never generated, never random. */
const PROMPTS: readonly PromptPair[] = [
  {
    label: 'Write a haiku',
    base: ' a poem with five, seven and five syllables is the classic form, and haiku come from Japan, where they are often written by hand with a brush, because brushes are tools that hold ink, and ink is a dark liquid used for writing, which is how words get onto paper…',
    instruct: 'Quiet morning light\na heron lifts from the pond\none ripple, then still',
  },
  {
    label: "What's a good recipe?",
    base: ' a recipe is a list of steps for making food, and food comes in many kinds, for example breakfast, lunch and dinner, which are the three meals that people usually eat each day, though some people eat snacks in between, and snacks are often small foods such as…',
    instruct:
      "Let's do one-pan garlic butter pasta — five ingredients, twenty minutes:\n1. Boil spaghetti in well-salted water.\n2. Sauté sliced garlic in butter until it's golden.\n3. Stir in parmesan, a splash of pasta water and lemon juice.\n4. Toss the pasta through and serve at once.\nIt sounds fancier than it is. It's mostly garlic.",
  },
  {
    label: 'Explain gravity',
    base: ' gravity is the force that pulls things down, because down is the direction toward the center of the Earth, and the Earth is a planet in the solar system, which orbits the Sun, a star that gives off light and heat, and heat is a form of energy found in…',
    instruct:
      "Picture space as a stretchy trampoline. Earth sits in the middle like a heavy ball, denting the fabric. Anything that rolls nearby — an apple, the Moon — slides toward that dent. Gravity isn't a rope pulling things down; it's the shape of space itself, bent around anything heavy.",
  },
];

/** The default question — deliberately NOT one of the other two picks,
    so "initial" and "picked" are distinct transition states. */
const DEFAULT_PROMPT = 1; // "What's a good recipe?"

/** The coaching slider's three stops: more examples, better quality. */
const QUALITY_STOPS = [
  { examples: 1, quality: 20 },
  { examples: 10, quality: 60 },
  { examples: 100, quality: 90 },
] as const;

interface Mistake {
  /** Picker button text. */
  label: string;
  /** The coaching pair shown when this mistake is picked. */
  instruction: string;
  response: string;
  note: string;
}

/** The three fixed "what did it get wrong?" coaching pairs. */
const MISTAKES: readonly Mistake[] = [
  {
    label: 'Rambles on',
    instruction: 'Write a haiku about autumn.',
    response: 'Red leaves let go slow\na gust takes them all away\none bare branch remains',
    note: 'The base model kept going for 400 words. The pair teaches it to stop.',
  },
  {
    label: 'Ignores the question',
    instruction: 'What color is the sky?',
    response: 'Blue. (Sometimes grey, sometimes pink at sunset.)',
    note: 'The base model gave a history of optics. The pair teaches it to answer, then stop.',
  },
  {
    label: 'Wrong format',
    instruction: 'List the days of the week.',
    response: 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
    note: 'The base model wrote an essay about calendars. The pair teaches it the shape of the answer.',
  },
];

const PAIR_HINT = 'Pick a mistake to see the coaching pair.';
const HINT_BASE = 'Slide the coaching dial — more examples make the instruct answers sharper.';
const HINT_DONE = '100 quality examples — enough to turn the reflex into a habit.';

/* ============================================================
   The stage: two chat panels + coaching slider + mistake picker.
   One mount because the picker, panels, strip and pair share state.
   ============================================================ */

export function mountSftViz(root: HTMLElement): () => void {
  let promptIndex = DEFAULT_PROMPT;
  let stopIndex = 0; // 1 → 10 → 100 examples
  let mistakeIndex: number | null = null;

  const stage = document.createElement('section');
  stage.className = 'stage sft-stage';
  stage.setAttribute('aria-label', 'Supervised fine-tuning demo');

  /* 3D layer: the kit owns canvas + blit inside this absolute-fill
     wrapper, behind the stage UI (shared `.stage-3d-layer` utility). */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'sft-canvas-wrap stage-3d-layer';

  /* ---------- head: title + prompt picker ---------- */

  const head = document.createElement('header');
  head.className = 'sft-head';
  const headText = document.createElement('div');
  headText.className = 'sft-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'Same question, two models';
  const sub = document.createElement('p');
  sub.className = 'sft-sub';
  sub.textContent =
    'Both models heard the same prompt. The base model answers with its next-word reflex; the instruct model was coached on hundreds of example questions and answers.';
  headText.append(h2, sub);

  const pickers = document.createElement('div');
  pickers.className = 'sft-pickers';
  pickers.setAttribute('role', 'group');
  pickers.setAttribute('aria-label', 'Ask both models');
  const pickersLabel = document.createElement('p');
  pickersLabel.className = 'sft-pickers-label';
  pickersLabel.textContent = 'Ask both models';
  const pickRow = document.createElement('div');
  pickRow.className = 'sft-pick-row';
  const pickButtons: HTMLButtonElement[] = PROMPTS.map((prompt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sft-pick';
    btn.textContent = prompt.label;
    btn.setAttribute('aria-pressed', String(i === promptIndex));
    btn.addEventListener('click', () => {
      promptIndex = i;
      render();
    });
    pickRow.appendChild(btn);
    return btn;
  });
  pickers.append(pickersLabel, pickRow);
  head.append(headText, pickers);

  /* ---------- the two chat panels ---------- */

  const panels = document.createElement('div');
  panels.className = 'sft-panels';

  const makePanel = (kind: 'base' | 'instruct') => {
    const article = document.createElement('article');
    article.className = `sft-panel sft-panel--${kind}`;
    const label = document.createElement('p');
    label.className = 'sft-panel-label';
    label.textContent = kind === 'base' ? 'Base model' : 'Instruct model';
    const chat = document.createElement('div');
    chat.className = 'sft-chat';
    const user = document.createElement('p');
    user.className = 'sft-msg sft-msg--user';
    const model = document.createElement('p');
    model.className =
      kind === 'base' ? 'sft-msg sft-msg--model sft-msg--raw' : 'sft-msg sft-msg--model sft-msg--coached';
    chat.append(user, model);
    article.append(label, chat);
    panels.appendChild(article);
    return { user, model };
  };

  const basePanel = makePanel('base');
  const instructPanel = makePanel('instruct');

  /* ---------- training-data strip with the coaching slider ---------- */

  const strip = document.createElement('div');
  strip.className = 'sft-strip';
  const stripTop = document.createElement('div');
  stripTop.className = 'sft-strip-top';
  const stripLabel = document.createElement('p');
  stripLabel.className = 'sft-strip-label';
  stripLabel.textContent = 'Training data';
  const stripCount = document.createElement('p');
  stripCount.className = 'sft-strip-count';
  stripTop.append(stripLabel, stripCount);

  const sliderBlock = document.createElement('div');
  sliderBlock.className = 'sft-slider';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'sft-quality-slider';
  slider.min = '0';
  slider.max = String(QUALITY_STOPS.length - 1);
  slider.step = '1';
  slider.value = '0';
  slider.setAttribute('aria-label', 'Coaching intensity');
  const ticks = document.createElement('div');
  ticks.className = 'sft-slider-ticks';
  const tickEls = QUALITY_STOPS.map((stop) => {
    const tick = document.createElement('span');
    tick.className = 'sft-slider-tick';
    tick.textContent = String(stop.examples);
    ticks.appendChild(tick);
    return tick;
  });
  sliderBlock.append(slider, ticks);

  const qualityRow = document.createElement('div');
  qualityRow.className = 'sft-quality-row';
  const qualityLabel = document.createElement('p');
  qualityLabel.className = 'sft-quality-label';
  qualityLabel.textContent = 'quality';
  const track = document.createElement('div');
  track.className = 'sft-quality-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Training data quality');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('div');
  fill.className = 'sft-quality-fill';
  track.appendChild(fill);
  const qualityValue = document.createElement('p');
  qualityValue.className = 'sft-quality-value';
  qualityRow.append(qualityLabel, track, qualityValue);

  const qualityNote = document.createElement('p');
  qualityNote.className = 'sft-quality-note';
  qualityNote.hidden = true;
  qualityNote.textContent = 'Quality beats quantity';

  strip.append(stripTop, sliderBlock, qualityRow, qualityNote);

  /* ---------- "what did it get wrong?" picker ---------- */

  const mistakes = document.createElement('div');
  mistakes.className = 'sft-mistakes';
  mistakes.setAttribute('role', 'group');
  mistakes.setAttribute('aria-label', 'What did it get wrong?');
  const mistakesLabel = document.createElement('p');
  mistakesLabel.className = 'sft-mistakes-label';
  mistakesLabel.textContent = 'What did it get wrong?';
  const mistakeRow = document.createElement('div');
  mistakeRow.className = 'sft-mistake-row';
  const mistakeButtons: HTMLButtonElement[] = MISTAKES.map((mistake, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sft-mistake';
    btn.textContent = mistake.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      mistakeIndex = mistakeIndex === i ? null : i;
      render();
    });
    mistakeRow.appendChild(btn);
    return btn;
  });
  mistakes.append(mistakesLabel, mistakeRow);

  /* ---------- the training-pair card ----------
     Sits in a fixed-height zone so the stage (and the 3D canvas
     behind it) never resizes between the hidden/revealed states. */
  const pair = document.createElement('div');
  pair.className = 'sft-pair';
  pair.hidden = true;
  const pairTitle = document.createElement('p');
  pairTitle.className = 'sft-pair-title';
  pairTitle.textContent = 'From the coaching course';
  const pairInstruction = document.createElement('p');
  pairInstruction.className = 'sft-pair-line';
  const pairInstructionKey = document.createElement('span');
  pairInstructionKey.className = 'sft-pair-key';
  pairInstructionKey.textContent = 'Instruction:';
  const pairInstructionText = document.createElement('span');
  pairInstructionText.className = 'sft-pair-text';
  pairInstruction.append(pairInstructionKey, pairInstructionText);
  const pairResponse = document.createElement('p');
  pairResponse.className = 'sft-pair-line';
  const pairResponseKey = document.createElement('span');
  pairResponseKey.className = 'sft-pair-key';
  pairResponseKey.textContent = 'Response:';
  const pairResponseText = document.createElement('span');
  pairResponseText.className = 'sft-pair-text';
  pairResponse.append(pairResponseKey, pairResponseText);
  const pairNote = document.createElement('p');
  pairNote.className = 'sft-pair-note';
  pair.append(pairTitle, pairInstruction, pairResponse, pairNote);

  const pairHint = document.createElement('p');
  pairHint.className = 'sft-pair-hint';
  pairHint.textContent = PAIR_HINT;

  /* One polite live region: the zone is always present, so screen
     readers hear the revealed coaching pair when it appears, and the
     clipped prompt mirror (zero layout impact) keeps the chosen prompt
     in sync for them. */
  const pairZone = document.createElement('div');
  pairZone.className = 'sft-pair-zone';
  pairZone.setAttribute('aria-live', 'polite');
  const promptMirror = document.createElement('span');
  promptMirror.className = 'sft-live';
  pairZone.append(promptMirror, pair, pairHint);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(hint);

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const prompt = PROMPTS[promptIndex];
    const stop = QUALITY_STOPS[stopIndex];

    pickButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === promptIndex)));
    promptMirror.textContent = `Both models answered: ${prompt.label}.`;
    basePanel.user.textContent = prompt.label;
    instructPanel.user.textContent = prompt.label;
    basePanel.model.textContent = prompt.base;
    instructPanel.model.textContent = prompt.instruct;

    stripCount.textContent =
      stop.examples === 1 ? '1 example' : `${stop.examples} examples`;
    slider.style.setProperty('--sft-fill', `${(stopIndex / (QUALITY_STOPS.length - 1)) * 100}%`);
    tickEls.forEach((tick, i) =>
      tick.classList.toggle('sft-slider-tick--active', i === stopIndex),
    );
    fill.style.width = `${stop.quality}%`;
    fill.classList.toggle('sft-quality-fill--high', stopIndex === QUALITY_STOPS.length - 1);
    track.setAttribute('aria-valuenow', String(stop.quality));
    qualityValue.textContent = `${stop.quality}%`;
    qualityNote.hidden = stopIndex !== QUALITY_STOPS.length - 1;

    mistakeButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === mistakeIndex)));
    if (mistakeIndex === null) {
      pair.hidden = true;
      pairHint.hidden = false;
    } else {
      const mistake = MISTAKES[mistakeIndex];
      pair.hidden = false;
      pairHint.hidden = true;
      pairInstructionText.textContent = mistake.instruction;
      pairResponseText.textContent = mistake.response;
      pairNote.textContent = mistake.note;
    }

    hint.textContent = stopIndex === QUALITY_STOPS.length - 1 ? HINT_DONE : HINT_BASE;
    renderScene();
  };

  slider.addEventListener('input', () => {
    stopIndex = Number(slider.value);
    render();
  });

  stage.append(canvasWrap, head, panels, strip, mistakes, pairZone, bar);
  root.appendChild(stage);

  /* ----- 3D twin clouds + starfield (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     quality onto the refs (and tolerates null refs — jsdom fallback).
     It reads the closure state at call time, which is what makes the
     post-context-loss rebuild re-apply correctly. */
  const applyClouds = (refs: TwinRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.apply(QUALITY_STOPS[stopIndex].quality);
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260408,
      camera: { position: [0, 0, 9], fov: 45 },
      alpha: true,
    },
    build: (h) => buildTwinScene(h),
    reapply: (refs) => applyClouds(refs as TwinRefs | null),
  });

  const renderScene = (): void => {
    applyClouds(kit.refs as TwinRefs | null);
    kit.render();
  };

  /* ---------- initial paint ---------- */
  render();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ============================================================
   3D twin-cloud scene: loose base cloud vs. tightening instruct
   cloud.
   ============================================================ */

interface TwinRefs {
  /** Tighten/tint the instruct cloud for the current coaching quality. */
  apply(quality: number): void;
}

/* Point budget: 2 × 500 clouds + 100 starfield (≤ ~1,500 + 300). */
const CLOUD_COUNT = 500;
const CLOUD_RADIUS = 1.3;
const BASE_CENTER_X = -2.2;
const INSTRUCT_CENTER_X = 2.2;
const BASE_COLOR = '#4A5878';
const TIGHT_COLOR = '#22C48E';
const LOOSE_COLOR = '#6E85FF';

function buildTwinScene(handle: Stage3DHandle): TwinRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /* ----- left "base" cloud -----
     rand() consumption order is frozen: for each point, (1) theta,
     (2) phi, (3) radius (cube-root for a uniform volume fill) — three
     calls per point, 500 for the base cloud, then 500 for the
     instruct cloud, then the starfield. Any change here shifts both. */
  const basePositions = new Float32Array(CLOUD_COUNT * 3);
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = CLOUD_RADIUS * Math.cbrt(rand());
    const sinPhi = Math.sin(phi);
    basePositions[i * 3] = BASE_CENTER_X + r * sinPhi * Math.cos(theta);
    basePositions[i * 3 + 1] = r * Math.cos(phi);
    basePositions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
  }
  const baseColor = new THREE.Color(BASE_COLOR);
  const baseColors = new Float32Array(CLOUD_COUNT * 3);
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    baseColors[i * 3] = baseColor.r;
    baseColors[i * 3 + 1] = baseColor.g;
    baseColors[i * 3 + 2] = baseColor.b;
  }
  const base = makeGlowPoints(basePositions, baseColors, 0.16);
  scene.add(base);

  /* ----- right "instruct" cloud -----
     Same seeded distribution, stored as offsets from its own center;
     `apply()` pulls every offset to `offset × (1 − 0.45 × q/100)`, so
     the cloud tightens as coaching quality rises. */
  const offsets = new Float32Array(CLOUD_COUNT * 3);
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = CLOUD_RADIUS * Math.cbrt(rand());
    const sinPhi = Math.sin(phi);
    offsets[i * 3] = r * sinPhi * Math.cos(theta);
    offsets[i * 3 + 1] = r * Math.cos(phi);
    offsets[i * 3 + 2] = r * sinPhi * Math.sin(theta);
  }
  const instructPositions = new Float32Array(CLOUD_COUNT * 3);
  const instructColors = new Float32Array(CLOUD_COUNT * 3);
  const instruct = makeGlowPoints(instructPositions, instructColors, 0.16);
  scene.add(instruct);
  const posAttr = instruct.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = instruct.geometry.getAttribute('color') as THREE.BufferAttribute;

  addStarfield(handle, 100, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  const looseColor = new THREE.Color(LOOSE_COLOR);
  const tightColor = new THREE.Color(TIGHT_COLOR);
  const color = new THREE.Color();
  let applied = -1;
  return {
    apply(quality) {
      if (quality === applied) return;
      applied = quality;
      const t = quality / 100;
      const scale = 1 - 0.45 * t;
      color.copy(looseColor).lerp(tightColor, t);
      for (let i = 0; i < CLOUD_COUNT; i += 1) {
        instructPositions[i * 3] = INSTRUCT_CENTER_X + offsets[i * 3] * scale;
        instructPositions[i * 3 + 1] = offsets[i * 3 + 1] * scale;
        instructPositions[i * 3 + 2] = offsets[i * 3 + 2] * scale;
        instructColors[i * 3] = color.r;
        instructColors[i * 3 + 1] = color.g;
        instructColors[i * 3 + 2] = color.b;
      }
      posAttr.needsUpdate = true;
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
    body: "Fine-tuning is a short course, not a new school. The model already knows the language; now it studies hundreds of example questions and answers, and each one nudges it toward the helpful style: listen, respond, stop when done.",
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'Without this step, the best next-word predictor on Earth still rambles. A few hundred great coaching examples — quality beats quantity — teach the model that "assistant" means answering, not just continuing.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Fine-tuning can cost under 1% of the compute that built the base model. It learns less new facts than a new personality — the difference between a library and a librarian.',
  },
];

export function mountSftExplain(root: HTMLElement): () => void {
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
