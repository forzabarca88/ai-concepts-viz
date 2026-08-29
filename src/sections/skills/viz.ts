/**
 * Skills visualisations — a friendly robot agent (inline SVG) with a
 * skill "backpack" and a three-task board (Task 10: DOM/CSS/SVG only,
 * no canvas), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - "Teach a skill" cycles three fixed skills into the inventory
 *    (Browse the web / Write code / Summarize); every card carries a
 *    "Learned!" badge and a real "Forget" button; the button locks
 *    while all three are learned (forgetting one reopens its slot);
 *  - the task board picks one of three fixed tasks; the readiness
 *    line is a pure function of (learned skills, selected task):
 *    "Ready! 🎒" or "Not ready" + "Missing: <skill>";
 *  - the inventory card for the selected task's required skill glows
 *    amber; the robot's three chest lights mirror the learned count;
 *  - all data lists are fixed and hardcoded (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

interface Skill {
  id: string;
  name: string;
  icon: string;
}

/** The three teachable skills, in the fixed order the cycle walks. */
const SKILLS: readonly Skill[] = [
  { id: 'browse', name: 'Browse the web', icon: '🌐' },
  { id: 'code', name: 'Write code', icon: '💻' },
  { id: 'summarize', name: 'Summarize', icon: '📝' },
];

const SKILL_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((s) => [s.id, s]));

interface Task {
  id: string;
  label: string;
  /** The one skill this task needs. */
  need: string;
}

/** The three fixed tasks on the board. */
const TASKS: readonly Task[] = [
  { id: 'trail', label: "Find Portland's best hiking trail", need: 'browse' },
  { id: 'script', label: 'Write a script to rename files', need: 'code' },
  { id: 'article', label: 'Summarize this long article', need: 'summarize' },
];

const EMPTY_LINE = 'No skills yet — just a very smart mind';
const IDLE_LINE = 'Pick a task to check.';
const READY_LINE = 'Ready! 🎒';
const NOT_READY_LINE = 'Not ready';

/** Readiness is a pure function of (learned skills, selected task). */
type Readiness =
  | { status: 'idle' }
  | { status: 'ready' }
  | { status: 'missing'; skillName: string };

function readinessOf(learned: ReadonlySet<string>, taskId: string | null): Readiness {
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) return { status: 'idle' };
  if (learned.has(task.need)) return { status: 'ready' };
  return { status: 'missing', skillName: SKILL_BY_ID.get(task.need)?.name ?? '' };
}

/** Stage-bar hint — also a pure function of the learned set. */
function teachHint(learned: ReadonlySet<string>): string {
  if (learned.size >= SKILLS.length) return 'All 3 skills learned — the backpack is full.';
  const next = SKILLS.find((s) => !learned.has(s.id));
  return next ? `Next up: ${next.name}.` : 'The backpack is full.';
}

/** The robot — fixed geometry, no randomness, no measurement. */
const AVATAR_SVG = `
<svg class="sk-avatar" viewBox="0 0 160 192" role="img" aria-label="A friendly robot agent">
  <line class="sk-ant-stalk" x1="80" y1="18" x2="80" y2="32"/>
  <circle class="sk-ant-ball" cx="80" cy="12" r="6"/>
  <rect class="sk-ear" x="24" y="54" width="12" height="26" rx="6"/>
  <rect class="sk-ear" x="124" y="54" width="12" height="26" rx="6"/>
  <rect class="sk-head" x="36" y="32" width="88" height="64" rx="20"/>
  <circle class="sk-eye" cx="63" cy="60" r="7.5"/>
  <circle class="sk-eye" cx="97" cy="60" r="7.5"/>
  <path class="sk-smile" d="M66 76 Q80 88 94 76"/>
  <rect class="sk-neck" x="72" y="96" width="16" height="10"/>
  <rect class="sk-torso" x="42" y="106" width="76" height="58" rx="16"/>
  <circle class="sk-light" cx="62" cy="126" r="6"/>
  <circle class="sk-light" cx="80" cy="126" r="6"/>
  <circle class="sk-light" cx="98" cy="126" r="6"/>
  <rect class="sk-panel" x="58" y="142" width="44" height="6" rx="3"/>
  <rect class="sk-arm" x="28" y="112" width="10" height="36" rx="5"/>
  <rect class="sk-arm" x="122" y="112" width="10" height="36" rx="5"/>
  <rect class="sk-foot" x="54" y="164" width="20" height="12" rx="6"/>
  <rect class="sk-foot" x="86" y="164" width="20" height="12" rx="6"/>
</svg>`;

function span(cls: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = text;
  return el;
}

/* ============================================================
   The stage: avatar + inventory | task board + readiness,
   and the teach bar. One mount because everything shares state.
   ============================================================ */

