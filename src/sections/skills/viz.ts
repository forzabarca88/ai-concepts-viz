/**
 * Skills visualisation (Task 11) — "pick which skill to teach +
 * 'Try the task' results + 3D skill dock".
 *
 *  - three teach cards (Browse the web 🌐 / Write code 💻 / Summarize
 *    📝) replace the blind "Teach a skill" cycle — the user picks
 *    which skill to teach, in any order; each card's `Teach` button
 *    carries `aria-pressed = learned`; the inventory keeps the
 *    "Learned!" badge and the real "Forget" button;
 *  - the task board (three fixed tasks) gains a `Try the task`
 *    primary button whenever the selected task is ready; pressing it
 *    appends the task's fixed result line to the always-present
 *    results area (fixed `min-height`, so the stage never resizes);
 *    the tried task's card shows an aria-hidden `Done ✓` badge and
 *    its Try button locks;
 *  - forgetting a skill also un-tries its task (the task leaves
 *    `triedTasks` and its result line is cleared);
 *  - behind the DOM UI sits the 3D "skill dock" layer
 *    (`.skill-canvas-wrap.stage-3d-layer`): a core orb at the center
 *    plus three skill orbs that sit far and dim until learned, then
 *    dock close in their own skill color. Built through the
 *    `createStageKit` resilience kit (2D blit + context-loss rebuild)
 *    with `alpha: true`, so the stage's CSS gradient shows through
 *    the transparent canvas.
 *
 * ALL state is mirrored in the DOM (teach cards, inventory, badges,
 * readiness, results, hints) — so every control keeps working in
 * jsdom, where the canvas is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

interface Skill {
  id: string;
  name: string;
  icon: string;
}

/** The three teachable skills, in the fixed teach-card order. */
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

/** The fixed result line each task prints when it is tried. */
const TASK_RESULTS: ReadonlyMap<string, string> = new Map([
  [
    'trail',
    'It opened three tabs, compared reviews and settled on: Maple Ridge, 8.4 miles, one good chocolate shop at the trailhead.',
  ],
  [
    'script',
    'It wrote a 6-line script, ran it on a test folder, then ran it for real. All 41 files renamed.',
  ],
  [
    'article',
    'It read the 4,000-word article and replied with three bullets. You can argue with bullet two.',
  ],
]);

const EMPTY_LINE = 'No skills yet — just a very smart mind';
const IDLE_LINE = 'Pick a task to check.';
const READY_LINE = 'Ready! 🎒';
const NOT_READY_LINE = 'Not ready';
const RESULTS_EMPTY = 'No results yet — teach it a skill, pick a task, then try it.';

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

