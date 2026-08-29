/**
 * AI agent demo — the finale (Task 12, DOM/CSS only: no canvas, no 3D),
 * so every control is jsdom-testable and screenshot-frozen:
 *
 *  - a task card carries the fixed goal ("Plan a surprise birthday hike
 *    for Sam — …");
 *  - a loop badge (Think → Act → Observe ↻ Repeat) highlights the phase
 *    of the newest timeline entry; on a successful finish it flips to a
 *    mint "Done ✓" state (no phase highlighted); a failed finish leaves
 *    every phase dim ("stopped" state);
 *  - the timeline is a fixed-height, scrollable inner region whose
 *    scrollTop is pinned to the bottom with an immediate jump (the
 *    pretraining feed pattern) — the stage height is state-invariant,
 *    so every capture frames the same slice of the page;
 *  - "Next step" walks a fixed run: with tools on, 6 presses (the 6th
 *    appends the "Done!" entry, so the run is 6 steps / 7 entries);
 *    with tools off, 3 presses (thought → failure → "Gave up — and
 *    asked you instead");
 *  - "Skip to the end" fills all remaining entries instantly;
 *    "Restart" clears the run; the "Tools: on/off" switch (a real
 *    role="switch") restarts the run deterministically when flipped
 *    mid-run;
 *  - all copy is fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

/* ---------- fixed data (never generated, never random) ---------- */

const GOAL_TEXT =
  'Plan a surprise birthday hike for Sam — he loves chocolate and mountains; check Saturday and email his sister.';

const H2_TEXT = 'One goal, one loop';
const SUB_TEXT =
  'One press is one lap of the loop — think, act, observe. Turn the tools off and watch it give up gracefully.';

type EntryKind = 'thought' | 'act' | 'observe' | 'failed' | 'done' | 'gaveup';
type Phase = 'think' | 'act' | 'observe';

interface Entry {
  kind: EntryKind;
  /** The loop phase this entry belongs to (null = the run is settled). */
  phase: Phase | null;
  text: string;
}

/** Tools ON: 6 steps. The 6th press appends the "Done!" entry with the
 *  final act, so the finished run is 7 entries. */
const RUN_ON: readonly Entry[] = [
  { kind: 'thought', phase: 'think', text: 'I need the date first.' },
  { kind: 'act', phase: 'act', text: 'calendar.check("Saturday")' },
  { kind: 'observe', phase: 'observe', text: 'Saturday: free' },
  { kind: 'act', phase: 'act', text: 'web.search("Portland chocolate + hiking")' },
  { kind: 'observe', phase: 'observe', text: 'Maple Ridge trail ✓' },
  { kind: 'act', phase: 'act', text: 'email.draft(...)' },
  { kind: 'done', phase: null, text: 'Done! Email drafted ✅' },
];

/** Tools OFF: the run dies at the calendar and the agent asks instead. */
const RUN_OFF: readonly Entry[] = [
  { kind: 'thought', phase: 'think', text: 'I need the date first.' },
  { kind: 'failed', phase: 'act', text: 'Action failed: no calendar tool' },
  { kind: 'gaveup', phase: null, text: 'Gave up — and asked you instead' },
];

/** Tools-on run: the press number that also appends "Done!". */
const DONE_STEP = 6;

const TAG: Record<EntryKind, string> = {
  thought: 'THOUGHT',
  act: 'ACT',
  observe: 'OBSERVE',
  failed: 'FAILED',
  done: 'DONE',
  gaveup: 'ASKED YOU',
};

const EMPTY_TEXT = 'Nothing yet — press Next step to start the loop.';

const HINT_ON_START = 'Six steps to a drafted email — press Next step.';
const HINT_ON_DONE = 'Done! Six steps, one loop.';
const HINT_OFF_START = 'Tools off — this run will end early.';
const HINT_OFF_DONE = 'No calendar tool — it gave up and asked you instead.';

/** Stage-bar hint — a pure function of the run state. */
function hintFor(toolsOn: boolean, count: number, completed: boolean): string {
  if (completed) return toolsOn ? HINT_ON_DONE : HINT_OFF_DONE;
  if (toolsOn) return count === 0 ? HINT_ON_START : `Step ${count} of ${RUN_ON.length - 1}`;
  return count === 0 ? HINT_OFF_START : `Step ${count} of ${RUN_OFF.length}`;
}

/* ============================================================
   The stage: head (title + loop badge), body (goal card +
   timeline) and the stage bar. One mount — everything shares
   state.
   ============================================================ */

export function mountAgentViz(root: HTMLElement): () => void {
  let toolsOn = true;
  let count = 0; // timeline entries shown
  let completed = false;

  /* ---------- head: title + loop badge ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage agent-stage';
  stage.setAttribute('aria-label', 'AI agent demo');

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

  /* ---------- body: goal card | timeline ---------- */

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

  /* ---------- behaviour: every visual state is a pure function ---------- */

  const entriesShown = (): readonly Entry[] =>
    (toolsOn ? RUN_ON : RUN_OFF).slice(0, count);

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

  const render = () => {
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

    // controls
    switchBtn.setAttribute('aria-checked', String(toolsOn));
    nextBtn.disabled = completed;
    skipBtn.disabled = completed;
    restartBtn.disabled = count === 0;
    hint.textContent = hintFor(toolsOn, count, completed);
  };

  const next = () => {
    if (completed) return;
    count += 1;
    // The tools-on run is 6 steps: the 6th press also appends "Done!".
    if (toolsOn && count === DONE_STEP) count = RUN_ON.length;
    if (count >= (toolsOn ? RUN_ON.length : RUN_OFF.length)) completed = true;
    render();
  };

  const skipToEnd = () => {
    if (completed) return;
    count = toolsOn ? RUN_ON.length : RUN_OFF.length;
    completed = true;
    render();
  };

  const restart = () => {
    if (count === 0) return;
    count = 0;
    completed = false;
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
    count = 0;
    completed = false;
    render();
  });

  render();

  stage.append(head, body, bar);
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
    body: "An agent is a model inside a loop. It thinks about the next move, acts — usually through a tool — observes the result, and repeats until the goal is done or it can't go on.",
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'This is what turns a chat reply into a finished job. Checking Saturday, finding a trail and drafting the email are three separate moves — the loop lets the model try each one, see what happens, and course-correct.',
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
