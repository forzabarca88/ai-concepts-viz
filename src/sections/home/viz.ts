/**
 * Home visualisations — "You vs the model" prediction duel (Task 3).
 *
 *  - the duel state machine (pick → reveal → score) is pure DOM, so every
 *    control is jsdom-testable and every state mirrors to the screen;
 *  - a 3D hero layer (three candidate orbs + argmax ring + starfield)
 *    sits behind the UI via `.stage-3d-layer`, built through the
 *    `createStageKit` resilience kit (blit + context-loss rebuild);
 *  - all data lists are fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */
import * as THREE from 'three';
import { navGroups } from '../../shell/nav';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

/* ============================================================
   1 · You-vs-the-model duel (in the .stage)
   ============================================================ */

interface Candidate {
  text: string;
  /** Top-3 probability in % — the long tail makes up the rest. */
  prob: number;
}

interface NextTokenSentence {
  /** Everything before the blank. */
  before: string;
  candidates: Candidate[];
}

/** Fixed list — walked in this exact order. */
const SENTENCES: NextTokenSentence[] = [
  {
    before: 'The best part of learning is that',
    candidates: [
      { text: 'it never ends', prob: 38 },
      { text: 'you can practice', prob: 27 },
      { text: "it's expensive", prob: 4 },
    ],
  },
  {
    before: 'Mistakes are useful because they',
    candidates: [
      { text: 'show what to try next', prob: 43 },
      { text: 'feel uncomfortable', prob: 25 },
      { text: 'never happen twice', prob: 8 },
    ],
  },
  {
    before: 'Your phone already knows your favourite',
    candidates: [
      { text: 'word', prob: 42 },
      { text: 'song', prob: 26 },
      { text: 'coffee order', prob: 8 },
    ],
  },
];

/** Fixed score-card summaries, indexed by matches (0–3). */
const SUMMARIES: string[] = [
  'Zero matches — you think in a way no model has. That is the whole story of language.',
  'One match — close. Models lean on probability; you lean on sense.',
  'Two matches — you and the model share a sense of the likely. That is why it feels natural to read.',
  "Three matches — you just predicted like a machine. Welcome to the model's mind.",
];

type Phase = 'pick' | 'reveal' | 'score';

/** The model's pick: the argmax candidate index (0 for all three fixed sentences). */
const argmaxOf = (sentence: NextTokenSentence): number =>
  sentence.candidates.reduce(
    (best, c, i, arr) => (c.prob > arr[best].prob ? i : best),
    0,
  );

