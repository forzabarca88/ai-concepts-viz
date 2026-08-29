/**
 * Preference fine-tuning visualisations — DOM/CSS only (no canvas, per
 * the Task 8 spec), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - the stage shows the prompt "How do I make scrambled eggs?" over two
 *    fixed answer cards — A (helpful, detailed) and B (dodgy) — each with
 *    a "This one!" vote;
 *  - a reward meter (a 50/50 split bar) shifts 50 → 80 toward the chosen
 *    side when a vote lands (80/20 for A, 20/80 for B);
 *  - a "New model answer" panel below the meter upgrades through two
 *    fixed improvement levels, one level per "Train on that" press;
 *  - "Reset vote" clears the ring, returns the meter to 50/50 and puts
 *    the model back on the untrained draft;
 *  - all data lists are fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

type Vote = 'none' | 'A' | 'B';

/** The fixed prompt shown over both answer cards. */
const PROMPT = 'How do I make scrambled eggs?';

/** The two fixed answers — never generated, never random. */
const ANSWERS: Record<'A' | 'B', { label: string; text: string }> = {
  A: {
    label: 'Answer A',
    text: "Fluffy scrambled eggs in five minutes:\n1. Whisk three eggs with a splash of milk and a pinch of salt.\n2. Melt a knob of butter in a non-stick pan over medium heat.\n3. Pour the eggs in and stir slowly — don't rush.\n4. Take them off the heat while still a little soft. They finish on the plate.",
  },
  B: {
    label: 'Answer B',
    text: "Eggs are bad for you, don't.",
  },
};

/** The meter shows the share of the model's trust in answer A. */
const A_SHARE: Record<Vote, number> = { none: 50, A: 80, B: 20 };

/** Fixed improvement levels for the new-model answer (level 0 = draft). */
const LEVELS = [
  {
    chip: 'no notes yet',
    text: "I can write about scrambled eggs, but I don't know which answer was better. Point at one and I'll take notes.",
  },
  {
    chip: 'level 1',
    text: 'Improved draft: crack three eggs into a bowl, add a pinch of salt and a splash of milk, and whisk. Melt butter in a warm pan, pour the eggs in, and stir until they are set.',
  },
  {
    chip: 'level 2',
    text: 'Best draft yet: fluffy scrambled eggs in five minutes. Whisk three eggs with a splash of milk and a pinch of salt. Melt a knob of butter over medium heat, pour the eggs in and stir slowly, then take them off the heat while still a little soft — they finish on the plate.',
  },
] as const;

const HINT_VOTE = 'Vote for an answer first — that click is the training signal.';
const HINT_TRAIN = 'Each press trains one step toward the answer you picked.';
const HINT_DONE = 'Two steps trained — the draft is as good as it gets here.';

/* ============================================================
   The stage: prompt, answer cards, reward meter, new-model
   panel and the train/reset bar. One mount because the vote,
   the meter and the training levels share state.
   ============================================================ */

