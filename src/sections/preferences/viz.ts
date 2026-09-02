/**
 * Preference fine-tuning visualisation (Task 9) — "label three pairs,
 * one training run".
 *
 *  - the stage shows three fixed prompt pairs stacked vertically; each
 *    pair has two answer cards (A | B), each with a "This one!" vote —
 *    the user curates a small labeling set;
 *  - a reward meter shows the A-share of the votes
 *    (`round(100 × a / v)`, `—` until the first vote);
 *  - "Train on my votes" (primary) is disabled until all three pairs
 *    are labeled; one press trains the model: the "New model answer"
 *    panel shows the final draft plus a fixed note (all-A vs. mixed);
 *  - "Start over" (ghost) resets the votes and the trained state;
 *  - behind the DOM UI sits the 3D "seesaw" layer
 *    (`.pref-canvas-wrap.stage-3d-layer`): a tilting beam on a fulcrum
 *    between two glow clouds (mint = A, coral = B). The beam's tilt
 *    and the clouds' opacities mirror the A-share of the votes
 *    (0 votes → level, 0.5/0.5). Built through the `createStageKit`
 *    resilience kit (2D blit + context-loss rebuild) with
 *    `alpha: true`, so the stage's CSS gradient shows through the
 *    transparent canvas.
 *
 * ALL state is mirrored in the DOM (vote chips, meter, panel, hint) —
 * so every control keeps working in jsdom, where the canvas is
 * replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

type Vote = null | 'A' | 'B';

interface PromptPair {
  /** The question shown over the pair's two answer cards. */
  prompt: string;
  a: string;
  b: string;
}

/** Three fixed prompt pairs — never generated, never random. */
const PAIRS: readonly PromptPair[] = [
  {
    prompt: 'How do I make scrambled eggs?',
    a: 'Fluffy scrambled eggs in five minutes:\n1. Whisk three eggs with a splash of milk and a pinch of salt.\n2. Melt a knob of butter in a non-stick pan over medium heat.\n3. Pour the eggs in and stir slowly — don\'t rush.\n4. Take them off the heat while still a little soft. They finish on the plate.',
    b: "Eggs are bad for you, don't.",
  },
  {
    prompt: 'Explain quantum physics in one sentence.',
    a: 'Tiny bits of the universe come in packets, and until you look, they behave like ripples instead of things.',
    b: 'Quantum physics is hard. Read a book.',
  },
  {
    prompt: 'Should I cancel my gym membership?',
    a: 'Maybe not cancel it — try going twice a week for a month first. If it is still a struggle, pause the membership instead of losing it.',
    b: 'No, you will quit in three weeks, I guarantee it.',
  },
];

/** The new-model answer before any training. */
const DRAFT_TEXT =
  "I can write about scrambled eggs, but I don't know which answer was better. Point at one and I'll take notes.";

/** The new-model answer after one training run. */
const FINAL_TEXT =
  'Best draft yet: fluffy scrambled eggs in five minutes. Whisk three eggs with a splash of milk and a pinch of salt. Melt a knob of butter over medium heat, pour the eggs in and stir slowly, then take them off the heat while still a little soft — they finish on the plate.';

/** Fixed training notes, selected by the vote mix. */
const NOTE_ALL_A =
  'Trained on your three votes — the new draft keeps the helpful details and drops the attitude.';
const NOTE_MIXED =
  'Trained on your three votes — one of them was B, so the model also learned to be a little more careful with big claims.';

const HINT_LABEL = 'Label all three pairs — every "This one!" is a training signal.';
const HINT_READY = 'All three labeled — train on your votes.';
const HINT_DONE = 'Trained — start over to curate a new set.';

/**
 * The A-share of the votes: 50/50 before the first vote, otherwise
 * `round(100 × a / v)` (a = A votes, v = votes cast).
 */
function shareAFor(votes: readonly Vote[]): number {
  const v = votes.filter((x) => x !== null).length;
  if (v === 0) return 50;
  const a = votes.filter((x) => x === 'A').length;
  return Math.round((100 * a) / v);
}

/* ============================================================
   The stage: three prompt pairs, reward meter, new-model
   panel and the train/reset bar. One mount because the votes,
   the meter, the panel and the seesaw share state.
   ============================================================ */

interface PairEls {
  cardA: HTMLElement;
  cardB: HTMLElement;
  chipA: HTMLElement;
  chipB: HTMLElement;
  voteA: HTMLButtonElement;
  voteB: HTMLButtonElement;
}

