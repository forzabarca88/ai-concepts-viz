/**
 * Home visualisations — the reference pattern for Tasks 3–12:
 *
 *  - all state lives in the DOM (no canvas), so every control is
 *    jsdom-testable and screenshot-frozen;
 *  - every data list is fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */
import { navGroups } from '../../shell/nav';

/* ============================================================
   1 · Next-token hero demo (in the .stage)
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

/** Fixed list — cycled by "New sentence" in this exact order. */
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

const EXPLAINER = "The model never knows the answer — it just ranks what's likely next.";

export function mountNextToken(root: HTMLElement): () => void {
  let index = 0;

  const stage = document.createElement('section');
  stage.className = 'stage nt-stage';
  stage.setAttribute('aria-label', 'Next-token prediction demo');

  const head = document.createElement('header');
  head.className = 'nt-head';
  const h2 = document.createElement('h2');
  h2.textContent = 'Watch it guess the next word';
  const sub = document.createElement('p');
  sub.className = 'nt-sub';
  sub.textContent = 'Pick what you think comes next — the model already has its own ranking.';
  head.append(h2, sub);

  const sentence = document.createElement('p');
  sentence.className = 'nt-sentence';
  const blank = document.createElement('span');
  blank.className = 'nt-blank';
  blank.textContent = '___';

  const cands = document.createElement('div');
  cands.className = 'nt-cands';

  const explainer = document.createElement('p');
  explainer.className = 'nt-explain';
  explainer.hidden = true;
  explainer.textContent = EXPLAINER;

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const newButton = document.createElement('button');
  newButton.type = 'button';
  newButton.className = 'btn btn-ghost btn-small nt-new';
  newButton.textContent = 'New sentence';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = "No wrong answers — that's the point.";
  bar.append(newButton, hint);

  let candButtons: HTMLButtonElement[] = [];

  const choose = (picked: number) => {
    candButtons.forEach((btn, j) => btn.setAttribute('aria-pressed', String(j === picked)));
    cands.classList.add('nt-cands--decided');
    blank.className = 'nt-chosen';
    blank.textContent = SENTENCES[index].candidates[picked].text;
    explainer.hidden = false;
  };

  const build = () => {
    cands.innerHTML = '';
    candButtons = [];
    for (const candidate of SENTENCES[index].candidates) {
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
      const picked = candButtons.length;
      btn.addEventListener('click', () => choose(picked));
      cands.appendChild(btn);
      candButtons.push(btn);
    }
  };

  newButton.addEventListener('click', () => {
    index = (index + 1) % SENTENCES.length;
    blank.className = 'nt-blank';
    blank.textContent = '___';
    sentence.replaceChildren(document.createTextNode(`${SENTENCES[index].before} `), blank);
    cands.classList.remove('nt-cands--decided');
    explainer.hidden = true;
    build();
  });

  build();
  sentence.append(document.createTextNode(`${SENTENCES[index].before} `), blank);
  stage.append(head, sentence, cands, explainer, bar);
  root.appendChild(stage);
  return () => stage.remove();
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
