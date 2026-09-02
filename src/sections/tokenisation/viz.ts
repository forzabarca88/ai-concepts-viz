/**
 * Tokenisation visualisations — DOM/CSS only (no canvas, per the Task 4
 * spec), so every control is jsdom-testable and screenshot-frozen:
 *
 *  - the stage shows "I love learning about AI!" as token chips built
 *    from a fixed token table (text + vocabulary id); or the tokens of a
 *    sentence the user types, via a deterministic demo tokenizer;
 *  - four panels below: token inspector, grain view, next-token mini,
 *    type-your-own-sentence;
 *  - every data list is fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

/* ---------- fixed token table ---------- */

interface Tok {
  /** Displayed chip text. Subword tokens keep their leading space. */
  text: string;
  /** Vocabulary id — the number the model actually reads. */
  id: number;
  /** Which word of the sentence this token belongs to (punctuation
      sticks to the word it follows). */
  word: number;
  emoji?: boolean;
}

const SENTENCE: Tok[] = [
  { text: 'I', id: 52, word: 0 },
  { text: ' love', id: 418, word: 1 },
  { text: ' learning', id: 1159, word: 2 },
  { text: ' about', id: 623, word: 3 },
  { text: ' AI', id: 65211, word: 4 },
  { text: '!', id: 0, word: 4 },
];

/** A rocket is one "word" the tokenizer must fight: three fragments. */
const EMOJI: Tok[] = [
  { text: '🚀', id: 17184, word: 5, emoji: true },
  { text: '🚀', id: 2207, word: 5, emoji: true },
  { text: '🚀', id: 4956, word: 5, emoji: true },
];

/* ---------- deterministic demo tokenizer for typed sentences ---------- */

/** A token produced from a user-typed sentence. `id` is null for
    punctuation — the model's vocab id there is not defined by us, so
    the inspector shows "—". */
interface TypedTok {
  text: string;
  id: number | null;
  badge: string;
}

/** Fixed demo vocabulary for typed words (case-insensitive lookup). */
const TYPE_DICT: Record<string, number> = {
  i: 52, love: 418, learning: 1159, about: 623, ai: 65211, the: 21,
  a: 10, an: 16, is: 32, are: 38, was: 41, were: 47, am: 26, be: 24,
  to: 12, of: 18, in: 14, on: 20, at: 28, it: 30, you: 56, me: 58,
  my: 62, your: 66, we: 70, they: 74, he: 78, she: 82, this: 86,
  that: 90, and: 94, or: 98, but: 104, not: 110, no: 116, yes: 122,
  good: 128, bad: 134, big: 140, small: 146, run: 152, walk: 158,
  jump: 164, happy: 170, sad: 176, cat: 182, dog: 188, sun: 194,
  moon: 200, star: 206, hello: 212, world: 218, time: 224, day: 230,
  night: 236, water: 242, fire: 248,
};

/** Word runs (maximal) or single non-word, non-whitespace characters. */
const TOKEN_RE = /[A-Za-z0-9']+|[^A-Za-z0-9'\s]/g;
const WORD_RE = /^[A-Za-z0-9']+$/;

/** djb2 — a pure function of the input (no time/randomness/network). */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return (h >>> 0) % 100000;
}

/** 3-letter chunks: while length > 3 take 3; the remainder (1–3 letters)
    is the final chunk. `xylophone → xyl, oph, one`; `abcd → abc, d`. */
