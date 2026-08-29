/**
 * Data visualisation — the "river of pages" (Task 3, 3D).
 *
 * A fixed-budget Three.js scene (2,900 THREE.Points total — no meshes,
 * lights or shadows) streams seeded points down a tilted tube past three
 * filter rings; a token-chip cluster materialises below the tube once the
 * pipeline completes. Every state change recomposes the scene and calls
 * `frame()` exactly once (frozen protocol — see src/three/helpers.ts).
 *
 * All pipeline state ALSO lives in the DOM (counters, ring labels, status
 * line, mix bar) — so every control keeps working in jsdom, where the
 * canvas is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { createStage3D } from '../../three/helpers';
import type { Stage3DHandle, Stage3DOptions } from '../../three/helpers';

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

const RING_NAMES = ['Curation', 'Cleaning', 'Deduplication'] as const;

/** Four gated steps: the raw intake plus one step per filter. */
const STEP_STATUS = [
  'Raw intake — 10,000,000 pages arrive. Most are noise.',
  'Curation keeps the best sources — 4,200,000 clean pages remain.',
  'Cleaning strips junk and near-copies — 1,100,000 unique pages remain.',
  'Deduplication cuts the last repeats — 8,800,000 tokens, ready to learn.',
];

const COUNTERS: Array<{ value: number; label: string }> = [
  { value: 10_000_000, label: 'pages' },
  { value: 4_200_000, label: 'clean pages' },
  { value: 1_100_000, label: 'unique pages' },
  { value: 8_800_000, label: 'tokens' },
];

const fmt = new Intl.NumberFormat('en-US');

/* Point budget: 2,000 river + 3×120 ring + 3×120 halo + 180 tokens = 2,900 (≤ 3,000). */
const RIVER_COUNT = 2_000;
const RING_T = [0.3, 0.52, 0.74] as const;
const RING_POINT_COUNT = 120;
const TOKEN_COUNT = 180;

const STAGE_BG = '#0b101f';

/* ------------------------------ DOM mount ------------------------------- */