export function mountSkillViz(root: HTMLElement): () => void {
  const learned = new Set<string>();
  let taskId: string | null = null;

  /* ---------- head ---------- */

  const stage = document.createElement('section');
  stage.className = 'stage skill-stage';
  stage.setAttribute('aria-label', 'Agent skills demo');

  const head = document.createElement('header');
  head.className = 'skill-head';
  const headText = document.createElement('div');
  headText.className = 'skill-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'Meet the agent';
  const sub = document.createElement('p');
  sub.className = 'skill-sub';
  sub.textContent =
    'Teach it a move or two — then hand it a task and see if its backpack covers the job.';
  headText.append(h2, sub);
  head.appendChild(headText);

  /* ---------- body: avatar+inventory | board+readiness ---------- */

  const body = document.createElement('div');
  body.className = 'skill-body';

  const left = document.createElement('div');
  left.className = 'skill-left';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'skill-avatar';
  avatarWrap.innerHTML = AVATAR_SVG;

  const inventory = document.createElement('div');
  inventory.className = 'skill-inventory';
  const invTop = document.createElement('div');
  invTop.className = 'skill-inv-top';
  const invHead = document.createElement('p');
  invHead.className = 'skill-inv-head';
  invHead.textContent = 'Skill inventory';
  const invCount = document.createElement('p');
  invCount.className = 'skill-inv-count';
  invTop.append(invHead, invCount);

  const empty = document.createElement('p');
  empty.className = 'skill-empty';
  empty.textContent = EMPTY_LINE;

  const cardList = document.createElement('ul');
  cardList.className = 'skill-cards';
  cardList.setAttribute('aria-label', 'Learned skills');

  inventory.append(invTop, empty, cardList);
  left.append(avatarWrap, inventory);

  const right = document.createElement('div');
  right.className = 'skill-right';

  const boardHead = document.createElement('p');
  boardHead.className = 'skill-board-head';
  boardHead.textContent = 'Task board';

  const taskList = document.createElement('div');
  taskList.className = 'skill-tasks';
  taskList.setAttribute('role', 'group');
  taskList.setAttribute('aria-label', 'Pick a task');
  const taskButtons: HTMLButtonElement[] = TASKS.map((task) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-task';
    const label = document.createElement('span');
    label.className = 'skill-task-label';
    label.textContent = task.label;
    const need = document.createElement('span');
    need.className = 'skill-task-need';
    need.textContent = `needs: ${SKILL_BY_ID.get(task.need)?.name ?? ''}`;
    btn.append(label, need);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      taskId = taskId === task.id ? null : task.id;
      render();
    });
    taskList.appendChild(btn);
    return btn;
  });

  const readiness = document.createElement('p');
  readiness.className = 'skill-readiness';
  readiness.setAttribute('aria-live', 'polite');

  right.append(boardHead, taskList, readiness);
  body.append(left, right);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const teachBtn = document.createElement('button');
  teachBtn.type = 'button';
  teachBtn.className = 'btn btn-primary skill-teach';
  teachBtn.textContent = 'Teach a skill';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(teachBtn, hint);

  teachBtn.addEventListener('click', () => {
    // Next unlearned skill in the fixed order (this is also what
    // makes forgetting one skill reopen its slot deterministically).
    const next = SKILLS.find((s) => !learned.has(s.id));
    if (!next) return;
    learned.add(next.id);
    render();
  });

  // Forget: one delegated listener — the cards are rebuilt on every
  // render, so per-card listeners would leak.
  cardList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('.skill-forget');
    if (!btn || !cardList.contains(btn)) return;
    const id = btn.dataset.forget;
    if (!id) return;
    learned.delete(id);
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const cardMarkup = (skill: Skill): string =>
    `<span class="skill-card-icon" aria-hidden="true">${skill.icon}</span>` +
    `<span class="skill-card-name">${skill.name}</span>` +
    `<span class="skill-badge">Learned!</span>` +
    `<button type="button" class="skill-forget" data-forget="${skill.id}">Forget</button>`;

  const render = () => {
    const needed = taskId ? TASKS.find((t) => t.id === taskId)?.need ?? null : null;

    // inventory (rebuilt per state — fixed data, so fully deterministic)
    const cards = SKILLS.filter((s) => learned.has(s.id));
    cardList.replaceChildren(
      ...cards.map((skill) => {
        const li = document.createElement('li');
        li.className =
          skill.id === needed ? 'skill-card skill-card--needed' : 'skill-card';
        li.innerHTML = cardMarkup(skill);
        return li;
      }),
    );
    empty.hidden = cards.length > 0;
    invCount.textContent = `${learned.size} / ${SKILLS.length}`;

    // the robot's chest lights: one per learned skill
    const lights = avatarWrap.querySelectorAll<SVGCircleElement>('.sk-light');
    lights.forEach((light, i) => light.classList.toggle('sk-light--on', i < learned.size));

    // tasks
    taskButtons.forEach((btn, i) =>
      btn.setAttribute('aria-pressed', String(TASKS[i].id === taskId)),
    );

    // readiness line
    const r = readinessOf(learned, taskId);
    if (r.status === 'ready') {
      readiness.replaceChildren(span('skill-status skill-status--ready', READY_LINE));
    } else if (r.status === 'missing') {
      readiness.replaceChildren(
        span('skill-status skill-status--missing', NOT_READY_LINE),
        span('skill-missing-detail', `Missing: ${r.skillName}`),
      );
    } else {
      readiness.replaceChildren(span('skill-status skill-status--idle', IDLE_LINE));
    }

    teachBtn.disabled = learned.size >= SKILLS.length;
    hint.textContent = teachHint(learned);
  };

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
    body: 'An agent is the model plus a backpack of practiced moves. Each skill you teach — browse, write code, summarize — is a move it can now attempt. Point it at a task and it checks its own backpack before starting.',
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: 'Readiness is a simple, honest check: does the agent have what this job needs? Get that check right and the agent can be trusted with the work it can do — and it will say so for the work it can\'t.',
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: 'Most agent skills are small playbooks, not new brains — "to summarize: read, then write the gist". That is why a skill takes a minute to teach, and the same minute to forget.',
  },
];

export function mountSkillExplain(root: HTMLElement): () => void {
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
