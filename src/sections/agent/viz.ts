/**
 * AI agent demo — the finale (Task 13): "steer every move (wrong moves
 * stall the run) + 3D loop orbit".
 *
 *  - a task card carries the fixed goal ("Plan a surprise birthday hike
 *    for Sam — …");
 *  - the run is NOT a script: `Next step` starts each lap (the thought)
 *    and closes the run, but every Act is the USER's call — the choice
 *    panel (`.agent-choices`, fixed min-height, always present) offers
 *    two tools and the wrong one costs an ACT + a coral STALL entry and
 *    retires its button with a `Tried — no help` tag;
 *  - tools ON minimum path: 2 × `Next step` + 2 choice clicks = 4 moves
 *    → 7 entries (identical texts to the old scripted run); each wrong
 *    try adds 2 entries and 1 wobble;
 *  - tools OFF run is unchanged (thought → failure → "asked you
 *    instead"); `Skip to the end` fills the remaining entries via the
 *    CORRECT path; `Restart` clears everything including wrong tries;
 *  - the loop badge keeps its logic (phase of the newest entry; `Done ✓`
 *    / stopped states); the stage-bar hint is a pure function of the
 *    state, ending in `Done! {n} moves, {w} wobbles.`;
 *  - behind the DOM UI sits the 3D "loop orbit" layer
 *    (`.agent-canvas-wrap.stage-3d-layer`): a dim 240-point orbit ring
 *    in the xz-plane with a 60-point cursor orb that travels one lap as
 *    the run fills (count / 7 of the circle) and takes the newest
 *    entry's phase color. Built through the `createStageKit` resilience
 *    kit (2D blit + context-loss rebuild) with `alpha: true`, so the
 *    stage's CSS gradient shows through the transparent canvas.
 *
 * ALL state is mirrored in the DOM (timeline, choice panel, badge,
 * hints) — so every control keeps working in jsdom, where the canvas
 * is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

/* ---------- fixed data (never generated, never random) ---------- */

const GOAL_TEXT =
  'Plan a surprise birthday hike for Sam — he loves chocolate and mountains; check Saturday and email his sister.';

const H2_TEXT = 'One goal, one loop';
const SUB_TEXT =
  'The model thinks, but you steer every act. Pick the wrong tool and the loop stalls — the email still gets written.';

type EntryKind = 'thought' | 'act' | 'observe' | 'stall' | 'failed' | 'done' | 'gaveup';
type Phase = 'think' | 'act' | 'observe';

interface Entry {
  kind: EntryKind;
  /** The loop phase this entry belongs to (null = the run is settled). */
  phase: Phase | null;
  text: string;
}

/** Tools-on run pieces, in fixed order. A wrong try inserts its
 *  ACT + STALL pair before the correct act. */
const THOUGHT_1: Entry = { kind: 'thought', phase: 'think', text: 'I need the date first.' };
const WRONG_ACT_1: Entry = {
  kind: 'act',
  phase: 'act',
  text: 'web.search("Saturday weather Portland")',
};
const WRONG_STALL_1: Entry = {
  kind: 'stall',
  phase: 'act',
  text: 'Useless — I still do not know if Saturday is free.',
};
const ACT_1: Entry = { kind: 'act', phase: 'act', text: 'calendar.check("Saturday")' };
const OBS_1: Entry = { kind: 'observe', phase: 'observe', text: 'Saturday: free' };
const WRONG_ACT_2: Entry = { kind: 'act', phase: 'act', text: 'email.draft(...)' };
const WRONG_STALL_2: Entry = {
  kind: 'stall',
  phase: 'act',
  text: 'Too early — I have no trail to write about.',
};
const ACT_2: Entry = {
  kind: 'act',
  phase: 'act',
  text: 'web.search("Portland chocolate + hiking")',
};
const OBS_2: Entry = { kind: 'observe', phase: 'observe', text: 'Maple Ridge trail ✓' };
const ACT_3: Entry = { kind: 'act', phase: 'act', text: 'email.draft(...)' };
const DONE: Entry = { kind: 'done', phase: null, text: 'Done! Email drafted ✅' };

