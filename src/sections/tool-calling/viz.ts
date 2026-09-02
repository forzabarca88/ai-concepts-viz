/**
 * Tool calling visualisation (Task 10) — "pick the right tool (wrong
 * tools fail) + one-click run".
 *
 *  - the stage shows a vertical flow: user bubble → model bubble →
 *    tool card (a distinct hexagon, hidden until tools are on) →
 *    answer bubble, with a four-beat gutter beside it
 *    (Think / Call tool / Read result / Answer);
 *  - a real `role="switch"` "Tools: on/off" control — off, the model
 *    answers "I can't check that — I can't see the world!";
 *  - the one decision that matters: with tools on, the user picks which
 *    tool the model calls (`get_weather` / `get_time` / `calculator`).
 *    A wrong pick is shown in full — wrong call, wrong result, wrong
 *    answer tagged `Wrong tool` — and the button is retired with a
 *    `Tried — no help` tag; the model can try another tool. The
 *    correct pick runs all four beats in one click: the gutter lights
 *    up, the tool card shows the call + result and the answer bubble
 *    shows the real answer (mint tone);
 *  - behind the DOM UI sits the 3D "packet relay" layer
 *    (`.tool-canvas-wrap.stage-3d-layer`): user / model / tool node
 *    orbs with 40 message packets that travel the relay when the call
 *    runs and turn coral when a wrong tool is hit. Built through the
 *    `createStageKit` resilience kit (2D blit + context-loss rebuild)
 *    with `alpha: true`, so the stage's CSS gradient shows through the
 *    transparent canvas.
 *
 * ALL state is mirrored in the DOM (SVG flow, gutter, picker, tags,
 * hints) — so every control keeps working in jsdom, where the canvas
 * is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

/* ---------- fixed data (never generated, never random) ---------- */

/** The four beats of a tool call, in fixed order. */
const STEP_NAMES = ['Think', 'Call tool', 'Read result', 'Answer'] as const;

interface ToolQuestion {
  /** Picker button text. */
  pick: string;
  /** The user's question, shown in the user bubble. */
  userLine: string;
  /** The fixed tool call, shown in the tool card (mono). */
  call: string;
  /** The fixed tool result, shown in the tool card (mono). */
  result: string;
  /** The model's answer when the correct tool ran. */
  answerLine: string;
}

const QUESTIONS: readonly ToolQuestion[] = [
  {
    pick: 'Weather in Tokyo',
    userLine: "What's the weather in Tokyo?",
    call: 'get_weather("Tokyo")',
    result: '21°C, sunny',
    answerLine: "It's 21°C and sunny in Tokyo.",
  },
  {
    pick: 'Time in Sydney',
    userLine: 'What time is it in Sydney?',
    call: 'get_time("Sydney")',
    result: '3:40 pm',
    answerLine: "It's 3:40 pm in Sydney.",
  },
  {
    pick: '13 × 7',
    userLine: 'What is 13 × 7?',
    call: 'calculator(13 × 7)',
    result: '91',
    answerLine: '13 × 7 is 91.',
  },
];

/** The three callable tools, in fixed button order. */
const TOOL_LABELS = ['get_weather', 'get_time', 'calculator'] as const;

/** The correct tool index per question (q0 → weather, q1 → time, q2 → calculator). */
const CORRECT_TOOL: readonly number[] = [0, 1, 2];

interface WrongPick {
  /** The wrong call the model writes (mono). */
  call: string;
  /** The fixed result the wrong tool sends back (mono). */
  result: string;
  /** The fixed wrong answer the model gives (coral tone, `Wrong tool` tag). */
  answer: string;
}

/**
 * Wrong picks, indexed by question then by tool index. `null` marks the
 * tool that is correct for that question.
 */
const WRONG_PICKS: readonly (readonly (WrongPick | null)[])[] = [
  [
    null,
    { call: 'get_time("Tokyo")', result: '9:00 am', answer: 'It is 9:00 am in Tokyo.' },
    {
      call: 'calculator("Tokyo")',
      result: 'Error: not a number',
      answer: 'I got an error back. That is not a forecast.',
    },
  ],
  [
    {
      call: 'get_weather("Sydney")',
      result: '22°C, cloudy',
      answer: 'It is 22°C and cloudy in Sydney.',
    },
    null,
    {
      call: 'calculator("Sydney")',
      result: 'Error: not a number',
      answer: 'The calculator sent back an error. No time there.',
    },
  ],
  [
    {
      call: 'get_weather("7")',
      result: 'Error: unknown city',
      answer: 'I asked a weather service for a number. It was not helpful.',
    },
    {
      call: 'get_time("13 × 7")',
      result: 'Error: bad input',
      answer: 'The clock does not multiply. That was my mistake.',
    },
    null,
  ],
];

