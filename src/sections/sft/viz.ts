/**
 * Supervised fine-tuning visualisations — DOM/CSS only (no canvas, per
 * the Task 7 spec), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - the stage shows two chat panels side-by-side (Base | Instruct)
 *    answering the SAME user prompt, driven by a 3-option prompt picker;
 *  - below the panels, a "training data" strip: an example-count stepper
 *    (1 → 10 → 100) and a quality bar (20% → 60% → 90%) — the note
 *    "Quality beats quantity" appears at 100;
 *  - a "Show a training pair" button reveals a fixed
 *    "Instruction: … / Response: …" card;
 *  - all data lists are fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

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

/** The coaching-course stepper: more examples, better quality. */
const EXAMPLE_STOPS = [
  { examples: 1, quality: 20 },
  { examples: 10, quality: 60 },
  { examples: 100, quality: 90 },
] as const;

/** The fixed pair revealed by "Show a training pair". */
const PAIR = {
  instruction: 'Write a haiku about autumn.',
  response: 'Red leaves let go slow\na gust takes them all away\none bare branch remains',
} as const;

const HINT_BASE = 'Each press adds more example questions and answers to the coaching course.';
const HINT_DONE = '100 quality examples — enough to turn the reflex into a habit.';

/* ============================================================
   The stage: two chat panels + the training-data strip.
   One mount because the picker, panels and strip share state.
   ============================================================ */

export function mountSftViz(root: HTMLElement): () => void {
  let promptIndex = DEFAULT_PROMPT;
  let stopIndex = 0; // 1 → 10 → 100 examples
  let pairShown = false;

  /* ---------- head: title + prompt picker ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage sft-stage';
  stage.setAttribute('aria-label', 'Supervised fine-tuning demo');

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

  /* ---------- training-data strip ---------- */

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

  strip.append(stripTop, qualityRow, qualityNote);

  /* ---------- the training-pair card ---------- */

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
  pairInstructionText.textContent = PAIR.instruction;
  pairInstruction.append(pairInstructionKey, pairInstructionText);
  const pairResponse = document.createElement('p');
  pairResponse.className = 'sft-pair-line';
  const pairResponseKey = document.createElement('span');
  pairResponseKey.className = 'sft-pair-key';
  pairResponseKey.textContent = 'Response:';
  const pairResponseText = document.createElement('span');
  pairResponseText.className = 'sft-pair-text';
  pairResponseText.textContent = PAIR.response;
  pairResponse.append(pairResponseKey, pairResponseText);
  pair.append(pairTitle, pairInstruction, pairResponse);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-primary sft-add';
  addBtn.textContent = 'Add 10 examples';
  const pairBtn = document.createElement('button');
  pairBtn.type = 'button';
  pairBtn.className = 'btn btn-ghost sft-pair-btn';
  pairBtn.textContent = 'Show a training pair';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(addBtn, pairBtn, hint);

  addBtn.addEventListener('click', () => {
    if (stopIndex >= EXAMPLE_STOPS.length - 1) return;
    stopIndex += 1;
    render();
  });
  pairBtn.addEventListener('click', () => {
    if (pairShown) return;
    pairShown = true;
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const prompt = PROMPTS[promptIndex];
    const stop = EXAMPLE_STOPS[stopIndex];

    pickButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === promptIndex)));
    basePanel.user.textContent = prompt.label;
    instructPanel.user.textContent = prompt.label;
    basePanel.model.textContent = prompt.base;
    instructPanel.model.textContent = prompt.instruct;

    stripCount.textContent =
      stop.examples === 1 ? '1 example' : `${stop.examples} examples`;
    fill.style.width = `${stop.quality}%`;
    fill.classList.toggle('sft-quality-fill--high', stopIndex === EXAMPLE_STOPS.length - 1);
    track.setAttribute('aria-valuenow', String(stop.quality));
    qualityValue.textContent = `${stop.quality}%`;
    qualityNote.hidden = stopIndex !== EXAMPLE_STOPS.length - 1;

    pair.hidden = !pairShown;
    addBtn.disabled = stopIndex === EXAMPLE_STOPS.length - 1;
    pairBtn.disabled = pairShown;
    hint.textContent = stopIndex === EXAMPLE_STOPS.length - 1 ? HINT_DONE : HINT_BASE;
  };

  render();

  stage.append(head, panels, strip, pair, bar);
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
