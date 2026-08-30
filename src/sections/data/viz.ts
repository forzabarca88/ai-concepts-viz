/**
 * Data visualisation — the "river of pages" (Task 4).
 *
 * The user runs the model's data pipeline: three curation decisions
 * (Curation / Cleaning / Deduplication), each a real choice with a
 * different page-survival rate. Every visible number (counters, verdict,
 * quality meter, lit token count, ring states) is a pure function of the
 * three choices — no scripted walk, and every state is mirrored in the
 * DOM so jsdom and the no-WebGL fallback keep working.
 *
 * The fixed-budget Three.js scene (2,900 points + 200 starfield — no
 * meshes, lights or shadows) is built through the `createStageKit`
 * resilience kit (2D blit + context-loss rebuild) with `alpha: true`, so
 * the stage's CSS gradient shows through the transparent canvas.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

/* ------------------------------ fixed data ------------------------------ */

interface Topic {
  name: string;
  /** Base share of the reading mix, in percent. */
  share: number;
  /** Particle colour (sRGB hex — THREE.Color converts to the linear working space). */
  color: string;
  /** Row modifier class selecting the mix-bar fill colour in CSS. */
  fillClass: string;
}

const TOPICS: Topic[] = [
  { name: 'Books', share: 30, color: '#ffb020', fillClass: 'data-fill--books' },
  { name: 'Code', share: 20, color: '#22c48e', fillClass: 'data-fill--code' },
  { name: 'Web pages', share: 35, color: '#6e85ff', fillClass: 'data-fill--web' },
  { name: 'Chats', share: 15, color: '#9fa8bc', fillClass: 'data-fill--chats' },
];

interface StageOption {
  label: string;
  description: string;
  /** Fraction of the incoming pages that survive this stage. */
  rate: number;
  /** Strictness score contribution (0–2); summed over the three stages. */
  score: number;
}

interface CurationStage {
  name: string;
  question: string;
  options: StageOption[];
}

/** The three curation decisions, in pipeline order. */
const STAGES: CurationStage[] = [
  {
    name: 'Curation',
    question: 'Ten million pages arrived. Which sources does the model get to read?',
    options: [
      {
        label: 'Keep it broad',
        description: 'News, forums, wikis, blogs — almost everything.',
        rate: 0.85,
        score: 0,
      },
      {
        label: 'Best sources only',
        description: 'Quality publications, educational sites, code repositories.',
        rate: 0.42,
        score: 1,
      },
      {
        label: 'Books & scholarly articles',
        description: 'The highest-quality writing humans produce.',
        rate: 0.2,
        score: 2,
      },
    ],
  },
  {
    name: 'Cleaning',
    question: 'The pages are in. How hard do we scrub the junk out of them?',
    options: [
      {
        label: 'Light pass',
        description: 'Remove broken pages and boilerplate; leave the rest.',
        rate: 0.7,
        score: 0,
      },
      {
        label: 'Standard scrub',
        description: 'Strip navigation, ads, duplicate blocks and encoding noise.',
        rate: 0.55,
        score: 1,
      },
      {
        label: 'Surgical',
        description: 'Keep only coherent paragraphs a reader would actually finish.',
        rate: 0.4,
        score: 2,
      },
    ],
  },
  {
    name: 'Deduplication',
    question: 'Finally: how aggressively do we remove near-copies?',
    options: [
      {
        label: 'Keep near-duplicates',
        description: 'Variations of a page may carry variation the model should learn.',
        rate: 0.6,
        score: 0,
      },
      {
        label: 'Standard dedup',
        description: 'Remove obvious copies and minor edits.',
        rate: 0.45,
        score: 1,
      },
      {
        label: 'Aggressive dedup',
        description: 'Collapse anything that sounds even remotely familiar.',
        rate: 0.3,
        score: 2,
      },
    ],
  },
];

/** The raw intake: the counter chain always starts here. */
const RAW_PAGES = 10_000_000;

/** Status line for each in-progress stage (the done state builds its own). */
const STAGE_STATUS = [
  'Ten million raw pages, ready for your first call.',
  'Curation decided — the river narrows. How hard do we scrub the pages?',
  'Cleaning decided — now the final call: near-copies.',
] as const;