/** The model's answer when tools are off — same for every question. */
const ANSWER_OFF = "I can't check that — I can't see the world!";

/** The model bubble's two lines (line 2 depends on the tools state). */
const MODEL_LINE_1 = 'This needs a fact from the world —';
const MODEL_LINE_2_ON = "so I'll ask a tool.";
const MODEL_LINE_2_OFF = 'and I have no way to check.';

const CAPTION_OFF = 'Tools off: the flow is just you → model → answer.';
const CAPTION_READY = 'Four beats: Think → Call tool → Read result → Answer.';
const CAPTION_WRONG = 'The model picked the wrong tool — it can try again.';
const CAPTION_DONE = 'Four beats, one click: Think → Call tool → Read result → Answer.';

const HINT_OFF = 'Tools are off — the model answers with its own words only.';
const HINT_READY = 'Your move: pick the tool it should call.';
const HINT_RETRY = 'That was the wrong tool — it can try again.';
const HINT_DONE = 'Call complete — try the next question.';

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
/** Fixed for every state — the rendered height never changes. */
const SVG_H = 336;
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

type AnswerTone = 'off' | 'wrong' | 'pending' | 'on';

/** Everything the flow needs to draw, derived from the state. */
interface FlowView {
  toolsOn: boolean;
  toolCall: string;
  toolResult: string;
  /** True before any tool is picked (the card shows `?`). */
  pending: boolean;
  /** True after a wrong pick (the result line turns coral). */
  resultError: boolean;
  answerTone: AnswerTone;
  answerText: string;
  /** The four gutter beats, in order. */
  beats: readonly [boolean, boolean, boolean, boolean];
  /** The node to halo-highlight (tool after a wrong pick, answer when done). */
  highlight: 'tool' | 'answer' | null;
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

/** The four-beat gutter beside the flow. */
function gutterRows(v: FlowView): Array<{ name: string; y: number; active: boolean; muted: boolean }> {
  return v.toolsOn
    ? [
        { name: `1 · ${STEP_NAMES[0]}`, y: 118, active: v.beats[0], muted: false },
        { name: `2 · ${STEP_NAMES[1]}`, y: 204, active: v.beats[1], muted: false },
        { name: `3 · ${STEP_NAMES[2]}`, y: 236, active: v.beats[2], muted: false },
        { name: `4 · ${STEP_NAMES[3]}`, y: 300, active: v.beats[3], muted: false },
      ]
    : [
        { name: `1 · ${STEP_NAMES[0]}`, y: 118, active: false, muted: false },
        { name: `2 · ${STEP_NAMES[1]}`, y: 152, active: false, muted: true },
        { name: `3 · ${STEP_NAMES[2]}`, y: 172, active: false, muted: true },
        { name: `4 · ${STEP_NAMES[3]}`, y: 200, active: false, muted: false },
      ];
}

function halo(g: NodeGeom): string {
  const shape =
    g.kind === 'tool'
      ? `<polygon class="tv-halo" points="${hexPoints(g.x - 6, g.y - 6, g.w + 12, g.h + 12, 30)}"/>`
      : `<rect class="tv-halo" x="${g.x - 6}" y="${g.y - 6}" width="${g.w + 12}" height="${g.h + 12}" rx="20"/>`;
  return shape;
}

function nodeMarkup(g: NodeGeom, q: ToolQuestion, v: FlowView, isActive: boolean): string {
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
      `<text class="tv-model-text" x="${pad}" y="${g.y + 60}">${v.toolsOn ? MODEL_LINE_2_ON : MODEL_LINE_2_OFF}</text>` +
      `</g>`
    );
  }
  if (g.kind === 'tool') {
    const callCls = `tv-mono tv-tool-call${v.pending ? ' tv-tool-pending' : ''}`;
    const resultCls = `tv-mono tv-tool-result${v.resultError ? ' tv-tool-result--error' : ''}`;
    return (
      `<g class="${cls}">` +
      (isActive ? halo(g) : '') +
      `<polygon class="tv-tool-hex" points="${hexPoints(g.x, g.y, g.w, g.h)}"/>` +
      `<text class="tv-mono tv-node-label tv-tool-label" x="${pad}" y="${g.y + 20}">TOOL</text>` +
      `<text class="${callCls}" x="${pad}" y="${g.y + 46}">${v.toolCall}</text>` +
      `<text class="${resultCls}" x="${pad}" y="${g.y + 68}">→ ${v.toolResult}</text>` +
      `</g>`
    );
  }
  // answer
  const wrongTag =
    v.answerTone === 'wrong'
      ? `<text class="tv-mono tv-wrong-tag" x="${g.x + g.w - 14}" y="${g.y + 20}" text-anchor="end">Wrong tool</text>`
      : '';
  return (
    `<g class="${cls}">` +
    (isActive ? halo(g) : '') +
    `<rect class="tv-answer-bubble tv-answer-bubble--${v.answerTone}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14"/>` +
    `<text class="tv-mono tv-node-label tv-answer-label--${v.answerTone}" x="${pad}" y="${g.y + 20}">ANSWER</text>` +
    wrongTag +
    `<text class="tv-answer-text" x="${pad}" y="${g.y + 42}">${v.answerText}</text>` +
    `</g>`
  );
}