export function mountPrefViz(root: HTMLElement): () => void {
  let votes: Vote[] = [null, null, null];
  let trained = false;

  const stage = document.createElement('section');
  stage.className = 'stage pref-stage';
  stage.setAttribute('aria-label', 'Preference fine-tuning demo');

  /* 3D layer: the kit owns canvas + blit inside this absolute-fill
     wrapper, behind the stage UI (shared `.stage-3d-layer` utility). */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'pref-canvas-wrap stage-3d-layer';

  /* ---------- head ---------- */

  const head = document.createElement('header');
  head.className = 'pref-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Pick the better answer';
  const sub = document.createElement('p');
  sub.className = 'pref-sub';
  sub.textContent =
    'Both models got the same question, three times. Pick the answer you would rather read for every pair — those three clicks are the whole training signal.';
  head.append(h2, sub);

  /* ---------- the three stacked prompt pairs ---------- */

  const queue = document.createElement('div');
  queue.className = 'pref-queue';
  const pairEls: PairEls[] = [];

  PAIRS.forEach((pair, i) => {
    const section = document.createElement('section');
    section.className = 'pref-pair';
    section.setAttribute('aria-label', `Answer pair ${i + 1}: ${pair.prompt}`);

    const prompt = document.createElement('p');
    prompt.className = 'pref-prompt';
    prompt.textContent = pair.prompt;

    const cards = document.createElement('div');
    cards.className = 'pref-cards';
    cards.setAttribute('role', 'group');
    cards.setAttribute('aria-label', `Two answers to: ${pair.prompt}`);

    const makeCard = (key: 'A' | 'B', text: string): { vote: HTMLButtonElement; chip: HTMLElement } => {
      const article = document.createElement('article');
      article.className = `pref-card pref-card--${key.toLowerCase()}`;
      const label = document.createElement('p');
      label.className = 'pref-card-label';
      label.textContent = `Answer ${key}`;
      const answer = document.createElement('p');
      answer.className = 'pref-answer';
      answer.textContent = text;
      const foot = document.createElement('div');
      foot.className = 'pref-card-foot';
      const voteBtn = document.createElement('button');
      voteBtn.type = 'button';
      voteBtn.className = 'btn btn-ghost btn-small pref-vote';
      voteBtn.textContent = 'This one!';
      voteBtn.setAttribute('aria-pressed', 'false');
      voteBtn.addEventListener('click', () => {
        // Voting a card sets (or moves) this pair's vote to that card.
        votes[i] = key;
        render();
      });
      const chip = document.createElement('span');
      chip.className = `chip pref-voted pref-voted--${key.toLowerCase()}`;
      chip.hidden = true;
      chip.textContent = `Voted ${key}`;
      foot.append(voteBtn, chip);
      article.append(label, answer, foot);
      cards.appendChild(article);
      return { vote: voteBtn, chip };
    };

    const cardA = makeCard('A', pair.a);
    const cardB = makeCard('B', pair.b);
    section.append(prompt, cards);
    queue.appendChild(section);
    pairEls.push({
      cardA: cards.children[0] as HTMLElement,
      cardB: cards.children[1] as HTMLElement,
      chipA: cardA.chip,
      chipB: cardB.chip,
      voteA: cardA.vote,
      voteB: cardB.vote,
    });
  });

  /* ---------- reward meter ---------- */

  const meter = document.createElement('div');
  meter.className = 'pref-meter';
  const meterTop = document.createElement('div');
  meterTop.className = 'pref-meter-top';
  const meterLabel = document.createElement('p');
  meterLabel.className = 'pref-meter-label';
  meterLabel.textContent = 'Reward meter';
  const meterNote = document.createElement('p');
  meterNote.className = 'pref-meter-note';
  meterNote.textContent = 'which answer is winning the model\u2019s trust';
  meterTop.append(meterLabel, meterNote);

  const row = document.createElement('div');
  row.className = 'pref-meter-row';
  const sideA = document.createElement('span');
  sideA.className = 'pref-meter-side';
  sideA.textContent = 'A';
  const valueA = document.createElement('span');
  valueA.className = 'pref-meter-value pref-meter-value--a';
  const track = document.createElement('div');
  track.className = 'pref-meter-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Reward meter — share of votes for answer A');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fillA = document.createElement('div');
  fillA.className = 'pref-meter-fill pref-meter-fill--a';
  const fillB = document.createElement('div');
  fillB.className = 'pref-meter-fill pref-meter-fill--b';
  track.append(fillA, fillB);
  const valueB = document.createElement('span');
  valueB.className = 'pref-meter-value pref-meter-value--b';
  const sideB = document.createElement('span');
  sideB.className = 'pref-meter-side';
  sideB.textContent = 'B';
  row.append(sideA, valueA, track, valueB, sideB);
  meter.append(meterTop, row);

  /* ---------- the new-model answer panel ----------
     Sits in a fixed-height zone so the stage (and the 3D canvas
     behind it) never resizes between the draft and trained states.
     One polite live region: the clipped vote mirror (zero layout
     impact) carries the vote count, and the panel's in-place update
     carries the trained result. */
  const trainedZone = document.createElement('div');
  trainedZone.className = 'pref-trained-zone';
  trainedZone.setAttribute('aria-live', 'polite');
  const voteMirror = document.createElement('p');
  voteMirror.className = 'pref-live';
  const trainedPanel = document.createElement('div');
  trainedPanel.className = 'pref-trained';
  const trainedTop = document.createElement('div');
  trainedTop.className = 'pref-trained-top';
  const trainedLabel = document.createElement('p');
  trainedLabel.className = 'pref-trained-label';
  trainedLabel.textContent = 'New model answer';
  const levelChip = document.createElement('span');
  levelChip.className = 'chip pref-level';
  levelChip.textContent = 'no notes yet';
  trainedTop.append(trainedLabel, levelChip);
  const trainedText = document.createElement('p');
  trainedText.className = 'pref-trained-text';
  const trainedNote = document.createElement('p');
  trainedNote.className = 'pref-trained-note';
  trainedNote.hidden = true;
  trainedPanel.append(trainedTop, trainedText, trainedNote);
  trainedZone.append(voteMirror, trainedPanel);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const trainBtn = document.createElement('button');
  trainBtn.type = 'button';
  trainBtn.className = 'btn btn-primary pref-train';
  trainBtn.textContent = 'Train on my votes';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-ghost pref-reset';
  resetBtn.textContent = 'Start over';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(trainBtn, resetBtn, hint);

  trainBtn.addEventListener('click', () => {
    if (trained || votes.some((v) => v === null)) return;
    trained = true;
    render();
  });
  resetBtn.addEventListener('click', () => {
    votes = [null, null, null];
    trained = false;
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const voted = votes.filter((v) => v !== null).length;
    const share = shareAFor(votes);
    const allVoted = voted === PAIRS.length;

    pairEls.forEach((p, i) => {
      const v = votes[i];
      p.voteA.setAttribute('aria-pressed', String(v === 'A'));
      p.voteB.setAttribute('aria-pressed', String(v === 'B'));
      p.cardA.classList.toggle('pref-card--chosen', v === 'A');
      p.cardB.classList.toggle('pref-card--chosen', v === 'B');
      p.chipA.hidden = v !== 'A';
      p.chipB.hidden = v !== 'B';
    });

    if (voted === 0) {
      valueA.textContent = '—';
      valueB.textContent = '—';
    } else {
      valueA.textContent = String(share);
      valueB.textContent = String(100 - share);
    }
    fillA.style.width = `${share}%`;
    fillB.style.width = `${100 - share}%`;
    track.setAttribute('aria-valuenow', String(voted === 0 ? 0 : share));

    levelChip.textContent = trained ? 'trained' : 'no notes yet';
    trainedText.textContent = trained ? FINAL_TEXT : DRAFT_TEXT;
    trainedNote.textContent = votes.every((v) => v === 'A') ? NOTE_ALL_A : NOTE_MIXED;
    trainedNote.hidden = !trained;
    trainedPanel.classList.toggle('pref-trained--done', trained);

    const voteLine =
      voted === 0
        ? 'No votes yet — label all three pairs.'
        : `${voted} of ${PAIRS.length} pairs labeled — reward meter ${share} to A.`;
    voteMirror.textContent = trained ? `Training complete. ${voteLine}` : voteLine;

    trainBtn.disabled = !allVoted || trained;
    resetBtn.disabled = voted === 0 && !trained;
    hint.textContent = trained
      ? HINT_DONE
      : voted === 0
        ? HINT_LABEL
        : allVoted
          ? HINT_READY
          : `${PAIRS.length - voted} more ${PAIRS.length - voted === 1 ? 'pair' : 'pairs'} to label — then train on your votes.`;

    renderScene();
  };

  stage.append(canvasWrap, head, queue, meter, trainedZone, bar);
  root.appendChild(stage);

  /* ----- 3D seesaw + starfield (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     A-share onto the refs (and tolerates null refs — jsdom fallback).
     It reads the closure state at call time, which is what makes the
     post-context-loss rebuild re-apply correctly. */
  const applyScene = (refs: SeesawRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.apply(shareAFor(votes));
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260409,
      camera: { position: [0, 0.4, 9], fov: 42 },
      alpha: true,
    },
    build: (h) => buildSeesawScene(h),
    reapply: (refs) => applyScene(refs as SeesawRefs | null),
  });

  const renderScene = (): void => {
    applyScene(kit.refs as SeesawRefs | null);
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
   3D seesaw scene: tilting beam on a fulcrum, twin clouds.
   ============================================================ */

interface SeesawRefs {
  /** Tilt the beam and re-weight the clouds for the current A-share. */
  apply(shareA: number): void;
}

/* Point budget: 160 beam + 60 fulcrum + 2 × 300 clouds + 100 starfield. */
const BEAM_COUNT = 160;
const BEAM_HALF = 3.2;
const BEAM_Y = 0.5;
const BEAM_TILT_MAX = 0.21;
const FULCRUM_COUNT = 60;
const CLOUD_COUNT = 300;
const CLOUD_RADIUS = 0.8;
const LEFT_X = -2.6;
const RIGHT_X = 2.6;
const CLOUD_Y = -0.6;

function singleColor(count: number, hex: string): Float32Array {
  const color = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  return colors;
}

function buildSeesawScene(handle: Stage3DHandle): SeesawRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /* ----- beam: 160 evenly spaced points at y 0.5 (no rand — the
     spacing is a pure function of the index), inside a group whose
     z-rotation tilts the seesaw: A-heavy → the left (A) side sinks. */
  const beam = new THREE.Group();
  const beamPositions = new Float32Array(BEAM_COUNT * 3);
  for (let i = 0; i < BEAM_COUNT; i += 1) {
    beamPositions[i * 3] = -BEAM_HALF + (i / (BEAM_COUNT - 1)) * BEAM_HALF * 2;
    beamPositions[i * 3 + 1] = BEAM_Y;
    beamPositions[i * 3 + 2] = 0;
  }
  beam.add(makeGlowPoints(beamPositions, singleColor(BEAM_COUNT, '#94A0B9'), 0.11));
  scene.add(beam);

  /* ----- fulcrum: 60 points filling a small triangle below the beam
     center. rand() consumption order is frozen: for each point,
     (1) u, (2) v — the reflected uniform triangle sample. */
  const APX = 0;
  const APY = 0.42;
  const BLX = -0.75;
  const BLY = -0.95;
  const BRX = 0.75;
  const BRY = -0.95;
  const fulcrumPositions = new Float32Array(FULCRUM_COUNT * 3);
  for (let i = 0; i < FULCRUM_COUNT; i += 1) {
    let u = rand();
    const v = rand();
    if (u + v > 1) u = 1 - u;
    fulcrumPositions[i * 3] = APX + u * (BLX - APX) + v * (BRX - APX);
    fulcrumPositions[i * 3 + 1] = APY + u * (BLY - APY) + v * (BRY - APY);
    fulcrumPositions[i * 3 + 2] = 0;
  }
  scene.add(makeGlowPoints(fulcrumPositions, singleColor(FULCRUM_COUNT, '#22304F'), 0.1));

  /* ----- twin clouds: seeded spheres — 3 rand calls per point in
     order: theta, phi = acos(2r − 1), radius (cube-root for a uniform
     volume fill). Left = A (mint), right = B (coral); the opacities
     mirror the A-share (0 votes → 0.5/0.5). */
  const cloudPositions = (centerX: number): Float32Array => {
    const positions = new Float32Array(CLOUD_COUNT * 3);
    for (let i = 0; i < CLOUD_COUNT; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = CLOUD_RADIUS * Math.cbrt(rand());
      const sinPhi = Math.sin(phi);
      positions[i * 3] = centerX + r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = CLOUD_Y + r * Math.cos(phi);
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    }
    return positions;
  };
  const left = makeGlowPoints(cloudPositions(LEFT_X), singleColor(CLOUD_COUNT, '#22C48E'), 0.14, 0.5);
  scene.add(left);
  const right = makeGlowPoints(cloudPositions(RIGHT_X), singleColor(CLOUD_COUNT, '#FF6B5E'), 0.14, 0.5);
  scene.add(right);

  addStarfield(handle, 100, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  const leftMat = left.material as THREE.PointsMaterial;
  const rightMat = right.material as THREE.PointsMaterial;
  let applied = -1;
  return {
    apply(shareA) {
      if (shareA === applied) return;
      applied = shareA;
      beam.rotation.z = ((shareA - 50) / 50) * BEAM_TILT_MAX;
      leftMat.opacity = shareA / 100;
      rightMat.opacity = (100 - shareA) / 100;
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
    body: 'You are doing the job of a reward model. Every "This one!" says which of two answers is better, and a handful of those chosen-versus-rejected comparisons nudge the model toward the winners.',
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'This is the final polish after pre-training and fine-tuning: it tunes the tone, trims the rambles, and dials down toxicity and hallucination — the gap between an answer that is fluent and one you would actually trust.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'A favorite recipe for this step is DPO: the model simply learns from comparisons — which answer beat which. No reward robot needed.',
  },
];

export function mountPrefExplain(root: HTMLElement): () => void {
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