/** Counter chain labels — the last stage becomes "tokens ready". */
const COUNTER_LABELS = ['pages', 'clean pages', 'unique pages', 'tokens ready'] as const;

/** Fixed verdicts, indexed by strictness score (0–6). */
const VERDICTS: string[] = [
  'A wide, noisy diet — the model learns fast and loudly, including the spam.',
  'A little curation — mostly good, some junk.',
  'Decent filtering — the usual compromise of a big web crawl.',
  'Careful data — you would be proud of the reading list.',
  'Tight curation — small, clean and deliberate.',
  'Very strict — almost a curated library, not the open web.',
  'The rarest recipe of all: a tiny, perfect diet. Quality over quantity.',
];

const fmt = new Intl.NumberFormat('en-US');

/**
 * The pipeline as a pure function of the (partial) choices:
 * `pages(k+1) = round(pages(k) × rate(choice[k]))`, tokens = pages(4) × 8,
 * score = Σ option scores, quality = 30 + 10 × score.
 */
function pipelineOf(choices: Array<number | undefined>): {
  pages: number[]; // [raw, after curation, after cleaning, after dedup]
  tokens: number;
  score: number;
  quality: number;
  litTokens: number;
} {
  const pages = [RAW_PAGES];
  for (let k = 0; k < STAGES.length; k += 1) {
    const rate = choices[k] != null ? STAGES[k].options[choices[k] as number].rate : 1;
    pages.push(Math.round(pages[k] * rate));
  }
  const score = choices.reduce<number>(
    (sum, c, k) => sum + (c != null ? STAGES[k].options[c as number].score : 0),
    0,
  );
  return {
    pages,
    tokens: pages[pages.length - 1] * 8,
    score,
    quality: 30 + 10 * score,
    litTokens: Math.round((TOKEN_COUNT * pages[pages.length - 1]) / RAW_PAGES),
  };
}

/* Point budget: 2,000 river + 3×120 ring + 3×120 halo + 180 tokens = 2,900
   (+ ≤ 300 starfield, added through the kit). */
const RIVER_COUNT = 2_000;
const RING_T = [0.3, 0.52, 0.74] as const;
const RING_POINT_COUNT = 120;
const TOKEN_COUNT = 180;

/* ------------------------------ DOM mount ------------------------------- */