export function mountNextToken(root: HTMLElement): () => void {
  let index = 0;
  let picks: number[] = [];
  let phase: Phase = 'pick';

  const matchesSoFar = (): number =>
    picks.reduce(
      (n, pick, i) => n + (pick !== undefined && pick === argmaxOf(SENTENCES[i]) ? 1 : 0),
      0,
    );

  /* ----- stage (dark card) + 3D hero layer behind the UI ----- */
  const stage = document.createElement('section');
  stage.className = 'stage nt-stage';
  stage.setAttribute('aria-label', 'Next-token prediction duel');

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'nt-canvas-wrap stage-3d-layer';

  const head = document.createElement('header');
  head.className = 'nt-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'You vs the model';
  const sub = document.createElement('p');
  sub.className = 'nt-sub';
  sub.textContent =
    'Pick the next word three times. The model already ranked every option — see if your gut matches its math.';
  head.append(h2, sub);

  const sentence = document.createElement('p');
  sentence.className = 'nt-sentence';
  const blank = document.createElement('span');
  blank.className = 'nt-blank';
  blank.textContent = '___';

  const body = document.createElement('div');
  body.className = 'nt-body';
  const cands = document.createElement('div');
  cands.className = 'nt-cands';
  const reveal = document.createElement('p');
  reveal.className = 'nt-reveal';
  reveal.setAttribute('aria-live', 'polite');
  const result = document.createElement('div');
  result.className = 'nt-result';
  result.hidden = true;
  const resultLine = document.createElement('h3');
  resultLine.className = 'nt-result-line';
  const resultSummary = document.createElement('p');
  resultSummary.className = 'nt-result-summary';
  result.append(resultLine, resultSummary);
  body.append(cands, reveal, result);

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'btn btn-primary nt-next';
  const scorePill = document.createElement('span');
  scorePill.className = 'nt-score';
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'btn btn-ghost btn-small nt-again';
  again.textContent = 'Play again';
  again.hidden = true;
  bar.append(primary, scorePill, again);

  let candButtons: HTMLButtonElement[] = [];

  /* ----- 3D hero: three candidate orbs + argmax ring + starfield -----
     Built through the kit so the blit + context-loss rebuild patterns
     are never hand-rolled here. `build` runs once per (re)created
     handle; `reapply` mirrors the current duel state onto the refs
     (and must tolerate null refs — the jsdom fallback path). */
  const applyHero = (refs: HeroRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    if (phase === 'reveal') {
      const picked = picks[index];
      refs.orbMats.forEach((mat, i) => {
        mat.opacity = i === picked ? 1 : 0.25;
      });
      refs.orbGroups.forEach((group, i) => group.scale.setScalar(i === picked ? 1.25 : 1));
      refs.ring.visible = true;
    } else {
      const dim = phase === 'pick' ? 0.45 : 0.25;
      refs.orbMats.forEach((mat) => {
        mat.opacity = dim;
      });
      refs.orbGroups.forEach((group) => group.scale.setScalar(1));
      refs.ring.visible = false;
    }
  };

  const renderHero = (): void => {
    applyHero(kit.refs as HeroRefs | null);
    kit.render();
  };

  const updateScore = (): void => {
    scorePill.textContent = `Score: ${matchesSoFar()} / ${SENTENCES.length}`;
  };

  const refreshBar = (): void => {
    primary.textContent =
      index === SENTENCES.length - 1 ? 'See your score' : 'Next sentence';
    primary.disabled = phase !== 'reveal';
    primary.hidden = phase === 'score';
    again.hidden = phase !== 'score';
  };

  const buildCands = (): void => {
    cands.innerHTML = '';
    candButtons = [];
    SENTENCES[index].candidates.forEach((candidate, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nt-cand';
      btn.setAttribute('aria-pressed', 'false');

      const top = document.createElement('span');
      top.className = 'nt-cand-top';
      const label = document.createElement('span');
      label.className = 'nt-cand-text';
      label.textContent = candidate.text;
      const prob = document.createElement('span');
      prob.className = 'nt-cand-prob';
      prob.textContent = `${candidate.prob}%`;
      top.append(label, prob);

      const track = document.createElement('span');
      track.className = 'nt-bar';
      track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.className = 'nt-fill';
      fill.style.width = `${candidate.prob}%`;
      track.appendChild(fill);

      btn.append(top, track);
      btn.addEventListener('click', () => choose(i));
      cands.appendChild(btn);
      candButtons.push(btn);
    });
  };

  /** Enter the pick phase for `index` (sentence 1 after a reset). */
  const renderSentence = (): void => {
    blank.className = 'nt-blank';
    blank.textContent = '___';
    sentence.replaceChildren(document.createTextNode(`${SENTENCES[index].before} `), blank);
    cands.classList.remove('nt-cands--decided');
    cands.hidden = false;
    reveal.hidden = false;
    reveal.textContent = '';
    reveal.classList.remove('nt-reveal--agree', 'nt-reveal--mismatch');
    buildCands();
    refreshBar();
  };

  const choose = (picked: number): void => {
    if (phase !== 'pick') return;
    picks[index] = picked;
    phase = 'reveal';

    const s = SENTENCES[index];
    const model = argmaxOf(s);
    candButtons.forEach((btn, j) => {
      btn.disabled = true;
      btn.setAttribute('aria-pressed', String(j === picked));
    });
    cands.classList.add('nt-cands--decided');
    blank.className = 'nt-chosen';
    blank.textContent = s.candidates[picked].text;
    reveal.textContent =
      picked === model
        ? `You and the model agree: "${s.candidates[picked].text}".`
        : `You said "${s.candidates[picked].text}". The model would say "${s.candidates[model].text}" (${s.candidates[model].prob}%). Both are possible — that is the game.`;
    reveal.classList.toggle('nt-reveal--agree', picked === model);
    reveal.classList.toggle('nt-reveal--mismatch', picked !== model);
    updateScore();
    refreshBar();
    renderHero();
  };

  const renderScore = (): void => {
    const m = matchesSoFar();
    cands.hidden = true;
    reveal.hidden = true;
    result.hidden = false;
    resultLine.textContent = `You matched the model ${m} out of ${SENTENCES.length} times.`;
    resultSummary.textContent = SUMMARIES[m];
    updateScore();
    refreshBar();
  };

  primary.addEventListener('click', () => {
    if (phase !== 'reveal') return;
    if (index < SENTENCES.length - 1) {
      index += 1;
      phase = 'pick';
      renderSentence();
    } else {
      phase = 'score';
      renderScore();
    }
    renderHero();
  });

  again.addEventListener('click', () => {
    index = 0;
    picks = [];
    phase = 'pick';
    result.hidden = true;
    renderSentence();
    updateScore();
    renderHero();
  });

  stage.append(canvasWrap, head, sentence, body, bar);

  // The stage is in the document before the kit is created, so the
  // wrapper already has its final laid-out size (clientWidth/Height)
  // when the renderer buffer is sized — the hero orbs/ring render at
  // the stage's real aspect instead of the 960×540 detached fallback.
  root.appendChild(stage);

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260207,
      camera: { position: [0, 0, 9], fov: 40 },
      alpha: true,
    },
    build: (h) => buildHeroScene(h),
    reapply: (refs) => applyHero(refs as HeroRefs | null),
  });

  renderSentence();
  updateScore();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ------------------------------ 3D hero scene ---------------------------- */