/** Stage-bar hint — a pure function of the learned set. */
function teachHint(learned: ReadonlySet<string>): string {
  if (learned.size >= SKILLS.length) return 'All 3 skills learned — the backpack is full.';
  if (learned.size === 0) return 'Teach a skill — pick which one first.';
  return `The backpack holds ${learned.size} of ${SKILLS.length} skills.`;
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
   The stage: teach cards | avatar+inventory · board+readiness
   +results, and the hint bar. One mount because everything
   shares state.
   ============================================================ */

export function mountSkillViz(root: HTMLElement): () => void {
  const learned = new Set<string>();
  let taskId: string | null = null;
  const triedTasks = new Set<string>(); // tried in press order (Set = insertion order)

  const stage = document.createElement('section');
  stage.className = 'stage skill-stage';
  stage.setAttribute('aria-label', 'Agent skills demo');

  /* 3D layer: the kit owns canvas + blit inside this absolute-fill
     wrapper, behind the stage UI (shared `.stage-3d-layer` utility). */
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'skill-canvas-wrap stage-3d-layer';

  /* ---------- head ---------- */

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

  /* ---------- teach cards (pick which skill, in any order) ---------- */

  const teachRow = document.createElement('div');
  teachRow.className = 'skill-teach-row';
  teachRow.setAttribute('role', 'group');
  teachRow.setAttribute('aria-label', 'Teach a skill');
  const teachCards: HTMLElement[] = [];
  const teachButtons: HTMLButtonElement[] = [];
  SKILLS.forEach((skill) => {
    const card = document.createElement('div');
    card.className = 'skill-teach-card';
    const icon = document.createElement('span');
    icon.className = 'skill-teach-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = skill.icon;
    const name = document.createElement('span');
    name.className = 'skill-teach-name';
    name.textContent = skill.name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-teach';
    btn.textContent = 'Teach';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (learned.has(skill.id)) return; // teaching twice is a no-op
      learned.add(skill.id);
      render();
    });
    card.append(icon, name, btn);
    teachRow.appendChild(card);
    teachCards.push(card);
    teachButtons.push(btn);
  });

  /* ---------- body: avatar+inventory | board+readiness+results ---------- */

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
  const taskButtons: HTMLButtonElement[] = [];
  const taskDones: HTMLElement[] = [];
  TASKS.forEach((task) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-task';
    const label = document.createElement('span');
    label.className = 'skill-task-label';
    label.textContent = task.label;
    const done = document.createElement('span');
    done.className = 'skill-task-done';
    done.setAttribute('aria-hidden', 'true'); // keep the button's accessible name stable
    done.hidden = true;
    done.textContent = 'Done ✓';
    const need = document.createElement('span');
    need.className = 'skill-task-need';
    need.textContent = `needs: ${SKILL_BY_ID.get(task.need)?.name ?? ''}`;
    btn.append(label, done, need);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      taskId = taskId === task.id ? null : task.id;
      render();
    });
    taskList.appendChild(btn);
    taskButtons.push(btn);
    taskDones.push(done);
  });

  const readiness = document.createElement('div');
  readiness.className = 'skill-readiness';
  readiness.setAttribute('aria-live', 'polite');

  const tryBtn = document.createElement('button');
  tryBtn.type = 'button';
  tryBtn.className = 'btn btn-primary skill-try';
  tryBtn.textContent = 'Try the task';
  tryBtn.hidden = true;
  tryBtn.addEventListener('click', () => {
    if (!taskId || triedTasks.has(taskId)) return;
    triedTasks.add(taskId);
    render();
  });

  /* results — always present, fixed min-height (the stage and the
     3D canvas behind it never resize between states). */
  const results = document.createElement('div');
  results.className = 'skill-results';
  const resultsHead = document.createElement('p');
  resultsHead.className = 'skill-results-head';
  resultsHead.textContent = 'Task results';
  const resultsEmpty = document.createElement('p');
  resultsEmpty.className = 'skill-results-empty';
  resultsEmpty.textContent = RESULTS_EMPTY;
  const resultList = document.createElement('ul');
  resultList.className = 'skill-result-list';
  results.append(resultsHead, resultsEmpty, resultList);

  right.append(boardHead, taskList, readiness, results);
  body.append(left, right);

  /* ---------- stage bar: the hint (a pure function of `learned`) ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint';
  bar.append(hint);

  // Forget: one delegated listener — the cards are rebuilt on every
  // render, so per-card listeners would leak. Forgetting a skill also
  // un-tries its task (result line cleared).
  cardList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('.skill-forget');
    if (!btn || !cardList.contains(btn)) return;
    const id = btn.dataset.forget;
    if (!id) return;
    learned.delete(id);
    for (const t of TASKS) {
      if (t.need === id) triedTasks.delete(t.id);
    }
    render();
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const cardMarkup = (skill: Skill): string =>
    `<span class="skill-card-icon" aria-hidden="true">${skill.icon}</span>` +
    `<span class="skill-card-name">${skill.name}</span>` +
    `<span class="skill-badge">Learned!</span>` +
    `<button type="button" class="skill-forget" data-forget="${skill.id}">Forget</button>`;

  const render = () => {
    // teach cards
    SKILLS.forEach((skill, i) => {
      const isLearned = learned.has(skill.id);
      teachButtons[i].setAttribute('aria-pressed', String(isLearned));
      teachCards[i].classList.toggle('skill-teach-card--learned', isLearned);
    });

    // inventory (rebuilt per state — fixed data, so fully deterministic)
    const cards = SKILLS.filter((s) => learned.has(s.id));
    cardList.replaceChildren(
      ...cards.map((skill) => {
        const li = document.createElement('li');
        li.className =
          skill.id === (taskId ? TASKS.find((t) => t.id === taskId)?.need ?? null : null)
            ? 'skill-card skill-card--needed'
            : 'skill-card';
        li.innerHTML = cardMarkup(skill);
        return li;
      }),
    );
    empty.hidden = cards.length > 0;
    invCount.textContent = `${learned.size} / ${SKILLS.length}`;

    // the robot's chest lights: one per learned skill
    const lights = avatarWrap.querySelectorAll<SVGCircleElement>('.sk-light');
    lights.forEach((light, i) => light.classList.toggle('sk-light--on', i < learned.size));

    // tasks + their (aria-hidden) Done badges
    taskButtons.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', String(TASKS[i].id === taskId));
      taskDones[i].hidden = !triedTasks.has(TASKS[i].id);
    });

    // readiness line + the Try button (present only when ready)
    const r = readinessOf(learned, taskId);
    if (r.status === 'ready') {
      tryBtn.hidden = false;
      tryBtn.disabled = !!taskId && triedTasks.has(taskId);
      readiness.replaceChildren(span('skill-status skill-status--ready', READY_LINE), tryBtn);
    } else if (r.status === 'missing') {
      tryBtn.hidden = true;
      readiness.replaceChildren(
        span('skill-status skill-status--missing', NOT_READY_LINE),
        span('skill-missing-detail', `Missing: ${r.skillName}`),
      );
    } else {
      tryBtn.hidden = true;
      readiness.replaceChildren(span('skill-status skill-status--idle', IDLE_LINE));
    }

    // results (triedTasks keeps press order — a pure function of clicks)
    resultsEmpty.hidden = triedTasks.size > 0;
    resultList.replaceChildren(
      ...Array.from(triedTasks).map((id) => {
        const li = document.createElement('li');
        li.className = 'skill-result-line';
        li.textContent = TASK_RESULTS.get(id) ?? '';
        return li;
      }),
    );

    hint.textContent = teachHint(learned);

    applyDock(kit.refs as DockRefs | null);
    kit.render();
  };

  /* ----- 3D skill dock (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     learned set onto the refs (and tolerates null refs — jsdom
     fallback). It reads the closure state at call time, which is
     what makes the post-context-loss rebuild re-apply correctly. */
  const applyDock = (refs: DockRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.apply(learned);
  };

  stage.append(canvasWrap, head, teachRow, body, bar);

  // The stage is in the document before the kit is created, so the
  // wrapper already has its final laid-out size (clientWidth/Height)
  // when the renderer buffer is sized — the dock's orbs render at the
  // stage's real aspect instead of the 960×540 detached fallback.
  root.appendChild(stage);

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260411,
      camera: { position: [0, 0.2, 8.5], fov: 45 },
      alpha: true,
    },
    build: (h) => buildDockScene(h),
    reapply: (refs) => applyDock(refs as DockRefs | null),
  });

  /* ---------- initial paint ---------- */
  render();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ============================================================
   3D skill dock: a core orb at the center and three skill orbs
   that park far and dim until learned, then dock close in their
   own skill color.
   ============================================================ */