/** Build the full SVG inner markup for the current state. */
function buildFlow(q: ToolQuestion, v: FlowView): string {
  const nodes = flowNodes(v.toolsOn);
  // The highlighted node marks how far the call has reached: the tool
  // after a wrong pick (beats 1–3), the answer when the call is done.
  const highlightIndex = !v.toolsOn || v.highlight === null ? -1 : v.highlight === 'answer' ? 3 : 2;

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
      const reached = highlightIndex >= 0 && i < highlightIndex;
      const cls = `tv-connector${reached ? ' tv-connector--active' : ''}`;
      return (
        `<line class="${cls}" x1="${CX}" y1="${n.y + n.h + 3}" x2="${CX}" y2="${next.y - 5}" ` +
        `marker-end="url(#${reached ? 'tvArrowActive' : 'tvArrow'})"/>`
      );
    })
    .join('');

  const gutter = gutterRows(v)
    .map((r) => {
      const cls = `tv-mono tv-step${r.active ? ' tv-step--active' : ''}${r.muted ? ' tv-step--muted' : ''}`;
      return `<text class="${cls}" x="12" y="${r.y}" dy="0.35em">${r.name}</text>`;
    })
    .join('');

  const nodeMarks = nodes
    .map((n) => nodeMarkup(n, q, v, v.highlight !== null && n.kind === v.highlight))
    .join('');

  return defs + connectors + gutter + nodeMarks;
}

/* ============================================================
   The stage: question picker, SVG flow, "which tool" picker
   and the tools switch bar. One mount because everything shares
   state.
   ============================================================ */