interface HeroRefs {
  orbGroups: THREE.Group[];
  orbMats: THREE.PointsMaterial[];
  ring: THREE.Points;
}

/* Point budget: 3×90 orbs + 60 ring + 250 starfield = 590 (≤ ~1,500 + 300). */
const ORB_COUNT = 90;
const ORB_RADIUS = 0.55;
const RING_COUNT = 60;
const RING_RADIUS = 0.95;
const ORB_XS = [-3, 0, 3] as const;
const ORB_COLORS = ['#6e85ff', '#ffb020', '#94a0b9'] as const;

function buildHeroScene(handle: Stage3DHandle): HeroRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  const orbGroups: THREE.Group[] = [];
  const orbMats: THREE.PointsMaterial[] = [];
  for (let i = 0; i < ORB_XS.length; i++) {
    // Small seeded jitter around y = 0 keeps the trio from feeling placed on a ruler.
    const y = (rand() - 0.5) * 0.3;
    const positions = new Float32Array(ORB_COUNT * 3);
    const colors = new Float32Array(ORB_COUNT * 3);
    const color = new THREE.Color(ORB_COLORS[i]);
    for (let p = 0; p < ORB_COUNT; p++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = ORB_RADIUS * Math.cbrt(rand());
      const sinPhi = Math.sin(phi);
      positions[p * 3] = r * sinPhi * Math.cos(theta);
      positions[p * 3 + 1] = r * Math.cos(phi);
      positions[p * 3 + 2] = r * sinPhi * Math.sin(theta);
      colors[p * 3] = color.r;
      colors[p * 3 + 1] = color.g;
      colors[p * 3 + 2] = color.b;
    }
    const orb = makeGlowPoints(positions, colors, 0.18);
    const group = new THREE.Group();
    group.position.set(ORB_XS[i], y, 0);
    group.add(orb);
    scene.add(group);
    orbGroups.push(group);
    orbMats.push(orb.material as THREE.PointsMaterial);
  }

  /* Amber 60-point ring around the argmax orb (index 0), in the
     camera-facing xy-plane. A seeded phase keeps it deterministic
     while breaking the "perfectly drawn circle" look. */
  const ringPhase = rand() * Math.PI * 2;
  const ringPositions = new Float32Array(RING_COUNT * 3);
  const ringColors = new Float32Array(RING_COUNT * 3);
  const amber = new THREE.Color('#ffb020');
  for (let k = 0; k < RING_COUNT; k++) {
    const angle = ringPhase + (k / RING_COUNT) * Math.PI * 2;
    ringPositions[k * 3] = Math.cos(angle) * RING_RADIUS;
    ringPositions[k * 3 + 1] = Math.sin(angle) * RING_RADIUS;
    ringColors[k * 3] = amber.r;
    ringColors[k * 3 + 1] = amber.g;
    ringColors[k * 3 + 2] = amber.b;
  }
  const ring = makeGlowPoints(ringPositions, ringColors, 0.1);
  ring.position.set(ORB_XS[0], orbGroups[0].position.y, 0);
  scene.add(ring);

  addStarfield(handle, 250, 9, '#22304f');

  return { orbGroups, orbMats, ring };
}