export function mountDataPipeline(root: HTMLElement): () => void {
  let stageIndex = 0; // 0–3; 3 = done
  const choices: Array<number | undefined> = [undefined, undefined, undefined];
  const activeTopics = [true, true, true, true];

  /* ----- stage (dark card) ----- */
  const stage = document.createElement('section');
  stage.className = 'stage data-stage';
  stage.setAttribute('aria-label', 'Data pipeline demo');

  /* ----- 3D river layer (behind the UI; the kit owns canvas + blit) ----- */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'data-canvas-wrap stage-3d-layer';

  const head = document.createElement('header');
  head.className = 'data-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Watch the reading pipeline';
  const sub = document.createElement('p');
  sub.className = 'data-sub';
  sub.textContent =
    "You make the curation calls for the model's first lesson. Every choice changes what survives — and what it learns.";
  head.append(h2, sub);

  /* ----- decision panel: question + options, or the verdict ----- */
  const panel = document.createElement('div');
  panel.className = 'data-panel';
  const question = document.createElement('p');
  question.className = 'data-question';
  const optionsEl = document.createElement('div');
  optionsEl.className = 'data-options';
  const verdict = document.createElement('p');
  verdict.className = 'data-verdict';
  const quality = document.createElement('div');
  quality.className = 'data-quality';
  const qualityLabel = document.createElement('span');
  qualityLabel.className = 'data-quality-label';
  const track = document.createElement('span');
  track.className = 'data-quality-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  fill.className = 'data-quality-fill';
  track.appendChild(fill);
  quality.append(qualityLabel, track);
  panel.append(question, optionsEl, verdict, quality);

  /* ----- ring labels (DOM mirror of the 3D rings) ----- */
  const ringsEl = document.createElement('div');
  ringsEl.className = 'data-rings';
  STAGES.forEach((stageDef, i) => {
    const ring = document.createElement('span');
    ring.className = 'data-ring';
    const dot = document.createElement('span');
    dot.className = 'data-ring-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = String(i + 1);
    const label = document.createElement('span');
    label.textContent = stageDef.name;
    ring.append(dot, label);
    ringsEl.appendChild(ring);
  });

  const status = document.createElement('p');
  status.className = 'data-status';
  status.setAttribute('aria-live', 'polite');

  /* ----- stage bar: Back / Start over ----- */
  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'btn btn-ghost data-back';
  backButton.textContent = '← Back';
  backButton.hidden = true;
  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'btn btn-ghost';
  resetButton.textContent = 'Start over';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = 'Three curation decisions stand between the web and the model.';
  bar.append(backButton, resetButton, hint);

  stage.append(canvasWrap, head, panel, ringsEl, status, bar);

  /* ----- side panel: counters + reading mix (next to the stage) ----- */
  const side = document.createElement('aside');
  side.className = 'data-side';

  const sideTitle = document.createElement('h2');
  sideTitle.className = 'data-side-title';
  sideTitle.textContent = 'From raw to ready';

  const countersEl = document.createElement('div');
  countersEl.className = 'data-counters';
  const counterEls: HTMLElement[] = [];
  const counterValueEls: HTMLElement[] = [];
  COUNTER_LABELS.forEach((label) => {
    const metric = document.createElement('div');
    metric.className = 'metric data-counter';
    const valueEl = document.createElement('span');
    valueEl.className = 'metric-value';
    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.textContent = label;
    metric.append(valueEl, labelEl);
    countersEl.appendChild(metric);
    counterEls.push(metric);
    counterValueEls.push(valueEl);
  });

  const mix = document.createElement('div');
  mix.className = 'data-mix';
  const mixTitle = document.createElement('h3');
  mixTitle.className = 'data-mix-title';
  mixTitle.textContent = 'The reading mix';
  const mixSub = document.createElement('p');
  mixSub.className = 'data-mix-sub';
  mixSub.textContent = 'Toggle a topic — the river and the bar both change.';
  mix.append(mixTitle, mixSub);

  const pctEls: HTMLElement[] = [];
  const fillEls: HTMLElement[] = [];
  const rowEls: HTMLElement[] = [];
  const toggleEls: HTMLButtonElement[] = [];
  for (const topic of TOPICS) {
    const row = document.createElement('div');
    row.className = `data-mix-row ${topic.fillClass}`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle data-topic-toggle';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', 'true');
    toggle.setAttribute('aria-label', topic.name);

    const name = document.createElement('span');
    name.className = 'data-mix-name';
    name.textContent = topic.name;

    const trackEl = document.createElement('span');
    trackEl.className = 'data-mix-track';
    trackEl.setAttribute('aria-hidden', 'true');
    const fillEl = document.createElement('span');
    fillEl.className = 'data-mix-fill';
    trackEl.appendChild(fillEl);

    const pct = document.createElement('span');
    pct.className = 'data-mix-pct';

    row.append(toggle, name, trackEl, pct);
    mix.appendChild(row);
    pctEls.push(pct);
    fillEls.push(fillEl);
    rowEls.push(row);
    toggleEls.push(toggle);
  }

  side.append(sideTitle, countersEl, mix);

  /* ----- layout: stage + side panel ----- */
  const grid = document.createElement('div');
  grid.className = 'data-grid';
  grid.append(stage, side);
  root.appendChild(grid);

  /* ----- 3D river, rings, token cluster + starfield (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     decisions onto the refs (and tolerates null refs — jsdom fallback).
     It reads the closure state at call time, which is what makes the
     post-context-loss rebuild re-apply correctly. */
  const applyRiver = (refs: RiverRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    const done = stageIndex >= STAGES.length;
    refs.setRiver(activeTopics);
    refs.setRings(done ? STAGES.length : stageIndex);
    refs.setTokens(pipelineOf(choices).litTokens);
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260301,
      camera: { position: [0, 0.2, 11.5], fov: 42 },
      alpha: true,
    },
    build: (h) => buildRiverScene(h),
    reapply: (refs) => applyRiver(refs as RiverRefs | null),
  });

  const renderRiver = (): void => {
    applyRiver(kit.refs as RiverRefs | null);
    kit.render();
  };

  /* ----- state application ----- */

  function applyStage(): void {
    const done = stageIndex >= STAGES.length;
    const result = pipelineOf(choices);

    // Counter chain: raw pages first; "clean pages" reveals as soon as
    // curation is decided; "unique pages" (the dedup result) and
    // "tokens ready" reveal once dedup is decided. `—` until reached.
    counterValueEls.forEach((el, i) => {
      if (i === 0) {
        el.textContent = fmt.format(RAW_PAGES);
        return;
      }
      const reached = i === 1 ? choices[0] != null : choices[2] != null;
      const value = i === 1 ? result.pages[1] : i === 2 ? result.pages[3] : result.tokens;
      el.textContent = reached ? fmt.format(value) : '—';
    });
    const active = done ? COUNTER_LABELS.length - 1 : stageIndex;
    counterEls.forEach((el, i) => el.classList.toggle('data-counter--active', i === active));

    // Ring r is amber while stage r is being decided, mint once decided.
    ringsEl.querySelectorAll<HTMLElement>('.data-ring').forEach((el, i) => {
      el.classList.toggle('data-ring--active', !done && i === stageIndex);
      el.classList.toggle('data-ring--passed', choices[i] != null && i !== stageIndex);
    });

    status.textContent = done
      ? `All three calls made — ${fmt.format(result.pages[3])} pages became ${fmt.format(
          result.tokens,
        )} tokens.`
      : STAGE_STATUS[stageIndex];

    // Decision panel: question + options, or the verdict + quality meter.
    if (done) {
      question.hidden = true;
      optionsEl.hidden = true;
      verdict.hidden = false;
      verdict.textContent = VERDICTS[result.score];
      quality.hidden = false;
      quality.setAttribute('role', 'progressbar');
      quality.setAttribute('aria-label', `Data quality ${result.quality}%`);
      quality.setAttribute('aria-valuemin', '0');
      quality.setAttribute('aria-valuemax', '100');
      quality.setAttribute('aria-valuenow', String(result.quality));
      qualityLabel.textContent = `Data quality ${result.quality}%`;
      fill.style.width = `${result.quality}%`;
      backButton.hidden = false;
    } else {
      const s = STAGES[stageIndex];
      question.hidden = false;
      optionsEl.hidden = false;
      verdict.hidden = true;
      quality.hidden = true;
      question.textContent = s.question;
      optionsEl.innerHTML = '';
      s.options.forEach((option, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'data-option';
        btn.setAttribute('aria-pressed', String(choices[stageIndex] === i));
        const label = document.createElement('span');
        label.className = 'data-option-label';
        label.textContent = option.label;
        const desc = document.createElement('span');
        desc.className = 'data-option-desc';
        desc.textContent = option.description;
        btn.append(label, desc);
        btn.addEventListener('click', () => choose(i));
        optionsEl.appendChild(btn);
      });
      backButton.hidden = stageIndex === 0;
    }

    renderRiver();
  }

  const choose = (i: number): void => {
    if (stageIndex >= STAGES.length) return;
    choices[stageIndex] = i;
    stageIndex += 1;
    applyStage();
  };

  backButton.addEventListener('click', () => {
    if (stageIndex > 0) {
      stageIndex -= 1;
      applyStage();
    }
  });
  resetButton.addEventListener('click', () => {
    for (let i = 0; i < choices.length; i += 1) choices[i] = undefined;
    stageIndex = 0;
    applyStage();
  });

  function applyMix(): void {
    const activeSum = TOPICS.reduce((sum, t, i) => sum + (activeTopics[i] ? t.share : 0), 0);
    TOPICS.forEach((topic, i) => {
      const on = activeTopics[i];
      const pct = on && activeSum > 0 ? topic.share / activeSum : 0;
      pctEls[i].textContent = `${Math.round(pct * 100)}%`;
      fillEls[i].style.width = `${Number((pct * 100).toFixed(2))}%`;
      rowEls[i].classList.toggle('data-mix-row--off', !on);
    });
    renderRiver();
  }

  toggleEls.forEach((toggle, i) => {
    toggle.addEventListener('click', () => {
      activeTopics[i] = !activeTopics[i];
      toggle.setAttribute('aria-checked', String(activeTopics[i]));
      applyMix();
    });
  });

  applyStage();
  applyMix();

  return () => {
    kit.dispose();
    grid.remove();
  };
}

