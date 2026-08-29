/**
 * Tool calling visualisation — a clean SVG flow (no canvas, no 3D, per
 * the Task 9 spec), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - the stage shows a vertical flow: user bubble → model bubble →
 *    tool card (a distinct hexagon, hidden until tools are on) →
 *    answer bubble, with a four-beat gutter beside it
 *    (Think / Call tool / Read result / Answer);
 *  - a real `role="switch"` "Tools: on/off" control — off, the model
 *    answers "I can't check that — I can't see the world!"; on, the
 *    tool card appears with a fixed call and result;
 *  - "Step through the call" walks four captions in a fixed order,
 *    highlighting the matching node; it is disabled at the end (and
 *    while tools are off);
 *  - a 3-option question picker (Weather in Tokyo / Time in Sydney /
 *    13 × 7) that updates every value in the flow;
 *  - all data lists are fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

/* ---------- fixed data (never generated, never random) ---------- */

type StepName = 'Think' | 'Call tool' | 'Read result' | 'Answer';

/** The four beats of a tool call, in fixed order. */
const STEP_NAMES: readonly StepName[] = ['Think', 'Call tool', 'Read result', 'Answer'];

interface ToolQuestion {
  /** Picker button text. */
  pick: string;
  /** The user's question, shown in the user bubble. */
  userLine: string;
  /** The fixed tool call, shown in the tool card (mono). */
  call: string;
  /** The fixed tool result, shown in the tool card (mono). */
  result: string;
  /** The model's answer when tools are on. */
  answerLine: string;
  /** The four step captions, in fixed order. */
  captions: readonly [string, string, string, string];
}

const QUESTIONS: readonly ToolQuestion[] = [
  {
    pick: 'Weather in Tokyo',
    userLine: "What's the weather in Tokyo?",
    call: 'get_weather("Tokyo")',
    result: '21°C, sunny',
    answerLine: "It's 21°C and sunny in Tokyo.",
    captions: [
      "Think — it works out what it needs: today's weather in Tokyo.",
      'Call tool — it writes get_weather("Tokyo") for the weather service.',
      'Read result — the service replies 21°C, sunny. The model reads it.',
      'Answer — it tells you: "It\'s 21°C and sunny in Tokyo."',
    ],
  },
  {
    pick: 'Time in Sydney',
    userLine: 'What time is it in Sydney?',
    call: 'get_time("Sydney")',
    result: '3:40 pm',
    answerLine: "It's 3:40 pm in Sydney.",
    captions: [
      'Think — it works out what it needs: the current time in Sydney.',
      'Call tool — it writes get_time("Sydney") for the clock service.',
      'Read result — the clock replies 3:40 pm. The model reads it.',
      'Answer — it tells you: "It\'s 3:40 pm in Sydney."',
    ],
  },
  {
    pick: '13 × 7',
    userLine: 'What is 13 × 7?',
    call: 'calculator(13 × 7)',
    result: '91',
    answerLine: '13 × 7 is 91.',
    captions: [
      'Think — it works out what it needs: the product of 13 and 7.',
      'Call tool — it writes calculator(13 × 7) for the calculator.',
      'Read result — the calculator replies 91. The model reads it.',
      'Answer — it tells you: "13 × 7 is 91."',
    ],
  },
];

/** The model's answer when tools are off — same for every question. */
const ANSWER_OFF = "I can't check that — I can't see the world!";

/** The model bubble's two lines (line 2 depends on the tools state). */
const MODEL_LINE_1 = 'This needs a fact from the world —';
const MODEL_LINE_2_ON = "so I'll ask a tool.";
const MODEL_LINE_2_OFF = 'and I have no way to check.';

const CAPTION_OFF = 'Tools off: the flow is just you → model → answer.';
const CAPTION_READY = 'Four beats: Think → Call tool → Read result → Answer.';