/** Tools OFF: the run dies at the calendar and the agent asks instead. */
const RUN_OFF: readonly Entry[] = [
  { kind: 'thought', phase: 'think', text: 'I need the date first.' },
  { kind: 'failed', phase: 'act', text: 'Action failed: no calendar tool' },
  { kind: 'gaveup', phase: null, text: 'Gave up — and asked you instead' },
];

const TAG: Record<EntryKind, string> = {
  thought: 'THOUGHT',
  act: 'ACT',
  observe: 'OBSERVE',
  stall: 'STALLED',
  failed: 'FAILED',
  done: 'DONE',
  gaveup: 'ASKED YOU',
};

interface ChoiceOption {
  /** Button text — the tool call the model would write. */
  text: string;
  correct: boolean;
}

/** The two tools offered for each act decision (fixed order). */
const CHOICE_OPTIONS: Record<1 | 2, readonly ChoiceOption[]> = {
  1: [
    { text: 'calendar.check("Saturday")', correct: true },
    { text: 'web.search("Saturday weather Portland")', correct: false },
  ],
  2: [
    { text: 'web.search("Portland chocolate + hiking")', correct: true },
    { text: 'email.draft(...)', correct: false },
  ],
};

const EMPTY_TEXT = 'Nothing yet — press Next step to start the loop.';
const CHOICES_EMPTY = 'The loop decides when there is nothing to choose.';
const HINT_ON_START = 'Press Next step to start — then steer every move.';
const HINT_CHOICE = 'Your call: what should it do?';
const HINT_ON_FINAL = 'Press Next step to finish the loop.';
const HINT_OFF_START = 'Tools off — this run will end early.';
const HINT_OFF_DONE = 'No calendar tool — it gave up and asked you instead.';

/** The clean run is 4 moves (2 × Next step + 2 choice clicks). */
const CLEAN_MOVES = 4;

/** The full tools-on run length — 7 + 2 per wrong try (pure function). */
function fullOnLength(wrongTries: { act1: boolean; act2: boolean }): number {
  return 7 + (wrongTries.act1 ? 2 : 0) + (wrongTries.act2 ? 2 : 0);
}

/* ============================================================
   The stage: head (title + loop badge), body (goal card |
   timeline + choice panel), and the stage bar. One mount —
   everything shares state.
   ============================================================ */