function chunkWord(word: string): string[] {
  const out: string[] = [];
  let rest = word;
  while (rest.length > 3) {
    out.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

/** Tokenise a typed sentence. Pure function of the input: dictionary
    words stay whole, unfamiliar words fragment into 3-letter pieces
    (ids hashed with djb2), each punctuation/symbol char is its own
    token, whitespace is ignored. */
function tokeniseSentence(input: string): TypedTok[] {
  const out: TypedTok[] = [];
  const matches = input.trim().match(TOKEN_RE) ?? [];
  for (const m of matches) {
    if (WORD_RE.test(m)) {
      const id = TYPE_DICT[m.toLowerCase()];
      if (id !== undefined) {
        out.push({ text: m, id, badge: 'word' });
      } else {
        for (const chunk of chunkWord(m)) {
          out.push({ text: chunk, id: djb2(chunk) % 100000, badge: 'unfamiliar piece' });
        }
      }
    } else {
      out.push({ text: m, id: null, badge: 'punctuation' });
    }
  }
  return out;
}

const GRAIN_LABELS = ['Character', 'Subword', 'Word'] as const;

const GRAIN_CAPTIONS = [
  'Letters and punctuation only. It works, but the model rebuilds every word from scratch — and rare words stay rarer.',
  "The model's native grain: common words stay whole, anything unfamiliar splits into pieces it has seen before.",
  "One chip per word — comfy for us, but the model would treat 'loved' and 'love' as brand-new words.",
] as const;

const NEXT_CANDIDATES = [
  { text: 'mat', prob: 62 },
  { text: 'floor', prob: 21 },
  { text: 'moon', prob: 1 },
] as const;

/**
 * Chips for a grain stop (0 = character, 1 = subword, 2 = word).
 *  - subword:   the fixed table, as is (leading spaces included);
 *  - word:      tokens merge into words; a rocket's fragments collapse
 *               into one "word";
 *  - character: one chip per letter (letter ids are fixed offsets from
 *               the word's base token id); a rocket can't be split into
 *               letters, so its three fragments stay as-is.
 */
function chipsFor(grain: number, withEmoji: boolean): Tok[] {
  const tokens = withEmoji ? [...SENTENCE, ...EMOJI] : SENTENCE;

  if (grain === 1) {
    return tokens.map((t) => ({ ...t }));
  }

  if (grain === 2) {
    const out: Tok[] = [];
    for (const t of tokens) {
      const last = out[out.length - 1];
      if (t.emoji) {
        if (!last || !last.emoji) {
          out.push({ text: t.text, id: t.id, word: t.word, emoji: true });
        }
        continue; // remaining rocket fragments fold into that chip
      }
      const text = t.text.trim();
      if (last && last.word === t.word) {
        last.text += text; // " AI" + "!" → "AI!"
      } else {
        out.push({ text, id: t.id, word: t.word });
      }
    }
    return out;
  }

  // grain 0 — characters
  const out: Tok[] = [];
  for (const t of tokens) {
    if (t.emoji) {
      out.push({ ...t });
      continue;
    }
    const letters = t.text.trim().split('');
    letters.forEach((letter, i) => {
      out.push({
        text: letter,
        id: letters.length === 1 ? t.id : t.id + 1 + i,
        word: t.word,
      });
    });
  }
  return out;
}

/* ============================================================
   Stage (token chips) + the four panels below it.
   One mount because the chips, inspector and grain share state.
   ============================================================ */

const GRAIN_SUB_EXAMPLE = 'Same sentence, three ways to chunk it.';
const GRAIN_SUB_TYPED = 'Grain view uses the example sentence.';

export function mountTokenViz(root: HTMLElement): () => void {
  let grain = 1; // subword by default
  let withEmoji = false;
  let typed: TypedTok[] | null = null; // null → the example sentence is active

  /* ---------- stage ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage tok-stage';
  stage.setAttribute('aria-label', 'Tokenisation demo');

  const head = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = 'Break a sentence into tokens';
  const sub = document.createElement('p');
  sub.className = 'tok-sub';
  sub.textContent =
    'Each chip is one token from a fixed vocabulary. Click any chip to see the number the model reads.';
  head.append(h2, sub);

  const chipsEl = document.createElement('div');
  chipsEl.className = 'tok-chips';

  const emojiNote = document.createElement('p');
  emojiNote.className = 'tok-emoji-note';
  emojiNote.hidden = true;
  emojiNote.textContent = 'Even robots can break!';

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className = 'btn btn-ghost';
  emojiBtn.textContent = 'Add an emoji';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  hint.textContent = 'Tokens cost — watch what a rocket costs.';
  bar.append(emojiBtn, hint);

  stage.append(head, chipsEl, emojiNote, bar);

  /* ---------- panel 1 · token inspector ---------- */

  const inspCard = document.createElement('article');
  inspCard.className = 'card tok-inspector';
  const inspTitle = document.createElement('h3');
  inspTitle.className = 'tok-panel-title';
  inspTitle.textContent = 'Token inspector';
  const inspEmpty = document.createElement('p');
  inspEmpty.className = 'tok-insp-empty';
  inspEmpty.textContent = 'Click a chip — see exactly what the model reads.';
  const inspBox = document.createElement('div');
  inspBox.className = 'tok-insp';
  inspBox.hidden = true;
  const inspText = document.createElement('p');
  inspText.className = 'tok-insp-text';
  const inspId = document.createElement('p');
  inspId.className = 'tok-insp-id';
  const inspBadge = document.createElement('span');
  inspBadge.className = 'chip tok-insp-badge';
  inspBox.append(inspText, inspId, inspBadge);
  inspCard.append(inspTitle, inspEmpty, inspBox);

  /* ---------- panel 2 · grain view ---------- */

  const grainCard = document.createElement('article');
  grainCard.className = 'card tok-grain';
  const grainTitle = document.createElement('h3');
  grainTitle.className = 'tok-panel-title';
  grainTitle.textContent = 'Change the grain';
  const grainSub = document.createElement('p');
  grainSub.className = 'tok-grain-sub';
  grainSub.textContent = GRAIN_SUB_EXAMPLE;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'tok-grain-slider';
  slider.min = '0';
  slider.max = '2';
  slider.step = '1';
  slider.value = '1';
  slider.setAttribute('aria-label', 'Token grain');
  const ticks = document.createElement('div');
  ticks.className = 'tok-grain-ticks';
  const tickEls = GRAIN_LABELS.map((label) => {
    const tick = document.createElement('span');
    tick.className = 'tok-grain-tick';
    tick.textContent = label;
    ticks.appendChild(tick);
    return tick;
  });
  const caption = document.createElement('p');
  caption.className = 'tok-grain-caption';
  const count = document.createElement('p');
  count.className = 'tok-grain-count';
  grainCard.append(grainTitle, grainSub, slider, ticks, caption, count);

  /* ---------- panel 3 · next-token mini ---------- */

  const nextCard = document.createElement('article');
  nextCard.className = 'card tok-next';
  const nextTitle = document.createElement('h3');
  nextTitle.className = 'tok-panel-title';
  nextTitle.textContent = 'Now you try';
  const sentence = document.createElement('p');
  sentence.className = 'tok-next-sentence';
  const blank = document.createElement('span');
  blank.className = 'tok-next-blank';
  blank.textContent = '___';
  const cands = document.createElement('div');
  cands.className = 'tok-next-cands';
  const explain = document.createElement('p');
  explain.className = 'tok-next-explain';
  explain.hidden = true;
  explain.textContent =
    "The model never knows the cat is on anything. It just ranks what's likely next.";

  const candButtons: HTMLButtonElement[] = [];
  const choose = (picked: number) => {
    candButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === picked)));
    cands.classList.add('tok-next-cands--decided');
    blank.className = 'tok-next-chosen';
    blank.textContent = NEXT_CANDIDATES[picked].text;
    explain.hidden = false;
  };

  for (const candidate of NEXT_CANDIDATES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tok-next-cand';
    btn.setAttribute('aria-pressed', 'false');

    const top = document.createElement('span');
    top.className = 'tok-next-cand-top';
    const label = document.createElement('span');
    label.className = 'tok-next-cand-text';
    label.textContent = candidate.text;
    const prob = document.createElement('span');
    prob.className = 'tok-next-cand-prob';
    prob.textContent = `${candidate.prob}%`;
    top.append(label, prob);

    const track = document.createElement('span');
    track.className = 'tok-next-bar';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'tok-next-fill';
    fill.style.width = `${candidate.prob}%`;
    track.appendChild(fill);

    btn.append(top, track);
    const picked = candButtons.length;
    btn.addEventListener('click', () => choose(picked));
    cands.appendChild(btn);
    candButtons.push(btn);
  }
  nextCard.append(nextTitle, sentence, cands, explain);

  /* ---------- panel 4 · type your own sentence ---------- */

  const typedCard = document.createElement('article');
  typedCard.className = 'card tok-typed';
  const typedTitle = document.createElement('h3');
  typedTitle.className = 'tok-panel-title';
  typedTitle.textContent = 'Type your own sentence';
  const typedSub = document.createElement('p');
  typedSub.className = 'tok-typed-sub';
  typedSub.textContent = 'Watch your words become tokens — the same rules apply.';
  const typedInput = document.createElement('input');
  typedInput.type = 'text';
  typedInput.className = 'tok-typed-input';
  typedInput.setAttribute('aria-label', 'Your sentence');
  typedInput.placeholder = 'Type a sentence…';
  const typedActions = document.createElement('div');
  typedActions.className = 'tok-typed-actions';
  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.className = 'btn btn-primary tok-typed-go';
  goBtn.textContent = 'Tokenise it';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-ghost tok-typed-reset';
  resetBtn.textContent = 'Back to the example';
  resetBtn.disabled = true;
  typedActions.append(goBtn, resetBtn);
  const emptyNote = document.createElement('p');
  emptyNote.className = 'tok-typed-empty';
  emptyNote.hidden = true;
  emptyNote.textContent = 'Type something first.';
  typedCard.append(typedTitle, typedSub, typedInput, typedActions, emptyNote);

  /* ---------- behaviour ---------- */

  const clearSelection = () => {
    chipsEl
      .querySelectorAll<HTMLElement>('.tok-chip')
      .forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    inspEmpty.hidden = false;
    inspBox.hidden = true;
  };

  /** Disable the example-only controls (grain slider, emoji) while a
      typed sentence is on stage, and re-enable them on the way back. */
  const syncControls = () => {
    const active = typed !== null;
    slider.disabled = active;
    emojiBtn.disabled = active || withEmoji;
    grainSub.textContent = active ? GRAIN_SUB_TYPED : GRAIN_SUB_EXAMPLE;
    resetBtn.disabled = !active;
  };

  const renderChips = () => {
    chipsEl.innerHTML = '';
    const tokens: ReadonlyArray<Tok | TypedTok> = typed ?? chipsFor(grain, withEmoji);
    for (const tok of tokens) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tok-chip';
      chip.setAttribute('aria-pressed', 'false');
      const text = document.createElement('span');
      text.className = 'tok-chip-text';
      text.textContent = tok.text;
      chip.appendChild(text);
      const t = tok;
      chip.addEventListener('click', () => {
        chipsEl
          .querySelectorAll<HTMLElement>('.tok-chip')
          .forEach((other) => other.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        inspEmpty.hidden = true;
        inspBox.hidden = false;
        inspText.textContent = t.text;
        inspId.textContent = t.id === null ? '—' : `id ${t.id}`;
        inspBadge.textContent = 'badge' in t
          ? t.badge
          : t.emoji
            ? 'piece of an emoji'
            : 'piece of a word';
      });
      chipsEl.appendChild(chip);
    }
  };

  const updateGrainPanel = () => {
    tickEls.forEach((tick, i) => tick.classList.toggle('tok-grain-tick--active', i === grain));
    caption.textContent = GRAIN_CAPTIONS[grain];
    count.textContent = `${chipsEl.querySelectorAll('.tok-chip').length} chips`;
    slider.style.setProperty('--tok-fill', `${(grain / 2) * 100}%`);
  };

  const setGrain = (value: number) => {
    grain = value;
    renderChips();
    clearSelection();
    updateGrainPanel();
  };

  slider.addEventListener('input', () => setGrain(Number(slider.value)));
  emojiBtn.addEventListener('click', () => {
    if (withEmoji) return;
    withEmoji = true;
    emojiBtn.disabled = true;
    emojiNote.hidden = false;
    setGrain(grain); // regroup with the rocket in place
  });

  goBtn.addEventListener('click', () => {
    const text = typedInput.value.trim();
    if (text === '') {
      emptyNote.hidden = false;
      return;
    }
    emptyNote.hidden = true;
    typed = tokeniseSentence(text);
    syncControls();
    renderChips();
    clearSelection();
    updateGrainPanel();
  });

  resetBtn.addEventListener('click', () => {
    typed = null;
    emptyNote.hidden = true;
    syncControls();
    renderChips();
    clearSelection();
    updateGrainPanel();
  });

  /* ---------- initial paint ---------- */

  sentence.append(document.createTextNode('The cat sat on the '), blank);
  renderChips();
  updateGrainPanel();

  const panels = document.createElement('div');
  panels.className = 'tok-panels';
  panels.append(inspCard, grainCard, nextCard, typedCard);

  root.append(stage, panels);
  return () => {
    stage.remove();
    panels.remove();
  };
}

/* ============================================================
   Explain cards (the shared three-card grid)
   ============================================================ */

const EXPLAIN: Array<{ glyph: string; title: string; body: string }> = [
  {
    glyph: '§',
    title: "What's happening",
    body: "That sentence is six tokens, not five words. The model never sees the words — it sees each chip's number, a row in its vocabulary.",
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'Tokens set the price and the speed. Text the model knows well stays in big, easy chunks; text it knows poorly gets chopped into awkward pieces.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Tokenizers disagree on everything. One counts 🚀 as three tokens, another as four — and each model is fine with whatever it learned.',
  },
];

export function mountTokenExplain(root: HTMLElement): () => void {
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