const HINT_OFF = 'Tools are off — the model answers with its own words only.';
const HINT_READY = 'The call has four beats — press to walk them.';
const HINT_DONE = 'End of the call — four beats, done.';

/* ---------- SVG flow builder (fixed geometry, no measurement) ---------- */

type NodeKind = 'user' | 'model' | 'tool' | 'answer';

interface NodeGeom {
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SVG_W = 680;
const CX = 430; // centre of the node column

/** Flat-top hexagon — the shape that marks a tool node. */
function hexPoints(x: number, y: number, w: number, h: number, c = 26): string {
  return [
    [x + c, y],
    [x + w - c, y],
    [x + w, y + h / 2],
    [x + w - c, y + h],
    [x + c, y + h],
    [x, y + h / 2],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

/** Node geometry per state (tools on = the tool hexagon is present). */
function flowNodes(toolsOn: boolean): NodeGeom[] {
  return [
    { kind: 'user', x: 230, y: 8, w: 400, h: 56 },
    { kind: 'model', x: 205, y: 82, w: 450, h: 72 },
    ...(toolsOn ? [{ kind: 'tool' as const, x: 195, y: 172, w: 470, h: 82 }] : []),
    { kind: 'answer', x: 230, y: toolsOn ? 272 : 172, w: 400, h: 56 },
  ];
}

/** Which node a step highlights (1-based steps). */
function activeKind(step: number): NodeKind | null {
  if (step === 1) return 'model';
  if (step === 2 || step === 3) return 'tool';
  if (step === 4) return 'answer';
  return null;
}

/** The four-beat gutter beside the flow. */
function gutterRows(toolsOn: boolean, step: number): Array<{ name: string; y: number; active: boolean; muted: boolean }> {
  return toolsOn
    ? [
        { name: '1 · Think', y: 118, active: step === 1, muted: false },
        { name: '2 · Call tool', y: 204, active: step === 2, muted: false },
        { name: '3 · Read result', y: 236, active: step === 3, muted: false },
        { name: '4 · Answer', y: 300, active: step === 4, muted: false },
      ]
    : [
        { name: '1 · Think', y: 118, active: false, muted: false },
        { name: '2 · Call tool', y: 152, active: false, muted: true },
        { name: '3 · Read result', y: 172, active: false, muted: true },
        { name: '4 · Answer', y: 200, active: false, muted: false },
      ];
}

function halo(g: NodeGeom): string {
  const shape =
    g.kind === 'tool'
      ? `<polygon class="tv-halo" points="${hexPoints(g.x - 6, g.y - 6, g.w + 12, g.h + 12, 30)}"/>`
      : `<rect class="tv-halo" x="${g.x - 6}" y="${g.y - 6}" width="${g.w + 12}" height="${g.h + 12}" rx="20"/>`;
  return shape;
}

function nodeMarkup(g: NodeGeom, q: ToolQuestion, toolsOn: boolean, step: number, isActive: boolean): string {
  const cls = `tv-node tv-node--${g.kind}${isActive ? ' is-active' : ''}`;
  const pad = g.x + 16;
  if (g.kind === 'user') {
    return (
      `<g class="${cls}">` +
      `<rect class="tv-user-bubble" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14"/>` +
      `<text class="tv-mono tv-node-label tv-user-label" x="${pad}" y="${g.y + 20}">YOU</text>` +
      `<text class="tv-user-text" x="${pad}" y="${g.y + 42}">${q.userLine}</text>` +
      `</g>`
    );
  }
  if (g.kind === 'model') {
    return (
      `<g class="${cls}">` +
      (isActive ? halo(g) : '') +
      `<rect class="tv-model-bubble" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14"/>` +
      `<text class="tv-mono tv-node-label" x="${pad}" y="${g.y + 20}">MODEL</text>` +
      `<text class="tv-model-text" x="${pad}" y="${g.y + 42}">${MODEL_LINE_1}</text>` +
      `<text class="tv-model-text" x="${pad}" y="${g.y + 60}">${toolsOn ? MODEL_LINE_2_ON : MODEL_LINE_2_OFF}</text>` +
      `</g>`
    );
  }
  if (g.kind === 'tool') {
    const resultCls = `tv-mono tv-tool-result${step === 3 ? ' tv-tool-result--active' : ''}`;
    return (
      `<g class="${cls}">` +
      (isActive ? halo(g) : '') +
      `<polygon class="tv-tool-hex" points="${hexPoints(g.x, g.y, g.w, g.h)}"/>` +
      `<text class="tv-mono tv-node-label tv-tool-label" x="${pad}" y="${g.y + 20}">TOOL</text>` +
      `<text class="tv-mono tv-tool-call" x="${pad}" y="${g.y + 46}">${q.call}</text>` +
      `<text class="${resultCls}" x="${pad}" y="${g.y + 68}">→ ${q.result}</text>` +
      `</g>`
    );
  }
  // answer
  const tone = toolsOn ? 'on' : 'off';
  const text = toolsOn ? q.answerLine : ANSWER_OFF;
  return (
    `<g class="${cls}">` +
    (isActive ? halo(g) : '') +
    `<rect class="tv-answer-bubble tv-answer-bubble--${tone}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14"/>` +
    `<text class="tv-mono tv-node-label tv-answer-label--${tone}" x="${pad}" y="${g.y + 20}">ANSWER</text>` +
    `<text class="tv-answer-text" x="${pad}" y="${g.y + 42}">${text}</text>` +
    `</g>`
  );
}

/** Build the full SVG inner markup for the current state. */
function buildFlow(q: ToolQuestion, toolsOn: boolean, step: number): { markup: string; height: number } {
  const nodes = flowNodes(toolsOn);
  const kind = activeKind(step);
  const activeIndex = kind ? nodes.findIndex((n) => n.kind === kind) : -1;
  const height = nodes[nodes.length - 1].y + nodes[nodes.length - 1].h + 8;

  const defs =
    `<defs>` +
    `<marker id="tvArrow" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto">` +
    `<path d="M0 0 L8 4 L0 8 Z" fill="rgba(159,168,188,0.6)"/>` +
    `</marker>` +
    `<marker id="tvArrowActive" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto">` +
    `<path d="M0 0 L8 4 L0 8 Z" fill="var(--amber)"/>` +
    `</marker>` +
    `</defs>`;

  const connectors = nodes
    .slice(0, -1)
    .map((n, i) => {
      const next = nodes[i + 1];
      const reached = activeIndex >= 0 && i < activeIndex;
      const cls = `tv-connector${reached ? ' tv-connector--active' : ''}`;
      return (
        `<line class="${cls}" x1="${CX}" y1="${n.y + n.h + 3}" x2="${CX}" y2="${next.y - 5}" ` +
        `marker-end="url(#${reached ? 'tvArrowActive' : 'tvArrow'})"/>`
      );
    })
    .join('');

  const gutter = gutterRows(toolsOn, step)
    .map((r) => {
      const cls = `tv-mono tv-step${r.active ? ' tv-step--active' : ''}${r.muted ? ' tv-step--muted' : ''}`;
      return `<text class="${cls}" x="12" y="${r.y}" dy="0.35em">${r.name}</text>`;
    })
    .join('');

  const nodeMarks = nodes
    .map((n) => nodeMarkup(n, q, toolsOn, step, kind !== null && n.kind === kind))
    .join('');

  return { markup: defs + connectors + gutter + nodeMarks, height };
}

/* ============================================================
   The stage: question picker, SVG flow, caption and the
   tools/step bar. One mount because everything shares state.
   ============================================================ */

export function mountToolViz(root: HTMLElement): () => void {
  let questionIndex = 0;
  let toolsOn = false;
  let step = 0; // 0 = not started, 1..4 = the four beats

  /* ---------- head: title + question picker ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage tool-stage';
  stage.setAttribute('aria-label', 'Tool calling demo');

  const head = document.createElement('header');
  head.className = 'tool-head';
  const headText = document.createElement('div');
  headText.className = 'tool-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'One question, four beats';
  const sub = document.createElement('p');
  sub.className = 'tool-sub';
  sub.textContent = "The model can't see the world — but it can ask a tool to.";
  headText.append(h2, sub);

  const pickers = document.createElement('div');
  pickers.className = 'tool-pickers';
  pickers.setAttribute('role', 'group');
  pickers.setAttribute('aria-label', 'Ask the model');
  const pickersLabel = document.createElement('p');
  pickersLabel.className = 'tool-pickers-label';
  pickersLabel.textContent = 'Ask the model';
  const pickRow = document.createElement('div');
  pickRow.className = 'tool-pick-row';
  const pickButtons: HTMLButtonElement[] = QUESTIONS.map((q, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-pick';
    btn.textContent = q.pick;
    btn.setAttribute('aria-pressed', String(i === questionIndex));
    btn.addEventListener('click', () => {
      questionIndex = i;
      step = 0;
      render();
    });
    pickRow.appendChild(btn);
    return btn;
  });
  pickers.append(pickersLabel, pickRow);
  head.append(headText, pickers);

  /* ---------- the SVG flow + caption ---------- */

  const flow = document.createElement('div');
  flow.className = 'tool-flow';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tv-svg');
  const caption = document.createElement('p');
  caption.className = 'tool-caption';
  caption.setAttribute('aria-live', 'polite');
  flow.append(svg, caption);

  /* ---------- stage bar: tools switch + step button + hint ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const switchRow = document.createElement('span');
  switchRow.className = 'tool-switch-row';
  const switchLabel = document.createElement('span');
  switchLabel.className = 'tool-switch-label';
  switchLabel.textContent = 'Tools: on/off';
  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'toggle tool-switch';
  switchBtn.setAttribute('role', 'switch');
  switchBtn.setAttribute('aria-checked', 'false');
  switchBtn.setAttribute('aria-label', 'Tools: on/off');
  switchRow.append(switchLabel, switchBtn);

  const stepBtn = document.createElement('button');
  stepBtn.type = 'button';
  stepBtn.className = 'btn btn-primary tool-step';
  stepBtn.textContent = 'Step through the call';

  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint tool-hint';
  bar.append(switchRow, stepBtn, hint);

  switchBtn.addEventListener('click', () => {
    toolsOn = !toolsOn;
    step = 0;
    render();
  });
  stepBtn.addEventListener('click', () => {
    if (!toolsOn || step >= STEP_NAMES.length) return;
    step += 1;
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const q = QUESTIONS[questionIndex];
    const { markup, height } = buildFlow(q, toolsOn, step);
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${height}`);
    svg.innerHTML = markup;

    switchBtn.setAttribute('aria-checked', String(toolsOn));
    pickButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === questionIndex)));

    caption.textContent =
      step === 0 ? (toolsOn ? CAPTION_READY : CAPTION_OFF) : q.captions[step - 1];
    stepBtn.disabled = !toolsOn || step === STEP_NAMES.length;
    hint.textContent =
      !toolsOn ? HINT_OFF : step === 0 ? HINT_READY : step === STEP_NAMES.length ? HINT_DONE : `Step ${step} of 4`;
  };

  render();

  stage.append(head, flow, bar);
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
    body: 'When the model hits a question it can\'t answer from memory, it writes a tool call — a small, structured request like get_weather("Tokyo"). The tool runs out in the real world, hands back a result, and the model folds it into its answer.',
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: "This one trick is what turns a chatbot into an agent. With tools, a model can check the time, run a calculator and search the web — instead of guessing at facts it can't see.",
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'The model never runs the tool itself. It only writes the request — like a sticky note. The program around it runs the tool and reads the reply back in.',
  },
];

export function mountToolExplain(root: HTMLElement): () => void {
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