export function mountAgentViz(root: HTMLElement): () => void {
  let toolsOn = true;
  let count = 0; // timeline entries shown
  let completed = false;
  let choice: 1 | 2 | null = null; // which act decision is pending
  const wrongTries = { act1: false, act2: false };

  /* ---------- 3D layer wrapper (absolute-fill, behind the UI) ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage agent-stage';
  stage.setAttribute('aria-label', 'AI agent demo');

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'agent-canvas-wrap stage-3d-layer';

  /* ---------- head: title + loop badge ---------- */

  const head = document.createElement('header');
  head.className = 'agent-head';
  const headText = document.createElement('div');
  headText.className = 'agent-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = H2_TEXT;
  const sub = document.createElement('p');
  sub.className = 'agent-sub';
  sub.textContent = SUB_TEXT;
  headText.append(h2, sub);

  const loop = document.createElement('div');
  loop.className = 'agent-loop';
  loop.setAttribute('role', 'group');
  loop.setAttribute('aria-label', 'Agent loop: current phase');
  const phaseChips: Record<Phase, HTMLElement> = { think: null!, act: null!, observe: null! };
  const phaseLabels: ReadonlyArray<readonly [Phase, string]> = [
    ['think', 'Think'],
    ['act', 'Act'],
    ['observe', 'Observe'],
  ];
  phaseLabels.forEach(([phase, label], i) => {
    const chip = document.createElement('span');
    chip.className = `agent-loop-step agent-loop-step--${phase}`;
    chip.dataset.phase = phase;
    chip.textContent = label;
    phaseChips[phase] = chip;
    loop.appendChild(chip);
    if (i < phaseLabels.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'agent-loop-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      loop.appendChild(arrow);
    }
  });
  const repeatArrow = document.createElement('span');
  repeatArrow.className = 'agent-loop-arrow';
  repeatArrow.setAttribute('aria-hidden', 'true');
  repeatArrow.textContent = '↻';
  const repeatChip = document.createElement('span');
  repeatChip.className = 'agent-loop-step agent-loop-repeat';
  repeatChip.dataset.state = 'idle';
  repeatChip.textContent = 'Repeat';
  loop.append(repeatArrow, repeatChip);

  head.append(headText, loop);

  /* ---------- body: goal card | timeline + choice panel ---------- */

  const body = document.createElement('div');
  body.className = 'agent-body';

  const goal = document.createElement('div');
  goal.className = 'agent-goal';
  const goalHead = document.createElement('p');
  goalHead.className = 'agent-goal-head';
  goalHead.textContent = 'The goal';
  const goalText = document.createElement('p');
  goalText.className = 'agent-goal-text';
  goalText.textContent = GOAL_TEXT;
  goal.append(goalHead, goalText);

  const run = document.createElement('div');
  run.className = 'agent-run';
  const runHead = document.createElement('p');
  runHead.className = 'agent-run-head';
  runHead.textContent = 'The run';
  const timeline = document.createElement('ul');
  timeline.className = 'agent-timeline';
  timeline.setAttribute('aria-label', 'Agent timeline');
  timeline.setAttribute('aria-live', 'polite');
  const emptyLi = document.createElement('li');
  emptyLi.className = 'agent-empty';
  emptyLi.textContent = EMPTY_TEXT;
  run.append(runHead, timeline);

  /* choice panel — ALWAYS present, fixed min-height (the stage and
     the 3D canvas behind it never resize between states). */
  const choices = document.createElement('div');
  choices.className = 'agent-choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Choose the next act');
  const choicesEmpty = document.createElement('p');
  choicesEmpty.className = 'agent-choice-empty';
  choicesEmpty.textContent = CHOICES_EMPTY;
  const choiceButtons: Record<1 | 2, HTMLButtonElement[]> = { 1: [], 2: [] };
  ([1, 2] as const).forEach((choiceNumber) => {
    CHOICE_OPTIONS[choiceNumber].forEach((option, optionIndex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agent-choice';
      const text = document.createElement('span');
      text.className = 'agent-choice-text';
      text.textContent = option.text;
      const tag = document.createElement('span');
      tag.className = 'agent-choice-tag';
      tag.setAttribute('aria-hidden', 'true'); // keep the accessible name stable
      tag.hidden = true;
      tag.textContent = 'Tried — no help';
      btn.append(text, tag);
      btn.addEventListener('click', () => choose(choiceNumber, optionIndex));
      choices.appendChild(btn);
      choiceButtons[choiceNumber][optionIndex] = btn;
    });
  });
  run.append(choices);
  body.append(goal, run);

  /* ---------- stage bar: tools switch + step controls + hint ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const switchRow = document.createElement('span');
  switchRow.className = 'agent-switch-row';
  const switchLabel = document.createElement('span');
  switchLabel.className = 'agent-switch-label';
  switchLabel.textContent = 'Tools: on/off';
  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'toggle agent-switch';
  switchBtn.setAttribute('role', 'switch');
  switchBtn.setAttribute('aria-checked', 'true');
  switchBtn.setAttribute('aria-label', 'Tools: on/off');
  switchRow.append(switchLabel, switchBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn btn-primary agent-next';
  nextBtn.textContent = 'Next step';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'btn btn-ghost agent-skip';
  skipBtn.textContent = 'Skip to the end';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn btn-ghost agent-restart';
  restartBtn.textContent = 'Restart';

  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint agent-hint';
  bar.append(switchRow, nextBtn, skipBtn, restartBtn, hint);

  stage.append(canvasWrap, head, body, bar);
  root.appendChild(stage);

  /* ---------- behaviour: every visual state is a pure function ---------- */

  const resetRun = (): void => {
    count = 0;
    completed = false;
    choice = null;
    wrongTries.act1 = false;
    wrongTries.act2 = false;
  };

  /** The tools-on entry list the state has produced so far. */
  const runEntries = (): readonly Entry[] => {
    if (count === 0) return [];
    const list: Entry[] = [THOUGHT_1];
    if (wrongTries.act1) list.push(WRONG_ACT_1, WRONG_STALL_1);
    if (choice !== 1) list.push(ACT_1, OBS_1); // choice 1 settled
    if (wrongTries.act2) list.push(WRONG_ACT_2, WRONG_STALL_2);
    // choice 2 settled = done, or back at "Next step" with a live run
    if (completed || (choice === null && count > 0)) list.push(ACT_2, OBS_2);
    if (completed) list.push(ACT_3, DONE);
    return list.slice(0, count);
  };

  const entriesShown = (): readonly Entry[] => (toolsOn ? runEntries() : RUN_OFF.slice(0, count));

  const entryEl = (entry: Entry): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = `agent-entry agent-entry--${entry.kind}`;
    const tag = document.createElement('span');
    tag.className = 'agent-entry-tag';
    tag.textContent = TAG[entry.kind];
    const text = document.createElement('span');
    text.className = 'agent-entry-text';
    text.textContent = entry.text;
    li.append(tag, text);
    return li;
  };

  const wobbles = (): number => (wrongTries.act1 ? 1 : 0) + (wrongTries.act2 ? 1 : 0);

  /** Stage-bar hint — a pure function of the run state. */
  const hintFor = (): string => {
    if (completed) {
      if (!toolsOn) return HINT_OFF_DONE;
      const w = wobbles();
      return `Done! ${CLEAN_MOVES + w} moves, ${w} wobbles.`;
    }
    if (toolsOn) {
      if (choice !== null) return HINT_CHOICE;
      return count === 0 ? HINT_ON_START : HINT_ON_FINAL;
    }
    return count === 0 ? HINT_OFF_START : `Step ${count} of ${RUN_OFF.length}`;
  };

  /* ----- 3D loop orbit (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     cursor position/color onto the refs (and tolerates null refs —
     jsdom fallback). It reads the closure state at call time, which
     is what makes the post-context-loss rebuild re-apply correctly. */
  const applyOrbit = (refs: OrbitRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    const shown = entriesShown();
    const last = shown[shown.length - 1] ?? null;
    refs.apply(Math.min(count, ORBIT_MAX_COUNT), last ? last.kind : null);
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260413,
      camera: { position: [0, 0.8, 8.5], fov: 45 },
      alpha: true,
    },
    build: (h) => buildOrbitScene(h),
    reapply: (refs) => applyOrbit(refs as OrbitRefs | null),
  });

  const render = (): void => {
    // timeline (rebuilt per state — fixed data, so fully deterministic)
    const shown = entriesShown();
    timeline.replaceChildren(
      ...(shown.length > 0 ? shown.map(entryEl) : [emptyLi]),
    );
    // Deterministic feed position: pin to the newest entry with an
    // immediate jump (no CSS scroll animation), so the content
    // position is a pure function of the state.
    timeline.scrollTop = timeline.scrollHeight;

    // loop badge — highlight the phase of the newest entry
    const last = shown[shown.length - 1] ?? null;
    (['think', 'act', 'observe'] as const).forEach((phase) => {
      if (last?.phase === phase) phaseChips[phase].dataset.on = 'true';
      else delete phaseChips[phase].dataset.on;
    });
    const done = last?.kind === 'done';
    const stopped = last?.kind === 'gaveup';
    repeatChip.dataset.state = done ? 'done' : stopped ? 'stopped' : 'idle';
    repeatChip.textContent = done ? 'Done ✓' : 'Repeat';
    loop.dataset.state = done ? 'done' : stopped ? 'stopped' : 'running';

    // choice panel — the two options of the pending act, or the empty
    // line. Content is swapped (never `hidden`), the fixed min-height
    // keeps the panel's height constant either way.
    if (toolsOn && choice !== null) {
      choices.replaceChildren(...choiceButtons[choice]);
      choiceButtons[choice].forEach((btn, optionIndex) => {
        const tried =
          (choice === 1 && wrongTries.act1 && !CHOICE_OPTIONS[1][optionIndex].correct) ||
          (choice === 2 && wrongTries.act2 && !CHOICE_OPTIONS[2][optionIndex].correct);
        btn.disabled = tried;
        const tag = btn.querySelector<HTMLElement>('.agent-choice-tag');
        if (tag) tag.hidden = !tried;
      });
    } else {
      choices.replaceChildren(choicesEmpty);
    }

    // controls
    switchBtn.setAttribute('aria-checked', String(toolsOn));
    nextBtn.disabled = completed || (toolsOn && choice !== null);
    skipBtn.disabled = completed;
    restartBtn.disabled = count === 0;
    hint.textContent = hintFor();

    applyOrbit(kit.refs as OrbitRefs | null);
    kit.render();
  };

  const next = (): void => {
    if (completed) return;
    if (toolsOn) {
      // While a choice is pending the run waits for the user's call.
      if (choice !== null) return;
      if (count === 0) {
        count = 1; // the first lap: the model thinks first
        choice = 1;
      } else {
        // the closing lap: the final act + the Done entry
        count = fullOnLength(wrongTries);
        completed = true;
      }
    } else {
      count = Math.min(count + 1, RUN_OFF.length);
      if (count === RUN_OFF.length) completed = true;
    }
    render();
  };

  const choose = (choiceNumber: 1 | 2, optionIndex: number): void => {
    if (!toolsOn || choice !== choiceNumber || completed) return;
    const option = CHOICE_OPTIONS[choiceNumber][optionIndex];
    if (option.correct) {
      count += 2; // the act + its observation
      choice = choiceNumber === 1 ? 2 : null; // null → Next step again
    } else {
      if (choiceNumber === 1) wrongTries.act1 = true;
      else wrongTries.act2 = true;
      count += 2; // the wasted act + the stall
      // choice stays pending; the wrong button is retired in render
    }
    render();
  };

  const skipToEnd = (): void => {
    if (completed) return;
    // Fills the remaining entries via the CORRECT path — wrong tries
    // already on the timeline stay, no new ones are added.
    count = toolsOn ? fullOnLength(wrongTries) : RUN_OFF.length;
    completed = true;
    choice = null;
    render();
  };

  const restart = (): void => {
    if (count === 0) return;
    resetRun();
    render();
  };

  nextBtn.addEventListener('click', next);
  skipBtn.addEventListener('click', skipToEnd);
  restartBtn.addEventListener('click', restart);
  switchBtn.addEventListener('click', () => {
    // Flipping tools mid-run restarts the run (the simplest
    // deterministic behaviour): the timeline clears and the new
    // run starts from step 0 under the new tools state.
    toolsOn = !toolsOn;
    resetRun();
    render();
  });

  render();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ============================================================
   3D loop orbit: a dim ring in the xz-plane and a cursor orb
   that walks one lap as the run fills, colored by the newest
   entry's phase.
   ============================================================ */

