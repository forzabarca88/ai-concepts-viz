/**
 * Parameters visualisation — the "knob cloud" (Task 6).
 *
 * The user picks what the tiny model learns (Poetry / Facts / Code) and
 * then walks it through ten train steps. Each step nudges a seeded batch
 * of 200 knobs (exactly one knob in ten — ten steps move them all, in a
 * seeded Fisher–Yates order); milestones at steps 3 / 6 / 10 report back
 * in the chosen topic's voice, and finishing unlocks a one-shot "Test the
 * model" card. Four named knob cards stand in for blind knob cycling:
 * clicking one spotlights that exact knob; the topic's "favourite" knob
 * wears an amber ring.
 *
 * The fixed-budget Three.js scene (2,192 cloud/ring points + 150
 * starfield — no meshes, lights or shadows) is built through the
 * `createStageKit` resilience kit (2D blit + context-loss rebuild) with
 * `alpha: true`, so the stage's CSS gradient shows through the
 * transparent canvas. The nudged-knob colour is the topic's accent.
 *
 * ALL state ALSO lives in the DOM (topic buttons, knob cards + tooltip,
 * knob-count metric, knowledge meter + step counter, status line, test
 * card) — so every control keeps working in jsdom, where the canvas is
 * replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

/* ------------------------------ fixed data ------------------------------ */

const CLOUD_COUNT = 2_000; // ≤ 3k point budget
const STEPS = 10; // ten train steps
const NUDGE_PER_STEP = CLOUD_COUNT / STEPS; // 200 knobs per step
const NUDGE_OFFSET = 0.28; // radial push for each nudged knob

interface SizeStop {
  label: string;
  knobs: number;
  /** Cloud scale, applied with group.scale.setScalar(). */
  scale: number;
}

/** Three slider stops: 1M / 7B / 70B. 7B is the default. */
const SIZES: SizeStop[] = [
  { label: '1M', knobs: 1_000_000, scale: 0.55 },
  { label: '7B', knobs: 7_000_000_000, scale: 0.9 },
  { label: '70B', knobs: 70_000_000_000, scale: 1.25 },
];

interface Knob {
  name: string;
  id: number;
  value: number;
  /** Cloud point index the spotlight ring is centred on. */
  point: number;
}

/** The four named knobs the cards spotlight (fixed order). */
const KNOBS: Knob[] = [
  { name: 'The "is"-after-"the" knob', id: 4_291_114, value: 0.42, point: 137 },
  { name: 'The "moon"-in-poems knob', id: 612_084, value: 0.87, point: 1_518 },
  { name: 'The "capital-cities" knob', id: 6_930_551, value: 0.13, point: 402 },
  { name: 'The "brackets" knob', id: 1_547_302, value: 0.66, point: 1_873 },
];

interface Topic {
  name: string;
  /** Nudged-knob colour in the 3D cloud. */
  accent: string;
  /** Index into KNOBS — the card wearing the amber "favourite" ring. */
  favorite: number;
  /** Milestone status lines at steps 3 / 6 / 10. */
  milestones: Array<{ at: number; line: string }>;
  testPrompt: string;
  testAnswer: string;
}

const TOPICS: Topic[] = [
  {
    name: 'Poetry',
    accent: '#FF6B5E',
    favorite: 1,
    milestones: [
      { at: 3, line: 'It can rhyme "rose" with "goes" — barely.' },
      { at: 6, line: 'It writes passable haiku with a suspicious amount of "moon".' },
      { at: 10, line: 'It finished the poetry course. Ask it for a haiku about coffee.' },
    ],
    testPrompt: 'Write a haiku about coffee',
    testAnswer:
      'Steam curls, then stills — / the cup holds the morning sun / one sip, and the day starts',
  },
  {
    name: 'Facts',
    accent: '#FFB020',
    favorite: 2,
    milestones: [
      { at: 3, line: 'It knows Paris, but only when you ask nicely.' },
      { at: 6, line: 'Dates and capitals: getting there.' },
      { at: 10, line: 'It finished the facts course. Ask it where the Nile flows.' },
    ],
    testPrompt: 'Where does the Nile flow?',
    testAnswer: 'The Nile flows north, all the way to the Mediterranean.',
  },
  {
    name: 'Code',
    accent: '#22C48E',
    favorite: 3,
    milestones: [
      { at: 3, line: 'It can close a bracket. That is a start.' },
      { at: 6, line: 'Loops and variables: mostly right.' },
      { at: 10, line: 'It finished the code course. Ask it to print the numbers 1 to 3.' },
    ],
    testPrompt: 'Print the numbers 1 to 3',
    testAnswer: '1 / 2 / 3',
  },
];