/* ============================================================
   2 · Overview map — ten cards in three labelled groups
   ============================================================ */

/** One-line teasers — each section's own headline, in curriculum order. */
const TEASERS: Record<string, string> = {
  data: 'How much reading does it take?',
  tokenisation: 'Words aren’t words — they’re tokens',
  parameters: 'Billions of tiny knobs',
  pretraining: 'Guess the next word. A trillion times.',
  sft: 'From word-guessing to helping',
  preferences: 'Showing it which answer is better',
  'tool-calling': 'Teaching it to use a calculator',
  skills: 'Teaching it a job',
  mcp: 'The USB-C of AI',
  agent: 'Think. Act. Observe. Repeat.',
};

export function mountOverviewMap(root: HTMLElement): () => void {
  const section = document.createElement('section');
  section.className = 'map';

  const head = document.createElement('header');
  head.className = 'map-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Where to next?';
  const sub = document.createElement('p');
  sub.className = 'map-sub';
  sub.textContent =
    'Ten stops in three acts — each one is a single idea you can touch, poke and break.';
  head.append(h2, sub);

  const groups = document.createElement('div');
  groups.className = 'map-groups';
  for (const group of navGroups) {
    const g = document.createElement('div');
    g.className = 'map-group';
    const label = document.createElement('h3');
    label.textContent = group.label;
    const cards = document.createElement('div');
    cards.className = 'map-cards';
    for (const item of group.items) {
      const card = document.createElement('a');
      card.className = 'map-card';
      card.href = `#/${item.route}`;
      const num = document.createElement('span');
      num.className = 'map-num';
      num.textContent = item.number;
      const title = document.createElement('span');
      title.className = 'map-title';
      title.textContent = item.title;
      const teaser = document.createElement('span');
      teaser.className = 'map-teaser';
      teaser.textContent = TEASERS[item.route] ?? '';
      card.append(num, title, teaser);
      cards.appendChild(card);
    }
    g.append(label, cards);
    groups.appendChild(g);
  }

  section.append(head, groups);
  root.appendChild(section);
  return () => section.remove();
}

/* ============================================================
   3 · Explain cards (the shared three-card grid)
   ============================================================ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '⚄',
    title: "What's happening",
    body: "You just played the model's entire job: it read the sentence, ranked the likely next words and bet on the most likely one. That's all a language model ever does.",
  },
  {
    glyph: '∞',
    title: 'Why it matters',
    body: 'Every other page on this site is this one game with new rules — more data, more practice, more judgment. Master the guess and the rest follows.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: '“Delicious” is a model’s nightmare word. No clues, no logic — just vibes, learned from reading everything ever written.',
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