interface OrbitRefs {
  /** Park + tint the cursor orb for the current (count, kind). */
  apply(entryCount: number, kind: EntryKind | null): void;
}

/** The cursor walks count / 7 of the circle (7 = the clean run). */
const ORBIT_MAX_COUNT = 7;
const RING_COUNT = 240;
const RING_RADIUS = 2.6;
const RING_COLOR = '#33405F';
const CURSOR_COUNT = 60;
const CURSOR_RADIUS = 0.4;
const IDLE_COLOR = '#4A5878';

/** Newest-entry phase color (done = bright mint; failure = coral). */
const PHASE_COLOR: Record<EntryKind, string> = {
  thought: '#6E85FF',
  act: '#FFB020',
  observe: '#22C48E',
  stall: '#FF6B5E',
  failed: '#FF6B5E',
  gaveup: '#FF6B5E',
  done: '#22C48E',
};

function buildOrbitScene(handle: Stage3DHandle): OrbitRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /* ----- 1) orbit ring -----
     240 points evenly spaced, radius 2.6 in the xz-plane at y 0 —
     fixed geometry, so it consumes NO rand() calls. The elevated
     camera (0, 0.8, 8.5) tilts the ring toward the viewer. */
  const ringPositions = new Float32Array(RING_COUNT * 3);
  const ringColors = new Float32Array(RING_COUNT * 3);
  const ringColor = new THREE.Color(RING_COLOR);
  for (let i = 0; i < RING_COUNT; i += 1) {
    const angle = (i / RING_COUNT) * Math.PI * 2;
    ringPositions[i * 3] = RING_RADIUS * Math.cos(angle);
    ringPositions[i * 3 + 1] = 0;
    ringPositions[i * 3 + 2] = RING_RADIUS * Math.sin(angle);
    ringColors[i * 3] = ringColor.r;
    ringColors[i * 3 + 1] = ringColor.g;
    ringColors[i * 3 + 2] = ringColor.b;
  }
  scene.add(makeGlowPoints(ringPositions, ringColors, 0.09));

  /* ----- 2) cursor orb -----
     rand() consumption order is frozen: for each point, (1) theta,
     (2) phi (acos(2r − 1)), (3) radius (cube-root for a uniform
     volume fill) — three calls per point, 60 points, then the
     starfield. Any change here shifts every point. */
  const offsets = new Float32Array(CURSOR_COUNT * 3);
  for (let i = 0; i < CURSOR_COUNT; i += 1) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = CURSOR_RADIUS * Math.cbrt(rand());
    const sinPhi = Math.sin(phi);
    offsets[i * 3] = r * sinPhi * Math.cos(theta);
    offsets[i * 3 + 1] = r * Math.cos(phi);
    offsets[i * 3 + 2] = r * sinPhi * Math.sin(theta);
  }
  const cursorPositions = new Float32Array(CURSOR_COUNT * 3);
  const cursorColors = new Float32Array(CURSOR_COUNT * 3);
  const cursor = makeGlowPoints(cursorPositions, cursorColors, 0.13);
  scene.add(cursor);
  const posAttr = cursor.geometry.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = cursor.geometry.getAttribute('color') as THREE.BufferAttribute;
  const material = cursor.material as THREE.PointsMaterial;

  /* ----- 3) starfield ----- */
  addStarfield(handle, 120, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  const colorCache = new Map<string, THREE.Color>();
  const colorOf = (hex: string): THREE.Color => {
    let color = colorCache.get(hex);
    if (!color) {
      color = new THREE.Color(hex);
      colorCache.set(hex, color);
    }
    return color;
  };
  let appliedKey = '';
  return {
    apply(entryCount, kind) {
      const key = `${entryCount}|${kind ?? 'idle'}`;
      if (key === appliedKey) return;
      appliedKey = key;
      // angle = −90° + (count / 7) × 360° — 0 → −90° (top of the ring
      // from this camera), 7 → a full lap back to the start.
      const angle = ((-90 + (entryCount / ORBIT_MAX_COUNT) * 360) * Math.PI) / 180;
      const cx = RING_RADIUS * Math.cos(angle);
      const cz = RING_RADIUS * Math.sin(angle);
      const color = kind === null ? colorOf(IDLE_COLOR) : colorOf(PHASE_COLOR[kind]);
      material.opacity = kind === 'done' ? 1 : kind === null ? 0.6 : 0.85;
      for (let i = 0; i < CURSOR_COUNT; i += 1) {
        cursorPositions[i * 3] = cx + offsets[i * 3];
        cursorPositions[i * 3 + 1] = offsets[i * 3 + 1];
        cursorPositions[i * 3 + 2] = cz + offsets[i * 3 + 2];
        cursorColors[i * 3] = color.r;
        cursorColors[i * 3 + 1] = color.g;
        cursorColors[i * 3 + 2] = color.b;
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
    body: "An agent is a model inside a loop. It thinks about the next move, acts — usually through a tool — observes the result, and repeats until the goal is done or it can't go on.",
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'This is what turns a chat reply into a finished job. Checking Saturday, finding a trail and drafting the email are three separate moves — the loop lets the model try each one, see what happens, and course-correct. A bad move is not a crash: it is a stall, and the loop goes around again.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'The loop has a name: ReAct — "reason and act", a 2022 research recipe that became the standard skeleton of most modern agents. And asking you when stuck counts as a successful step, not a failed one.',
  },
];

export function mountAgentExplain(root: HTMLElement): () => void {
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