interface DockRefs {
  /** Park each skill orb (far/dim or docked/colored) for the learned set. */
  apply(learned: ReadonlySet<string>): void;
}

/* Point budget: 90 core + 3 × 90 skill orbs + 100 starfield. */
const CORE_COUNT = 90;
const CORE_RADIUS = 0.6;
const SKILL_ORB_COUNT = 90;
const SKILL_ORB_RADIUS = 0.45;
const ORBIT_RADIUS = 3.4; // unlearned: far out on the orbit, dim
const DOCK_RADIUS = 1.6; // learned: docked close, full opacity
/** Skill-orb dock angles (deg, xz-plane) — browse / code / summarize. */
const ORB_ANGLES_DEG: readonly number[] = [90, 210, 330];
const ORB_DIM = '#4A5878';
const SKILL_ORB_COLORS: readonly string[] = ['#6E85FF', '#FFB020', '#22C48E'];

function buildDockScene(handle: Stage3DHandle): DockRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /* ----- seeded sphere offsets -----
     rand() consumption order is frozen: for each point, (1) theta,
     (2) phi (acos(2r − 1)), (3) radius (cube-root for a uniform
     volume fill) — three calls per point: 90 core, then 90 × 3
     skill orbs in browse → code → summarize order, then the
     starfield (2 calls/point). Any change here shifts every point. */
  const sphereOffsets = (count: number, radius: number): Float32Array => {
    const offsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = radius * Math.cbrt(rand());
      const sinPhi = Math.sin(phi);
      offsets[i * 3] = r * sinPhi * Math.cos(theta);
      offsets[i * 3 + 1] = r * Math.cos(phi);
      offsets[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    }
    return offsets;
  };

  /* ----- core orb: the agent's mind at the dock's center ----- */
  const coreColor = new THREE.Color('#6E85FF');
  const coreColors = new Float32Array(CORE_COUNT * 3);
  const coreOffsets = sphereOffsets(CORE_COUNT, CORE_RADIUS);
  for (let i = 0; i < CORE_COUNT; i += 1) {
    coreColors[i * 3] = coreColor.r;
    coreColors[i * 3 + 1] = coreColor.g;
    coreColors[i * 3 + 2] = coreColor.b;
  }
  scene.add(makeGlowPoints(coreOffsets, coreColors, 0.15));

  /* ----- three skill orbs -----
     Each orb is stored as seeded offsets from the dock center;
     `apply()` parks the whole orb at its fixed angle, either on the
     far orbit (unlearned, dim) or at the dock (learned, skill color). */
  const orbData = SKILLS.map((skill, i) => {
    const offsets = sphereOffsets(SKILL_ORB_COUNT, SKILL_ORB_RADIUS);
    const positions = new Float32Array(SKILL_ORB_COUNT * 3);
    const colors = new Float32Array(SKILL_ORB_COUNT * 3);
    const points = makeGlowPoints(positions, colors, 0.12, 0.6);
    scene.add(points);
    return {
      skill,
      offsets,
      positions,
      colors,
      angle: (ORB_ANGLES_DEG[i] * Math.PI) / 180,
      posAttr: points.geometry.getAttribute('position') as THREE.BufferAttribute,
      colAttr: points.geometry.getAttribute('color') as THREE.BufferAttribute,
      material: points.material as THREE.PointsMaterial,
    };
  });

  addStarfield(handle, 100, 8, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  const dimColor = new THREE.Color(ORB_DIM);
  const learnedColors = SKILL_ORB_COLORS.map((hex) => new THREE.Color(hex));
  let appliedKey = '';
  return {
    apply(learned) {
      const key = SKILLS.map((s) => (learned.has(s.id) ? '1' : '0')).join('');
      if (key === appliedKey) return;
      appliedKey = key;
      orbData.forEach((orb, i) => {
        const isLearned = learned.has(orb.skill.id);
        const radius = isLearned ? DOCK_RADIUS : ORBIT_RADIUS;
        const cx = radius * Math.cos(orb.angle);
        const cz = radius * Math.sin(orb.angle);
        const color = isLearned ? learnedColors[i] : dimColor;
        for (let j = 0; j < SKILL_ORB_COUNT; j += 1) {
          orb.positions[j * 3] = cx + orb.offsets[j * 3];
          orb.positions[j * 3 + 1] = orb.offsets[j * 3 + 1];
          orb.positions[j * 3 + 2] = cz + orb.offsets[j * 3 + 2];
          orb.colors[j * 3] = color.r;
          orb.colors[j * 3 + 1] = color.g;
          orb.colors[j * 3 + 2] = color.b;
        }
        orb.material.opacity = isLearned ? 1 : 0.6;
        orb.posAttr.needsUpdate = true;
        orb.colAttr.needsUpdate = true;
      });
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
