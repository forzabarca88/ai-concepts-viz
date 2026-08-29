/**
 * Parameters visualisation — the "knob cloud" (Task 5, 3D).
 *
 * A fixed-budget Three.js scene (2,192 THREE.Points total — no meshes,
 * lights or shadows): a seeded sphere of 2,000 "knobs" plus a two-ring
 * spotlight. Each "train step" nudges a seeded batch of 200 knobs
 * (exactly one knob in ten — ten steps move them all, in a seeded
 * order) and the knowledge meter +1. The size slider rescales the whole
 * cloud with `group.scale.setScalar()` (immediate — no tween).
 *
 * ALL state ALSO lives in the DOM (knob-count metric, knowledge meter +
 * step counter, status line, inspect tooltip) — so every control keeps
 * working in jsdom, where the canvas is replaced by `.viz-fallback`.
 *
 * Replicates the data section's two resilience patterns (read
 * src/sections/data/viz.ts): (a) every frame() blits the GL frame into a
 * persistent 2D canvas, and (b) on webglcontextlost the whole stage is
 * disposed and rebuilt with the current state re-applied.
 */
import * as THREE from 'three';
import { createStage3D } from '../../three/helpers';
import type { Stage3DHandle, Stage3DOptions } from '../../three/helpers';

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

interface InspectKnob {
  id: number;
  value: number;
  /** Cloud point index the spotlight ring is centred on. */
  point: number;
}

/** Fixed inspect order — 1st press → A, 2nd → B, …, wraps. */
const INSPECT_KNOBS: InspectKnob[] = [
  { id: 4_291_114, value: 0.42, point: 137 },
  { id: 612_084, value: 0.87, point: 1_518 },
  { id: 6_930_551, value: 0.13, point: 402 },
  { id: 1_547_302, value: 0.66, point: 1_873 },
];

const fmt = new Intl.NumberFormat('en-US');

function statusFor(step: number): string {
  if (step === 0) return 'No steps yet — every knob is still at its factory setting.';
  if (step === STEPS) {
    return `All ${fmt.format(CLOUD_COUNT)} knobs nudged — this tiny model has finished learning.`;
  }
  return `Step ${step} of ${STEPS} — ${fmt.format(step * NUDGE_PER_STEP)} of ${fmt.format(
    CLOUD_COUNT,
  )} knobs nudged so far.`;
}

/* ------------------------------ DOM mount ------------------------------- */