export function mountDataPipeline(root: HTMLElement): () => void {
  let step = 0;
  const activeTopics = [true, true, true, true];

  /* ----- stage (dark card) ----- */
  const stage = document.createElement('section');
  stage.className = 'stage data-stage';
  stage.setAttribute('aria-label', 'Data pipeline demo');

  const head = document.createElement('header');
  head.className = 'data-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Watch the reading pipeline';
  const sub = document.createElement('p');
  sub.className = 'data-sub';
  sub.textContent =
    'Ten million pages stream past three filters. Only the good stuff survives.';
  head.append(h2, sub);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'data-canvas-wrap';

  /* ----- ring labels (DOM mirror of the 3D rings) ----- */
  const ringsEl = document.createElement('div');
  ringsEl.className = 'data-rings';
  const ringEls: HTMLElement[] = RING_NAMES.map((name, i) => {
    const ring = document.createElement('span');
    ring.className = 'data-ring';
    const dot = document.createElement('span');
    dot.className = 'data-ring-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = String(i + 1);
    const label = document.createElement('span');
    label.textContent = name;
    ring.append(dot, label);
    ringsEl.appendChild(ring);
    return ring;
  });

  const status = document.createElement('p');
  status.className = 'data-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = STEP_STATUS[0];

  /* ----- stage bar: the two gated buttons ----- */
  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'btn btn-primary';
  nextButton.textContent = 'Next filter';
  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'btn btn-ghost';
  resetButton.textContent = 'Start over';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = 'Three filters stand between the web and the model.';
  bar.append(nextButton, resetButton, hint);

  stage.append(head, canvasWrap, ringsEl, status, bar);

  /* ----- side panel: counters + reading mix (next to the stage) ----- */
  const side = document.createElement('aside');
  side.className = 'data-side';

  const sideTitle = document.createElement('h2');
  sideTitle.className = 'data-side-title';
  sideTitle.textContent = 'From raw to ready';

  const countersEl = document.createElement('div');
  countersEl.className = 'data-counters';
  const counterEls: HTMLElement[] = COUNTERS.map(({ value, label }) => {
    const metric = document.createElement('div');
    metric.className = 'metric data-counter';
    const valueEl = document.createElement('span');
    valueEl.className = 'metric-value';
    valueEl.textContent = fmt.format(value);
    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.textContent = label;
    metric.append(valueEl, labelEl);
    countersEl.appendChild(metric);
    return metric;
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

    const track = document.createElement('span');
    track.className = 'data-mix-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'data-mix-fill';
    track.appendChild(fill);

    const pct = document.createElement('span');
    pct.className = 'data-mix-pct';

    row.append(toggle, name, track, pct);
    mix.appendChild(row);
    pctEls.push(pct);
    fillEls.push(fill);
    rowEls.push(row);
    toggleEls.push(toggle);
  }

  side.append(sideTitle, countersEl, mix);

  /* ----- layout: stage + side panel ----- */
  const grid = document.createElement('div');
  grid.className = 'data-grid';
  grid.append(stage, side);
  root.appendChild(grid);

  /* ----- 3D scene (canvas is an enhancement; DOM holds the state) -----
     `handle`/`refs` are rebuilt wholesale if the GL context is lost
     (see wireLost) — everything below reads them through the closure. */
  const stageOpts: Stage3DOptions = {
    seed: 20260301,
    camera: { position: [0, 0.2, 11.5], fov: 42 },
  };
  let handle: Stage3DHandle = createStage3D(canvasWrap, stageOpts);
  let refs: SceneRefs | null = handle.fallback ? null : buildScene(handle);

  /* ----- 2D blit of the GL frame -----
     The helper's renderer uses preserveDrawingBuffer: false, so the GL
     drawing buffer is cleared by the compositor right after each frame.
     A screenshot taken after the interaction would capture a blank
     canvas — so every frame() is followed, in the same task, by a copy
     of the frame into a regular 2D canvas which keeps its content.
     The blit canvas is independent of the GL canvas, so it also acts as
     a barrier: a context loss can never corrupt an already-blitted
     frame. */
  const blit = handle.fallback
    ? null
    : (() => {
        const canvas = document.createElement('canvas');
        canvas.className = 'data-blit';
        canvas.setAttribute('aria-hidden', 'true');
        canvasWrap.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        return ctx ? { canvas, ctx } : null;
      })();

  const render = () => {
    handle.frame();
    if (!handle.fallback && blit) {
      const gl = handle.renderer?.domElement;
      if (!gl) return;
      if (blit.canvas.width !== gl.width || blit.canvas.height !== gl.height) {
        blit.canvas.width = gl.width;
        blit.canvas.height = gl.height;
      }
      blit.ctx.drawImage(gl, 0, 0);
    }
  };

  /* ----- GL-context resilience -----
     Under headless SwiftShader the browser evicts WebGL contexts
     (memory pressure). three re-initialises on restore, but re-renders
     after a loss/restore cycle go stale in this environment — so the
     whole stage is torn down and rebuilt instead. Every pixel is
     seed-derived, so the rebuild is pixel-identical; the current DOM
     state (step + topic mix) is re-applied before re-rendering. */
  let unmounted = false; // set by cleanup; a late loss event must not rebuild
  const wireLost = (h: Stage3DHandle) => {
    h.renderer?.domElement.addEventListener('webglcontextlost', (event) => {
      if (unmounted) return; // the stage is already torn down
      event.preventDefault(); // the old context is being discarded
      handle.dispose();
      handle = createStage3D(canvasWrap, stageOpts);
      refs = handle.fallback ? null : buildScene(handle);
      refs?.setRiver(activeTopics);
      refs?.setRings(step);
      refs?.setTokens(step === STEP_STATUS.length - 1);
      render();
      wireLost(handle);
    });
  };
  wireLost(handle);

  const onBlitResize = () => {
    render();
  };
  window.addEventListener('resize', onBlitResize);

  /* ----- state application ----- */
  function applyStep(): void {
    counterEls.forEach((el, i) => el.classList.toggle('data-counter--active', i === step));
    // Ring r becomes active while step r+1 is current; earlier rings have passed.
    ringEls.forEach((el, i) => {
      el.classList.toggle('data-ring--active', i === step - 1);
      el.classList.toggle('data-ring--passed', i < step - 1);
    });
    status.textContent = STEP_STATUS[step];
    nextButton.disabled = step === STEP_STATUS.length - 1;
    refs?.setRings(step);
    refs?.setTokens(step === STEP_STATUS.length - 1);
    render();
  }

  function applyMix(): void {
    const activeSum = TOPICS.reduce((sum, t, i) => sum + (activeTopics[i] ? t.share : 0), 0);
    TOPICS.forEach((topic, i) => {
      const on = activeTopics[i];
      const pct = on && activeSum > 0 ? topic.share / activeSum : 0;
      pctEls[i].textContent = `${Math.round(pct * 100)}%`;
      fillEls[i].style.width = `${Number((pct * 100).toFixed(2))}%`;
      rowEls[i].classList.toggle('data-mix-row--off', !on);
    });
    refs?.setRiver(activeTopics);
    render();
  }

  nextButton.addEventListener('click', () => {
    if (step < STEP_STATUS.length - 1) {
      step += 1;
      applyStep();
    }
  });
  resetButton.addEventListener('click', () => {
    step = 0;
    applyStep();
  });
  toggleEls.forEach((toggle, i) => {
    toggle.addEventListener('click', () => {
      activeTopics[i] = !activeTopics[i];
      toggle.setAttribute('aria-checked', String(activeTopics[i]));
      applyMix();
    });
  });

  applyStep();
  applyMix();

  return () => {
    unmounted = true;
    window.removeEventListener('resize', onBlitResize);
    handle.dispose();
    grid.remove();
  };
}

/* ------------------------------ 3D scene -------------------------------- */

interface SceneRefs {
  setRiver(on: boolean[]): void;
  setRings(step: number): void;
  setTokens(lit: boolean): void;
}

function buildScene(handle: Stage3DHandle): SceneRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const topicColors = TOPICS.map((t) => new THREE.Color(t.color));
  const colorRiverOff = new THREE.Color('#2b3552');
  const colorRingWaiting = new THREE.Color('#33405f');
  const colorRingActive = new THREE.Color('#ffb020');
  const colorRingPassed = new THREE.Color('#22c48e');
  const colorTokenDim = new THREE.Color('#10182b');
  const colorStage = new THREE.Color(STAGE_BG);
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

  function makePoints(positions: Float32Array, colors: Float32Array | null, size: number): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial(
      colors ? { size, vertexColors: true } : { size },
    );
    if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geo, mat);
  }

  /* ----- river of pages: even flow along the curve, seeded radial scatter ----- */
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
  const river = makePoints(riverPos, riverCol, 0.062);
  scene.add(river);
  const riverColors = river.geometry.getAttribute('color') as THREE.BufferAttribute;

  /* ----- three filter rings, each with a softer halo ring around it -----
     All gates share ONE fixed normal (not the curve tangent): the tangent
     basis twists along the curve and the last ring would end up nearly
     edge-on. A shared normal keeps three parallel, evenly open ellipses. */
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
      const points = makePoints(positions, null, m === 0 ? 0.1 : 0.17);
      const mat = points.material as THREE.PointsMaterial;
      mat.color.copy(m === 0 ? colorRingWaiting : colorRingWaiting.clone().lerp(colorStage, 0.6));
      (m === 0 ? ringMats : haloMats).push(mat);
      scene.add(points);
    }
  }

  /* ----- token chips below the tube exit (materialise at the final step) ----- */
  const tokenPos = new Float32Array(TOKEN_COUNT * 3);
  for (let i = 0; i < TOKEN_COUNT; i++) {
    tokenPos[i * 3] = 3.35 + (rand() - 0.5) * 2.4;
    tokenPos[i * 3 + 1] = -3.8 + (rand() - 0.5) * 0.55;
    tokenPos[i * 3 + 2] = 0.15 + (rand() - 0.5) * 0.9;
  }
  const tokens = makePoints(tokenPos, new Float32Array(TOKEN_COUNT * 3), 0.08);
  scene.add(tokens);
  const tokenColors = tokens.geometry.getAttribute('color') as THREE.BufferAttribute;

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
    setRings(step) {
      for (let r = 0; r < RING_T.length; r++) {
        // Mirrors the DOM ring labels: ring r is active at step r+1.
        const c =
          r === step - 1 ? colorRingActive : r < step - 1 ? colorRingPassed : colorRingWaiting;
        ringMats[r].color.copy(c);
        haloTmp.copy(c).lerp(colorStage, 0.6);
        haloMats[r].color.copy(haloTmp);
      }
    },
    setTokens(lit) {
      for (let i = 0; i < TOKEN_COUNT; i++) {
        const c = lit ? tokenLit[i % 3] : colorTokenDim;
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
    body: "You just ran the model's first lesson. Ten million pages pour in; three filters keep the 1.1 million worth reading — then those pages are cut into 8.8 million tokens.",
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
