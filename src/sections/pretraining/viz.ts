/**
 * Pre-training visualisations — the "training gym" (Task 6, DOM/CSS
 * only, no canvas), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - a log token counter (1M → 1B → 100B → 15T — the real Llama 3.1
 *    pre-training figure) with a 4-stop log slider;
 *  - "Teach a batch": +100 tokens per press (capped at 15T); each press
 *    appends the next example from a fixed 8-sentence "guess the next
 *    word" cycle;
 *  - four skill badges (Counting / Rhyming / Coding / Following rules)
 *    that unlock at fixed token thresholds;
 *  - a "See the raw model" toggle revealing the base model's
 *    next-word-reflex chat.
 *
 * All data lists are fixed and hardcoded (deterministic-everything);
 * each mount() returns a cleanup that removes its subtree.
 */

const MAX_TOKENS = 15_000_000_000_000; // the real Llama 3.1 figure: 15T
const BATCH_TOKENS = 100;

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

interface Badge {
  label: string;
  /** Token count at which the skill unlocks. */
  at: number;
}

const BADGES: readonly Badge[] = [
  { label: 'Counting', at: 200 },
  { label: 'Rhyming', at: 300 },
  { label: 'Coding', at: 1_000_000_000 },
  { label: 'Following rules', at: 15_000_000_000_000 },
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

/* ============================================================
   The training-gym stage
   ============================================================ */

export function mountPreViz(root: HTMLElement): () => void {
  let tokens = 0;
  let presses = 0;

  const stage = document.createElement('section');
  stage.className = 'stage pre-stage';
  stage.setAttribute('aria-label', 'Pre-training training gym');

  /* ---------- head: title + raw-model toggle ---------- */

  const head = document.createElement('header');
  head.className = 'pre-head';
  const headText = document.createElement('div');
  headText.className = 'pre-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'The training gym';
  const sub = document.createElement('p');
  sub.className = 'pre-sub';
  sub.textContent =
    'One press is one tiny lesson: read a text, guess the next word, try again. The scale slider jumps ahead on a log scale — all the way to Llama 3.1’s real 15T diet.';
  headText.append(h2, sub);

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
  const badgeEls = BADGES.map((badge) => {
    const li = document.createElement('li');
    li.className = 'pre-badge';
    li.dataset.unlocked = 'false';
    const name = document.createElement('span');
    name.className = 'pre-badge-name';
    name.textContent = badge.label;
    const at = document.createElement('span');
    at.className = 'pre-badge-at';
    at.textContent = formatTokens(badge.at);
    li.append(name, at);
    badgeList.appendChild(li);
    return li;
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

  /* ---------- base-model reveal panel ---------- */

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
    let unlocked = 0;
    badgeEls.forEach((li, i) => {
      const on = tokens >= BADGES[i].at;
      li.classList.toggle('pre-badge--on', on);
      li.dataset.unlocked = String(on);
      if (on) unlocked += 1;
    });
    skillCount.textContent = `Skills unlocked: ${unlocked} / ${BADGES.length}`;
    const done = tokens >= MAX_TOKENS;
    batchBtn.disabled = done;
    hint.textContent = done ? HINT_DONE : HINT_BUSY;
    tickEls.forEach((tick, i) =>
      tick.classList.toggle('pre-scale-tick--active', tokens === SLIDER_STOPS[i].tokens),
    );
    slider.style.setProperty('--pre-fill', `${(Number(slider.value) / 3) * 100}%`);
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

  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(on));
    raw.hidden = !on;
  });

  /* ---------- initial paint ---------- */

  for (const ex of EXAMPLES.slice(0, INITIAL_LINES)) {
    appendLine(ex);
  }
  render();

  stage.append(head, gym, bar, raw);
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