const STEP_ZERO_LINE = 'Step 0 of 10 — every knob is still at its factory setting.';

const fmt = new Intl.NumberFormat('en-US');

/** Status line for the current (topic, step) — milestones at 3 / 6 / 10. */
function statusFor(topicIndex: number, step: number): string {
  if (step === 0) return STEP_ZERO_LINE;
  const milestone = TOPICS[topicIndex].milestones.find((m) => m.at === step);
  if (milestone) return milestone.line;
  return `Step ${step} of ${STEPS} — ${fmt.format(step * NUDGE_PER_STEP)} of ${fmt.format(
    CLOUD_COUNT,
  )} knobs nudged so far.`;
}

/* ------------------------------ DOM mount ------------------------------- */

export function mountKnobCloud(root: HTMLElement): () => void {
  let topic = 0; // Poetry by default
  let step = 0;
  let size = 1; // 7B by default
  let inspected: number | null = null;
  let revealed = false;

  /* ----- stage (dark card) with the 3D cloud layer behind the UI ----- */
  const stage = document.createElement('section');
  stage.className = 'stage par-stage';
  stage.setAttribute('aria-label', 'Model parameters demo');

  /* 3D layer: the kit owns canvas + blit inside this absolute-fill wrapper */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'par-canvas-wrap stage-3d-layer';

  const head = document.createElement('header');
  head.className = 'par-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Meet the knob cloud';
  const sub = document.createElement('p');
  sub.className = 'par-sub';
  sub.textContent =
    'Every dot is one number the model learns. Each step nudges one knob in ten — ten steps move them all.';
  head.append(h2, sub);

  const tip = document.createElement('div');
  tip.className = 'par-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'status');

  const status = document.createElement('p');
  status.className = 'par-status';
  status.setAttribute('aria-live', 'polite');

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const trainButton = document.createElement('button');
  trainButton.type = 'button';
  trainButton.className = 'btn btn-primary';
  trainButton.textContent = 'Train one step';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = 'Ten steps move every knob exactly once.';
  bar.append(trainButton, hint);

  /* test card — the payoff once all ten steps are done (lives in the
     stage, above the bar, so it is always in the captured frame) */
  const testCard = document.createElement('div');
  testCard.className = 'par-test';
  const testTitle = document.createElement('h3');
  testTitle.className = 'par-test-title';
  testTitle.textContent = 'Test the model';
  const testEmpty = document.createElement('p');
  testEmpty.className = 'par-test-empty';
  testEmpty.textContent = 'Finish training to test the model.';
  const testAsk = document.createElement('p');
  testAsk.className = 'par-test-ask';
  testAsk.textContent = 'You ask:';
  const testPrompt = document.createElement('p');
  testPrompt.className = 'par-test-prompt';
  const testAnswer = document.createElement('p');
  testAnswer.className = 'par-test-answer';
  const testReveal = document.createElement('button');
  testReveal.type = 'button';
  testReveal.className = 'btn btn-ghost par-test-reveal';
  testReveal.textContent = 'Reveal answer';
  testCard.append(testTitle, testEmpty, testAsk, testPrompt, testAnswer, testReveal);

  stage.append(canvasWrap, head, tip, status, testCard, bar);

  /* ----- side panel: size, topic picker, knob cards, meter, test card ----- */
  const side = document.createElement('aside');
  side.className = 'par-side';

  const sideTitle = document.createElement('h2');
  sideTitle.className = 'par-side-title';
  sideTitle.textContent = 'Model size';

  /* topic picker — under the Model size label row */
  const topicsEl = document.createElement('div');
  topicsEl.className = 'par-topics';
  const topicAccentClass = ['par-topic--poetry', 'par-topic--facts', 'par-topic--code'];
  const topicBtns: HTMLButtonElement[] = TOPICS.map((t, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `par-topic ${topicAccentClass[i]}`;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = t.name;
    topicsEl.appendChild(btn);
    return btn;
  });

  const metric = document.createElement('div');
  metric.className = 'metric par-metric';
  const metricValue = document.createElement('span');
  metricValue.className = 'metric-value';
  const metricLabel = document.createElement('span');
  metricLabel.className = 'metric-label';
  metricLabel.textContent = 'knobs';
  metric.append(metricValue, metricLabel);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'par-size-slider';
  slider.min = '0';
  slider.max = '2';
  slider.step = '1';
  slider.value = '1';
  slider.setAttribute('aria-label', 'Model size');
  const ticks = document.createElement('div');
  ticks.className = 'par-ticks';
  const tickEls = SIZES.map(({ label }) => {
    const tick = document.createElement('span');
    tick.className = 'par-tick';
    tick.textContent = label;
    ticks.appendChild(tick);
    return tick;
  });

  /* four named knob cards — clicking selects (spotlight + tooltip) */
  const knobsEl = document.createElement('div');
  knobsEl.className = 'par-knobs';
  const knobBtns: HTMLButtonElement[] = KNOBS.map((knob) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'par-knob-card';
    card.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.className = 'par-knob-name';
    name.textContent = knob.name;
    const id = document.createElement('span');
    id.className = 'par-knob-id';
    id.textContent = `#${fmt.format(knob.id)} · ${knob.value.toFixed(2)}`;
    card.append(name, id);
    knobsEl.appendChild(card);
    return card;
  });

  const meter = document.createElement('div');
  meter.className = 'par-meter';
  const meterTitle = document.createElement('h3');
  meterTitle.className = 'par-meter-title';
  meterTitle.textContent = 'Knowledge';
  const track = document.createElement('div');
  track.className = 'par-meter-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Knowledge');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(STEPS));
  const fill = document.createElement('span');
  fill.className = 'par-meter-fill';
  track.appendChild(fill);
  const count = document.createElement('p');
  count.className = 'par-meter-count';
  meter.append(meterTitle, track, count);

  side.append(sideTitle, topicsEl, metric, slider, ticks, knobsEl, meter);

  /* ----- layout: stage + side panel ----- */
  const grid = document.createElement('div');
  grid.className = 'par-grid';
  grid.append(stage, side);
  root.appendChild(grid);

  /* ----- 3D knob cloud + spotlight + starfield (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current state
     onto the refs (and tolerates null refs — jsdom fallback). It reads
     the closure state at call time, which is what makes the
     post-context-loss rebuild re-apply correctly. */
  const applyScene = (refs: SceneRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.setTopic(TOPICS[topic].accent);
    refs.setStep(step);
    refs.setSize(SIZES[size].scale);
    refs.setInspect(inspected);
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260305,
      camera: { position: [0, 0, 8.6], fov: 45 },
      alpha: true,
    },
    build: (h) => buildKnobScene(h),
    reapply: (refs) => applyScene(refs as SceneRefs | null),
  });

  const renderScene = (): void => {
    applyScene(kit.refs as SceneRefs | null);
    kit.render();
  };

  /* ----- state application ----- */

  function applyTest(): void {
    const done = step === STEPS;
    testEmpty.hidden = done;
    testAsk.hidden = !done;
    testPrompt.hidden = !done;
    testAnswer.hidden = !(done && revealed);
    testReveal.hidden = !done;
    testReveal.disabled = revealed;
    if (done) {
      testPrompt.textContent = TOPICS[topic].testPrompt;
      testAnswer.textContent = TOPICS[topic].testAnswer;
    }
  }

  function applyStep(): void {
    status.textContent = statusFor(topic, step);
    count.textContent = `${step} of ${STEPS} steps`;
    fill.style.width = `${(step / STEPS) * 100}%`;
    track.setAttribute('aria-valuenow', String(step));
    trainButton.disabled = step === STEPS;
    applyTest();
    renderScene();
  }

  function applyTopic(): void {
    topicBtns.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === topic)));
    knobBtns.forEach((card, i) =>
      card.classList.toggle('par-knob-card--fav', i === TOPICS[topic].favorite),
    );
    status.textContent = statusFor(topic, step);
    applyTest();
    renderScene();
  }

  function applySize(): void {
    metricValue.textContent = fmt.format(SIZES[size].knobs);
    slider.style.setProperty('--par-fill', `${(size / (SIZES.length - 1)) * 100}%`);
    tickEls.forEach((tick, i) => tick.classList.toggle('par-tick--active', i === size));
    renderScene();
  }

  function applyInspect(): void {
    knobBtns.forEach((card, i) => card.setAttribute('aria-pressed', String(i === inspected)));
    if (inspected === null) {
      tip.hidden = true;
    } else {
      const knob = KNOBS[inspected];
      tip.textContent = `Knob #${fmt.format(knob.id)} · value ${knob.value.toFixed(2)}`;
      tip.hidden = false;
    }
    renderScene();
  }

  trainButton.addEventListener('click', () => {
    if (step < STEPS) {
      step += 1;
      applyStep();
    }
  });
  topicBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (topic === i) return;
      topic = i;
      revealed = false; // the one-shot answer belongs to the previous topic
      applyTopic();
    });
  });
  knobBtns.forEach((card, i) => {
    card.addEventListener('click', () => {
      inspected = inspected === i ? null : i;
      applyInspect();
    });
  });
  slider.addEventListener('input', () => {
    size = Number(slider.value);
    applySize();
  });
  testReveal.addEventListener('click', () => {
    if (step !== STEPS || revealed) return;
    revealed = true;
    applyTest();
  });

  applyStep();
  applyTopic();
  applySize();
  applyInspect();

  return () => {
    kit.dispose();
    grid.remove();
  };
}