export function mountKnobCloud(root: HTMLElement): () => void {
  let step = 0;
  let size = 1; // 7B by default
  let inspected: number | null = null;

  /* ----- stage (dark card) ----- */
  const stage = document.createElement('section');
  stage.className = 'stage par-stage';
  stage.setAttribute('aria-label', 'Model parameters demo');

  const head = document.createElement('header');
  head.className = 'par-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Meet the knob cloud';
  const sub = document.createElement('p');
  sub.className = 'par-sub';
  sub.textContent =
    'Every dot is one number the model learns. Each step nudges one knob in ten — ten steps move them all.';
  head.append(h2, sub);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'par-canvas-wrap';

  const tip = document.createElement('div');
  tip.className = 'par-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  canvasWrap.appendChild(tip);

  const status = document.createElement('p');
  status.className = 'par-status';
  status.setAttribute('aria-live', 'polite');

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const trainButton = document.createElement('button');
  trainButton.type = 'button';
  trainButton.className = 'btn btn-primary';
  trainButton.textContent = 'Train one step';
  const inspectButton = document.createElement('button');
  inspectButton.type = 'button';
  inspectButton.className = 'btn btn-ghost';
  inspectButton.textContent = 'Inspect a knob';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = 'Ten steps move every knob exactly once.';
  bar.append(trainButton, inspectButton, hint);

  stage.append(head, canvasWrap, status, bar);

  /* ----- side panel: knob-count metric, size slider, knowledge meter ----- */
  const side = document.createElement('aside');
  side.className = 'par-side';

  const sideTitle = document.createElement('h2');
  sideTitle.className = 'par-side-title';
  sideTitle.textContent = 'Model size';

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

  side.append(sideTitle, metric, slider, ticks, meter);

  /* ----- layout: stage + side panel ----- */
  const grid = document.createElement('div');
  grid.className = 'par-grid';
  grid.append(stage, side);
  root.appendChild(grid);

  /* ----- 3D scene (canvas is an enhancement; DOM holds the state) -----
     `handle`/`refs` are rebuilt wholesale if the GL context is lost
     (see wireLost) — everything below reads them through the closure. */
  const stageOpts: Stage3DOptions = {
    seed: 20260305,
    camera: { position: [0, 0, 8.6], fov: 45 },
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
        canvas.className = 'par-blit';
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
     state (step, size, inspected knob) is re-applied before re-rendering. */
  let unmounted = false; // set by cleanup; a late loss event must not rebuild
  const wireLost = (h: Stage3DHandle) => {
    h.renderer?.domElement.addEventListener('webglcontextlost', (event) => {
      if (unmounted) return; // the stage is already torn down
      event.preventDefault(); // the old context is being discarded
      handle.dispose();
      handle = createStage3D(canvasWrap, stageOpts);
      refs = handle.fallback ? null : buildScene(handle);
      refs?.setSize(SIZES[size].scale);
      refs?.setStep(step);
      refs?.setInspect(inspected);
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
    status.textContent = statusFor(step);
    count.textContent = `${step} of ${STEPS} steps`;
    fill.style.width = `${(step / STEPS) * 100}%`;
    track.setAttribute('aria-valuenow', String(step));
    trainButton.disabled = step === STEPS;
    refs?.setStep(step);
    render();
  }

  function applySize(): void {
    metricValue.textContent = fmt.format(SIZES[size].knobs);
    slider.style.setProperty('--par-fill', `${(size / (SIZES.length - 1)) * 100}%`);
    tickEls.forEach((tick, i) => tick.classList.toggle('par-tick--active', i === size));
    refs?.setSize(SIZES[size].scale);
    render();
  }

  function applyInspect(): void {
    if (inspected === null) {
      tip.hidden = true;
      refs?.setInspect(null);
    } else {
      const knob = INSPECT_KNOBS[inspected];
      tip.textContent = `Knob #${fmt.format(knob.id)} · value ${knob.value.toFixed(2)}`;
      tip.hidden = false;
      refs?.setInspect(inspected);
    }
    render();
  }

  trainButton.addEventListener('click', () => {
    if (step < STEPS) {
      step += 1;
      applyStep();
    }
  });
  inspectButton.addEventListener('click', () => {
    inspected = inspected === null ? 0 : (inspected + 1) % INSPECT_KNOBS.length;
    applyInspect();
  });
  slider.addEventListener('input', () => {
    size = Number(slider.value);
    applySize();
  });

  applyStep();
  applySize();
  applyInspect();

  return () => {
    unmounted = true;
    window.removeEventListener('resize', onBlitResize);
    handle.dispose();
    grid.remove();
  };
}

/* ------------------------------ 3D scene -------------------------------- */

interface SceneRefs {
  setStep(step: number): void;
  setSize(scale: number): void;
  setInspect(index: number | null): void;
}

function buildScene(handle: Stage3DHandle): SceneRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const colorKnobDim = new THREE.Color('#31417c');
  const colorKnobBright = new THREE.Color('#dfe8ff');
  const colorNudged = new THREE.Color('#ffb020');
  const ringOuterColor = new THREE.Color('#ffb020');
  const ringInnerColor = new THREE.Color('#ffd98a');

  /* Everything (cloud + spotlight ring) lives in one group so the size
     slider can rescale the whole model with one setScalar(). */
  const group = new THREE.Group();
  scene.add(group);

  const dirX = new Float32Array(CLOUD_COUNT);
  const dirY = new Float32Array(CLOUD_COUNT);
  const dirZ = new Float32Array(CLOUD_COUNT);
  const basePos = new Float32Array(CLOUD_COUNT * 3);
  const baseColors = new Float32Array(CLOUD_COUNT * 3);
  const pos = new Float32Array(CLOUD_COUNT * 3);
  const cols = new Float32Array(CLOUD_COUNT * 3);
  const tmp = new THREE.Color();

  /* ----- knob cloud: seeded shell sphere — exactly five rand() calls per knob ----- */
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
    const shade = rand(); // 0.1 of the knobs ship pre-learned (amber)
    dirX[i] = dx;
    dirY[i] = dy;
    dirZ[i] = dz;
    basePos[i * 3] = dx * radius;
    basePos[i * 3 + 1] = dy * radius;
    basePos[i * 3 + 2] = dz * radius;
    if (shade < 0.1) {
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

  const cloud = makePoints(pos, cols, 0.055);
  group.add(cloud);
  const posAttr = cloud.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = cloud.geometry.getAttribute('color') as THREE.BufferAttribute;

  /* ----- spotlight ring (two concentric point-rings, camera-facing) -----
     The camera sits on the +z axis, so a ring in the xy-plane reads as a
     perfect circle on screen. */
  const RING_POINTS = 96;
  function makeRing(radius: number, size: number, color: THREE.Color): THREE.Points {
    const positions = new Float32Array(RING_POINTS * 3);
    for (let k = 0; k < RING_POINTS; k++) {
      const th = (k / RING_POINTS) * Math.PI * 2;
      positions[k * 3] = Math.cos(th) * radius;
      positions[k * 3 + 1] = Math.sin(th) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size, color }));
  }
  const ringOuter = makeRing(0.5, 0.09, ringOuterColor);
  const ringInner = makeRing(0.34, 0.06, ringInnerColor);
  const ringGroup = new THREE.Group();
  ringGroup.add(ringOuter, ringInner);
  ringGroup.visible = false;
  group.add(ringGroup);

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

  function placeRing(): void {
    if (appliedInspect === null) return;
    knobPosition(INSPECT_KNOBS[appliedInspect].point, knobPos);
    ringGroup.position.copy(knobPos);
  }

  return {
    setStep(nextStep) {
      appliedStep = nextStep;
      for (let i = 0; i < CLOUD_COUNT; i++) {
        knobPosition(i, knobPos);
        posAttr.setXYZ(i, knobPos.x, knobPos.y, knobPos.z);
        if (batch[i] < nextStep) {
          colAttr.setXYZ(i, colorNudged.r, colorNudged.g, colorNudged.b);
        } else {
          colAttr.setXYZ(i, baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
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

function makePoints(
  positions: Float32Array,
  colors: Float32Array | null,
  size: number,
): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial(colors ? { size, vertexColors: true } : { size });
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geo, mat);
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