/* ------------------------------ 3D scene -------------------------------- */

interface RiverRefs {
  setRiver(on: boolean[]): void;
  /** activeStage: stage being decided (0–2) or 3 = all passed. */
  setRings(activeStage: number): void;
  setTokens(litCount: number): void;
}

function buildRiverScene(handle: Stage3DHandle): RiverRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const topicColors = TOPICS.map((t) => new THREE.Color(t.color));
  const colorRiverOff = new THREE.Color('#2b3552');
  const colorRingWaiting = new THREE.Color('#33405f');
  const colorRingActive = new THREE.Color('#ffb020');
  const colorRingPassed = new THREE.Color('#22c48e');
  const colorTokenDim = new THREE.Color('#10182b');
  const colorStage = new THREE.Color('#0b101f');
  const tokenLit = [new THREE.Color('#6e85ff'), new THREE.Color('#22c48e'), new THREE.Color('#ffb020')];

  /* The tilted tube: a fixed Catmull-Rom path from top-left to bottom-right. */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.1, 3.3, 0),
    new THREE.Vector3(-1.7, 2.0, 0.8),
    new THREE.Vector3(0.0, 0.5, -0.6),
    new THREE.Vector3(1.9, -1.3, 0.7),
    new THREE.Vector3(3.2, -3.3, 0),
  ]);
  const UP = new THREE.Vector3(0, 1, 0);
  const tang = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const pt = new THREE.Vector3();
  function basisAt(t: number): void {
    curve.getTangent(t, tang);
    nrm.crossVectors(tang, UP);
    if (nrm.lengthSq() < 1e-8) nrm.set(1, 0, 0);
    else nrm.normalize();
    bin.crossVectors(tang, nrm).normalize();
  }

  /* ----- river of pages: even flow along the curve, seeded radial scatter -----
     The rand() consumption order here is frozen: one call for the topic,
     then four per point — any change would shift the whole river. */
  const riverPos = new Float32Array(RIVER_COUNT * 3);
  const riverCol = new Float32Array(RIVER_COUNT * 3);
  const riverTopics = new Uint8Array(RIVER_COUNT);
  for (let i = 0; i < RIVER_COUNT; i++) {
    const u = rand();
    riverTopics[i] = u < 0.3 ? 0 : u < 0.5 ? 1 : u < 0.85 ? 2 : 3;
    const t = Math.min(1, Math.max(0, (i + 0.5) / RIVER_COUNT + (rand() - 0.5) * 0.02));
    const angle = rand() * Math.PI * 2;
    const radius = 0.5 * Math.sqrt(rand());
    const drift = (rand() - 0.5) * 0.2;
    basisAt(t);
    curve.getPoint(t, pt);
    const cos = Math.cos(angle) * radius;
    const sin = Math.sin(angle) * radius;
    riverPos[i * 3] = pt.x + nrm.x * cos + bin.x * sin + tang.x * drift;
    riverPos[i * 3 + 1] = pt.y + nrm.y * cos + bin.y * sin + tang.y * drift;
    riverPos[i * 3 + 2] = pt.z + nrm.z * cos + bin.z * sin + tang.z * drift;
  }
  const river = makeGlowPoints(riverPos, riverCol, 0.062);
  scene.add(river);
  const riverColors = river.geometry.getAttribute('color') as THREE.BufferAttribute;

  /* ----- three filter rings, each with a softer halo ring around it -----
     All gates share ONE fixed normal (not the curve tangent): the tangent
     basis twists along the curve and the last ring would end up nearly
     edge-on. A shared normal keeps three parallel, evenly open ellipses.
     Ring geometry is fully deterministic (no rand() calls). */
  const ringNormal = new THREE.Vector3(0.6, -0.55, 0.45).normalize();
  const ringU = new THREE.Vector3().crossVectors(ringNormal, UP);
  if (ringU.lengthSq() < 1e-8) ringU.set(1, 0, 0);
  ringU.normalize();
  const ringV = new THREE.Vector3().crossVectors(ringNormal, ringU).normalize();

  const ringMats: THREE.PointsMaterial[] = [];
  const haloMats: THREE.PointsMaterial[] = [];
  for (let r = 0; r < RING_T.length; r++) {
    curve.getPoint(RING_T[r], pt);
    for (let m = 0; m < 2; m++) {
      const positions = new Float32Array(RING_POINT_COUNT * 3);
      const radius = m === 0 ? 0.9 : 1.08;
      for (let k = 0; k < RING_POINT_COUNT; k++) {
        const th = (k / RING_POINT_COUNT) * Math.PI * 2;
        const cos = Math.cos(th) * radius;
        const sin = Math.sin(th) * radius;
        positions[k * 3] = pt.x + ringU.x * cos + ringV.x * sin;
        positions[k * 3 + 1] = pt.y + ringU.y * cos + ringV.y * sin;
        positions[k * 3 + 2] = pt.z + ringU.z * cos + ringV.z * sin;
      }
      const points = makeGlowPoints(positions, null, m === 0 ? 0.1 : 0.17);
      const mat = points.material as THREE.PointsMaterial;
      mat.color.copy(m === 0 ? colorRingWaiting : colorRingWaiting.clone().lerp(colorStage, 0.6));
      (m === 0 ? ringMats : haloMats).push(mat);
      scene.add(points);
    }
  }

  /* ----- token chips below the tube exit (light up as tokens are ready) ----- */
  const tokenPos = new Float32Array(TOKEN_COUNT * 3);
  for (let i = 0; i < TOKEN_COUNT; i++) {
    tokenPos[i * 3] = 3.35 + (rand() - 0.5) * 2.4;
    tokenPos[i * 3 + 1] = -3.8 + (rand() - 0.5) * 0.55;
    tokenPos[i * 3 + 2] = 0.15 + (rand() - 0.5) * 0.9;
  }
  const tokens = makeGlowPoints(tokenPos, new Float32Array(TOKEN_COUNT * 3), 0.08);
  scene.add(tokens);
  const tokenColors = tokens.geometry.getAttribute('color') as THREE.BufferAttribute;

  addStarfield(handle, 200, 9, '#22304F');

  const haloTmp = new THREE.Color();
  return {
    setRiver(on) {
      for (let i = 0; i < RIVER_COUNT; i++) {
        const topic = riverTopics[i];
        const c = on[topic] ? topicColors[topic] : colorRiverOff;
        riverColors.setXYZ(i, c.r, c.g, c.b);
      }
      riverColors.needsUpdate = true;
    },
    setRings(activeStage) {
      for (let r = 0; r < RING_T.length; r++) {
        // Mirrors the DOM ring labels: amber while stage r is being
        // decided, mint once decided, dim otherwise.
        const c =
          r === activeStage
            ? colorRingActive
            : activeStage > r
              ? colorRingPassed
              : colorRingWaiting;
        ringMats[r].color.copy(c);
        haloTmp.copy(c).lerp(colorStage, 0.6);
        haloMats[r].color.copy(haloTmp);
      }
    },
    setTokens(litCount) {
      for (let i = 0; i < TOKEN_COUNT; i++) {
        const c = i < litCount ? tokenLit[i % 3] : colorTokenDim;
        tokenColors.setXYZ(i, c.r, c.g, c.b);
      }
      tokenColors.needsUpdate = true;
    },
  };
}

/* --------------------------- explain cards ------------------------------ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '▤',
    title: "What's happening",
    body: "You just curated the model's first lesson. Ten million pages pour in; your three calls decide how many survive — and every surviving page is cut into eight tokens.",
  },
  {
    glyph: '⚖',
    title: 'Why it matters',
    body: "A model picks up the style of what it reads. Garbage in, garbage out — feed it mostly spam and you get a spammy model.",
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Llama 3.1 read 15 trillion tokens — roughly 5,000 years of human reading, compressed into a single training run.',
  },
];

export function mountDataExplain(root: HTMLElement): () => void {
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