/* ------------------------------ 3D scene -------------------------------- */

interface SceneRefs {
  setTopic(accent: string): void;
  setStep(step: number): void;
  setSize(scale: number): void;
  setInspect(index: number | null): void;
}

function buildKnobScene(handle: Stage3DHandle): SceneRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const colorKnobDim = new THREE.Color('#31417c');
  const colorKnobBright = new THREE.Color('#dfe8ff');
  // Nudged knobs wear the current topic's accent — setTopic() re-tints.
  const colorNudged = new THREE.Color(TOPICS[0].accent);
  const ringOuterColor = new THREE.Color('#ffb020');
  const ringInnerColor = new THREE.Color('#ffd98a');

  /* Everything (cloud + spotlight ring) lives in one group so the size
     slider can rescale the whole model with one setScalar(). The
     starfield is added to the scene, outside the group. */
  const group = new THREE.Group();
  scene.add(group);

  const dirX = new Float32Array(CLOUD_COUNT);
  const dirY = new Float32Array(CLOUD_COUNT);
  const dirZ = new Float32Array(CLOUD_COUNT);
  const basePos = new Float32Array(CLOUD_COUNT * 3);
  const baseColors = new Float32Array(CLOUD_COUNT * 3);
  const pos = new Float32Array(CLOUD_COUNT * 3);
  const cols = new Float32Array(CLOUD_COUNT * 3);
  const preLearned = new Uint8Array(CLOUD_COUNT);
  const tmp = new THREE.Color();

  /* ----- knob cloud: seeded shell sphere — the rand() consumption
     order here is frozen: four calls per knob plus a fifth only for
     the non-pre-learned knobs' shade lerp. Any change would shift the
     whole cloud. ----- */
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const sinPhi = Math.sin(phi);
    const dx = sinPhi * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = sinPhi * Math.sin(theta);
    const radius = 1.4 + 0.6 * rand();
    const shade = rand(); // 0.1 of the knobs ship pre-learned (topic accent)
    dirX[i] = dx;
    dirY[i] = dy;
    dirZ[i] = dz;
    basePos[i * 3] = dx * radius;
    basePos[i * 3 + 1] = dy * radius;
    basePos[i * 3 + 2] = dz * radius;
    if (shade < 0.1) {
      preLearned[i] = 1;
      tmp.copy(colorNudged);
    } else {
      tmp.copy(colorKnobDim).lerp(colorKnobBright, rand());
    }
    baseColors[i * 3] = tmp.r;
    baseColors[i * 3 + 1] = tmp.g;
    baseColors[i * 3 + 2] = tmp.b;
    pos[i * 3] = basePos[i * 3];
    pos[i * 3 + 1] = basePos[i * 3 + 1];
    pos[i * 3 + 2] = basePos[i * 3 + 2];
    cols[i * 3] = baseColors[i * 3];
    cols[i * 3 + 1] = baseColors[i * 3 + 1];
    cols[i * 3 + 2] = baseColors[i * 3 + 2];
  }

  /* ----- seeded train order -----
     A seeded Fisher–Yates permutation: step s nudges exactly the next
     200 knobs, so ten steps move all 2,000 — each exactly once, in a
     deterministic order. */
  const order: number[] = new Array(CLOUD_COUNT);
  for (let i = 0; i < CLOUD_COUNT; i++) order[i] = i;
  for (let i = CLOUD_COUNT - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  const batch = new Uint8Array(CLOUD_COUNT); // which step nudges this knob
  for (let s = 0; s < STEPS; s++) {
    for (let k = 0; k < NUDGE_PER_STEP; k++) {
      batch[order[s * NUDGE_PER_STEP + k]] = s;
    }
  }

  const cloud = makeGlowPoints(pos, cols, 0.055);
  group.add(cloud);
  const posAttr = cloud.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = cloud.geometry.getAttribute('color') as THREE.BufferAttribute;

  /* ----- spotlight ring (two concentric glow rings, camera-facing) -----
     The camera sits on the +z axis, so a ring in the xy-plane reads as a
     perfect circle on screen. Ring geometry is fully deterministic
     (no rand() calls). */
  const RING_POINTS = 96;
  function makeRing(radius: number, size: number, color: THREE.Color): THREE.Points {
    const positions = new Float32Array(RING_POINTS * 3);
    for (let k = 0; k < RING_POINTS; k++) {
      const th = (k / RING_POINTS) * Math.PI * 2;
      positions[k * 3] = Math.cos(th) * radius;
      positions[k * 3 + 1] = Math.sin(th) * radius;
    }
    const points = makeGlowPoints(positions, null, size);
    (points.material as THREE.PointsMaterial).color.copy(color);
    return points;
  }
  const ringOuter = makeRing(0.5, 0.09, ringOuterColor);
  const ringInner = makeRing(0.34, 0.06, ringInnerColor);
  const ringGroup = new THREE.Group();
  ringGroup.add(ringOuter, ringInner);
  ringGroup.visible = false;
  group.add(ringGroup);

  addStarfield(handle, 150, 8, '#22304F');

  /* ----- state setters (immediate — the frozen protocol has no tweens) ----- */
  let appliedStep = 0;
  let appliedInspect: number | null = null;
  const knobPos = new THREE.Vector3();

  function knobPosition(i: number, out: THREE.Vector3): THREE.Vector3 {
    const nudge = batch[i] < appliedStep ? NUDGE_OFFSET : 0;
    out.set(
      basePos[i * 3] + dirX[i] * nudge,
      basePos[i * 3 + 1] + dirY[i] * nudge,
      basePos[i * 3 + 2] + dirZ[i] * nudge,
    );
    return out;
  }

  function recolor(): void {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      if (preLearned[i] || batch[i] < appliedStep) {
        colAttr.setXYZ(i, colorNudged.r, colorNudged.g, colorNudged.b);
      } else {
        colAttr.setXYZ(i, baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
      }
    }
    colAttr.needsUpdate = true;
  }

  function placeRing(): void {
    if (appliedInspect === null) return;
    knobPosition(KNOBS[appliedInspect].point, knobPos);
    ringGroup.position.copy(knobPos);
  }

  return {
    setTopic(accent) {
      colorNudged.set(accent);
      recolor();
    },
    setStep(nextStep) {
      appliedStep = nextStep;
      for (let i = 0; i < CLOUD_COUNT; i++) {
        knobPosition(i, knobPos);
        posAttr.setXYZ(i, knobPos.x, knobPos.y, knobPos.z);
      }
      posAttr.needsUpdate = true;
      recolor();
      placeRing(); // the spotlight follows its knob as training proceeds
    },
    setSize(scale) {
      group.scale.setScalar(scale);
    },
    setInspect(index) {
      appliedInspect = index;
      ringGroup.visible = index !== null;
      if (index !== null) placeRing();
    },
  };
}

/* --------------------------- explain cards ------------------------------ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '◉',
    title: "What's happening",
    body: "Every dot is one of the model's numbers — a knob. A training step compares a guess with the right answer, then nudges a slice of the knobs a little. Ten steps later the whole cloud has shifted: that shift is the learning.",
  },
  {
    glyph: '∑',
    title: 'Why it matters',
    body: 'Nothing a model "knows" is hand-written. Every fact, tone and reflex in its answers is stored as the position of billions of these tiny numbers.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Seven billion knobs at two bytes each is 14 GB — everything a 7B model "knows" fits on one old hard drive, with room left for movies.',
  },
];

export function mountExplainCards(root: HTMLElement): () => void {
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