export function mountPrefViz(root: HTMLElement): () => void {
  let vote: Vote = 'none';
  let level = 0; // 0 draft → 1 → 2 (cap)

  const stage = document.createElement('section');
  stage.className = 'stage pref-stage';
  stage.setAttribute('aria-label', 'Preference fine-tuning demo');

  /* ---------- head ---------- */

  const head = document.createElement('header');
  head.className = 'pref-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Pick the better answer';
  const sub = document.createElement('p');
  sub.className = 'pref-sub';
  sub.textContent =
    'Both models got the same question. Vote for the one you would rather read — that single click is the whole training signal.';
  head.append(h2, sub);

  /* ---------- the prompt ---------- */

  const prompt = document.createElement('p');
  prompt.className = 'pref-prompt';
  prompt.textContent = PROMPT;

  /* ---------- the two answer cards ---------- */

  const cards = document.createElement('div');
  cards.className = 'pref-cards';
  cards.setAttribute('role', 'group');
  cards.setAttribute('aria-label', 'Two answers to the same question');

  const makeCard = (key: 'A' | 'B') => {
    const article = document.createElement('article');
    article.className = `pref-card pref-card--${key.toLowerCase()}`;
    const label = document.createElement('p');
    label.className = 'pref-card-label';
    label.textContent = ANSWERS[key].label;
    const answer = document.createElement('p');
    answer.className = 'pref-answer';
    answer.textContent = ANSWERS[key].text;
    const foot = document.createElement('div');
    foot.className = 'pref-card-foot';
    const voteBtn = document.createElement('button');
    voteBtn.type = 'button';
    voteBtn.className = 'btn btn-ghost btn-small pref-vote';
    voteBtn.textContent = 'This one!';
    voteBtn.setAttribute('aria-pressed', 'false');
    voteBtn.addEventListener('click', () => {
      vote = key;
      render();
    });
    foot.appendChild(voteBtn);
    article.append(label, answer, foot);
    cards.appendChild(article);
    return voteBtn;
  };

  const voteA = makeCard('A');
  const voteB = makeCard('B');
  const cardA = cards.querySelector<HTMLElement>('.pref-card--a');
  const cardB = cards.querySelector<HTMLElement>('.pref-card--b');

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
  meterNote.textContent = "which answer is winning the model's trust";
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
  track.setAttribute('aria-label', 'Reward meter — share of trust for answer A');
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

  /* ---------- the new-model answer panel ---------- */

  const trained = document.createElement('div');
  trained.className = 'pref-trained';
  const trainedTop = document.createElement('div');
  trainedTop.className = 'pref-trained-top';
  const trainedLabel = document.createElement('p');
  trainedLabel.className = 'pref-trained-label';
  trainedLabel.textContent = 'New model answer';
  const levelChip = document.createElement('span');
  levelChip.className = 'chip pref-level';
  const trainedText = document.createElement('p');
  trainedText.className = 'pref-trained-text';
  trainedTop.append(trainedLabel, levelChip);
  trained.append(trainedTop, trainedText);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const trainBtn = document.createElement('button');
  trainBtn.type = 'button';
  trainBtn.className = 'btn btn-primary pref-train';
  trainBtn.textContent = 'Train on that';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-ghost pref-reset';
  resetBtn.textContent = 'Reset vote';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(trainBtn, resetBtn, hint);

  trainBtn.addEventListener('click', () => {
    if (vote === 'none' || level >= LEVELS.length - 1) return;
    level += 1;
    render();
  });
  resetBtn.addEventListener('click', () => {
    if (vote === 'none') return;
    vote = 'none';
    level = 0;
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const share = A_SHARE[vote];
    const lvl = LEVELS[level];

    voteA.setAttribute('aria-pressed', String(vote === 'A'));
    voteB.setAttribute('aria-pressed', String(vote === 'B'));
    cardA?.classList.toggle('pref-card--chosen', vote === 'A');
    cardB?.classList.toggle('pref-card--chosen', vote === 'B');

    valueA.textContent = String(share);
    valueB.textContent = String(100 - share);
    fillA.style.width = `${share}%`;
    fillB.style.width = `${100 - share}%`;
    track.setAttribute('aria-valuenow', String(share));

    levelChip.textContent = lvl.chip;
    trainedText.textContent = lvl.text;
    trained.classList.toggle('pref-trained--done', level === LEVELS.length - 1);

    trainBtn.disabled = vote === 'none' || level === LEVELS.length - 1;
    resetBtn.disabled = vote === 'none';
    hint.textContent =
      level === LEVELS.length - 1 ? HINT_DONE : vote === 'none' ? HINT_VOTE : HINT_TRAIN;
  };

  render();

  stage.append(head, prompt, cards, meter, trained, bar);
  root.appendChild(stage);
  return () => stage.remove();
}

/* ============================================================
   Explain cards (the shared three-card grid)
   ============================================================ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '§',
    title: "What's happening",
    body: 'You are doing the job of a reward model. One click of "This one!" says which of two answers is better, and a handful of those chosen-versus-rejected comparisons nudge the model toward the winner.',
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