export function mountToolViz(root: HTMLElement): () => void {
  let questionIndex = 0;
  let toolsOn = false;
  const pickedTools = new Set<number>(); // tools already tried (and failed)
  let lastWrong: number | null = null; // the wrong tool whose call is on display
  let finished = false; // the correct tool ran

  const resetRun = (): void => {
    pickedTools.clear();
    lastWrong = null;
    finished = false;
  };

  /* ---------- 3D layer wrapper (absolute-fill, behind the UI) ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage tool-stage';
  stage.setAttribute('aria-label', 'Tool calling demo');

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'tool-canvas-wrap stage-3d-layer';

  /* ---------- head: title + question picker ---------- */

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
      resetRun();
      render();
    });
    pickRow.appendChild(btn);
    return btn;
  });
  pickers.append(pickersLabel, pickRow);
  head.append(headText, pickers);

  /* ---------- the SVG flow + caption + "which tool" picker ----------
     Fixed-height children (constant viewBox, reserved caption and
     choose-zone heights) keep the stage — and the 3D canvas behind
     it — from resizing between states. */

  const flowZone = document.createElement('div');
  flowZone.className = 'tool-flow-zone';

  const flow = document.createElement('div');
  flow.className = 'tool-flow';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tv-svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  const caption = document.createElement('p');
  caption.className = 'tool-caption';
  caption.setAttribute('aria-live', 'polite');
  flow.append(svg, caption);

  const chooseZone = document.createElement('div');
  chooseZone.className = 'tool-choose-zone';
  const choose = document.createElement('div');
  choose.className = 'tool-choose';
  choose.setAttribute('role', 'group');
  choose.setAttribute('aria-label', 'Which tool does it call?');
  const chooseLabel = document.createElement('p');
  chooseLabel.className = 'tool-choose-label';
  chooseLabel.textContent = 'Which tool does it call?';
  const tryRow = document.createElement('div');
  tryRow.className = 'tool-try-row';
  const tryButtons: HTMLButtonElement[] = TOOL_LABELS.map((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-try';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', 'false');
    const tag = document.createElement('span');
    tag.className = 'tool-try-tag';
    tag.setAttribute('aria-hidden', 'true');
    tag.hidden = true;
    tag.textContent = 'Tried — no help';
    btn.appendChild(tag);
    btn.addEventListener('click', () => {
      if (!toolsOn || finished || pickedTools.has(i)) return;
      if (i === CORRECT_TOOL[questionIndex]) {
        finished = true;
        lastWrong = null;
      } else {
        pickedTools.add(i);
        lastWrong = i;
      }
      render();
    });
    tryRow.appendChild(btn);
    return btn;
  });
  choose.append(chooseLabel, tryRow);
  chooseZone.appendChild(choose);
  flowZone.append(flow, chooseZone);

  /* ---------- stage bar: tools switch + hint ---------- */

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

  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint tool-hint';
  bar.append(switchRow, hint);

  switchBtn.addEventListener('click', () => {
    toolsOn = !toolsOn;
    resetRun();
    render();
  });

  stage.append(canvasWrap, head, flowZone, bar);
  root.appendChild(stage);

  /* ---------- render: every visual state is a pure function ---------- */

  const flowView = (): FlowView => {
    const q = QUESTIONS[questionIndex];
    if (!toolsOn) {
      return {
        toolsOn: false,
        toolCall: '',
        toolResult: '',
        pending: false,
        resultError: false,
        answerTone: 'off',
        answerText: ANSWER_OFF,
        beats: [false, false, false, false],
        highlight: null,
      };
    }
    if (finished) {
      return {
        toolsOn: true,
        toolCall: q.call,
        toolResult: q.result,
        pending: false,
        resultError: false,
        answerTone: 'on',
        answerText: q.answerLine,
        beats: [true, true, true, true],
        highlight: 'answer',
      };
    }
    if (lastWrong !== null) {
      const wrong = WRONG_PICKS[questionIndex][lastWrong] as WrongPick;
      return {
        toolsOn: true,
        toolCall: wrong.call,
        toolResult: wrong.result,
        pending: false,
        resultError: true,
        answerTone: 'wrong',
        answerText: wrong.answer,
        beats: [true, true, true, false],
        highlight: 'tool',
      };
    }
    return {
      toolsOn: true,
      toolCall: '?',
      toolResult: '?',
      pending: true,
      resultError: false,
      answerTone: 'pending',
      answerText: '?',
      beats: [false, false, false, false],
      highlight: null,
    };
  };

  const captionText = (v: FlowView): string => {
    if (!v.toolsOn) return CAPTION_OFF;
    if (v.answerTone === 'on') return CAPTION_DONE;
    if (v.answerTone === 'wrong') return CAPTION_WRONG;
    return CAPTION_READY;
  };

  const hintText = (v: FlowView): string => {
    if (!v.toolsOn) return HINT_OFF;
    if (v.answerTone === 'on') return HINT_DONE;
    if (v.answerTone === 'wrong') return HINT_RETRY;
    return HINT_READY;
  };

  /* ----- 3D packet relay (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     relay state onto the refs (and tolerates null refs — jsdom
     fallback). It reads the closure state at call time, which is
     what makes the post-context-loss rebuild re-apply correctly. */

  const applyRelay = (refs: RelayRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    const state: RelayState = !toolsOn
      ? 'idle'
      : finished
        ? 'done'
        : lastWrong !== null
          ? 'wrong'
          : 'idle';
    refs.apply(state);
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260410,
      camera: { position: [0, 0.2, 9], fov: 40 },
      alpha: true,
    },
    build: (h) => buildRelayScene(h),
    reapply: (refs) => applyRelay(refs as RelayRefs | null),
  });

  const render = (): void => {
    const q = QUESTIONS[questionIndex];
    const view = flowView();

    svg.innerHTML = buildFlow(q, view);
    switchBtn.setAttribute('aria-checked', String(toolsOn));
    pickButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === questionIndex)));

    choose.hidden = !toolsOn;
    tryButtons.forEach((btn, i) => {
      const tried = pickedTools.has(i);
      btn.disabled = finished || tried;
      btn.setAttribute('aria-pressed', String(finished && i === CORRECT_TOOL[questionIndex]));
      const tag = btn.querySelector<HTMLElement>('.tool-try-tag');
      if (tag) tag.hidden = !tried;
    });

    caption.textContent = captionText(view);
    hint.textContent = hintText(view);

    applyRelay(kit.refs as RelayRefs | null);
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
   3D packet-relay scene: user / model / tool node orbs with a
   40-packet relay that mirrors the call state.
   ============================================================ */

type RelayState = 'idle' | 'wrong' | 'done';

interface RelayRefs {
  /** Position + tint the 40 packets for the current relay state. */
  apply(state: RelayState): void;
}

/* Point budget: 3 × 120 orbs + 40 packets + 120 starfield. */
const USER_POS: readonly [number, number, number] = [-2.6, 1.4, 0];
const MODEL_POS: readonly [number, number, number] = [0, -0.9, 0];
const TOOL_POS: readonly [number, number, number] = [2.6, 1.4, 0];
const ORB_COUNT = 120;
const ORB_RADIUS = 0.5;
const PACKET_COUNT = 40;
const LEG_PACKETS = 20;

function buildRelayScene(handle: Stage3DHandle): RelayRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /* ----- the three node orbs -----
     rand() consumption order is frozen: for each point, (1) theta,
     (2) phi, (3) radius (cube-root for a uniform volume fill) —
     three calls per point, 120 per orb, user → model → tool, then
     the starfield. Any change here shifts every point. */
  const buildOrb = (center: readonly [number, number, number], hex: string): void => {
    const positions = new Float32Array(ORB_COUNT * 3);
    for (let i = 0; i < ORB_COUNT; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = ORB_RADIUS * Math.cbrt(rand());
      const sinPhi = Math.sin(phi);
      positions[i * 3] = center[0] + r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = center[1] + r * Math.cos(phi);
      positions[i * 3 + 2] = center[2] + r * sinPhi * Math.sin(theta);
    }
    const color = new THREE.Color(hex);
    const colors = new Float32Array(ORB_COUNT * 3);
    for (let i = 0; i < ORB_COUNT; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    scene.add(makeGlowPoints(positions, colors, 0.16));
  };

  buildOrb(USER_POS, '#6E85FF');
  buildOrb(MODEL_POS, '#FFB020');
  buildOrb(TOOL_POS, '#22C48E');

  /* ----- 40 message packets, parked at the model until the relay runs ----- */
  const positions = new Float32Array(PACKET_COUNT * 3);
  const colors = new Float32Array(PACKET_COUNT * 3);
  const packets = makeGlowPoints(positions, colors, 0.07);
  scene.add(packets);
  const posAttr = packets.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = packets.geometry.getAttribute('color') as THREE.BufferAttribute;

  addStarfield(handle, 120, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  const mint = new THREE.Color('#22C48E');
  const coral = new THREE.Color('#FF6B5E');
  const dim = new THREE.Color('#10182B');

  const fillLeg = (
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    offset: number,
    color: THREE.Color,
  ): void => {
    for (let i = 0; i < LEG_PACKETS; i += 1) {
      const t = i / (LEG_PACKETS - 1);
      const k = (offset + i) * 3;
      positions[k] = from[0] + (to[0] - from[0]) * t;
      positions[k + 1] = from[1] + (to[1] - from[1]) * t;
      positions[k + 2] = from[2] + (to[2] - from[2]) * t;
      colors[k] = color.r;
      colors[k + 1] = color.g;
      colors[k + 2] = color.b;
    }
  };

  let applied: RelayState | null = null;
  return {
    apply(state) {
      if (state === applied) return;
      applied = state;
      if (state === 'done') {
        // the reply travels home: model → user, and the result comes
        // back tool → model — both legs mint.
        fillLeg(MODEL_POS, USER_POS, 0, mint);
        fillLeg(TOOL_POS, MODEL_POS, LEG_PACKETS, mint);
      } else if (state === 'wrong') {
        // the call goes out model → tool (coral) and the dead end
        // comes back tool → model (dim).
        fillLeg(MODEL_POS, TOOL_POS, 0, coral);
        fillLeg(TOOL_POS, MODEL_POS, LEG_PACKETS, dim);
      } else {
        for (let i = 0; i < PACKET_COUNT; i += 1) {
          positions[i * 3] = MODEL_POS[0];
          positions[i * 3 + 1] = MODEL_POS[1];
          positions[i * 3 + 2] = MODEL_POS[2];
          colors[i * 3] = dim.r;
          colors[i * 3 + 1] = dim.g;
          colors[i * 3 + 2] = dim.b;
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
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
