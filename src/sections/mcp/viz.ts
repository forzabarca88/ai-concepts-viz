/**
 * MCP servers visualisation (Task 12) — "Ask the app" live replies +
 * 3D socket.
 *
 *  - three columns: Apps (ChatBot / CodePal) · the universal socket
 *    (a 3D USB-C-style plate with three slot rings, in a fixed-height
 *    `.mcp-canvas-wrap` column) · Server plugs (Files / Calendar /
 *    Maps);
 *  - each app keeps its OWN set of docked servers (the honest MCP
 *    model: every client configures its own servers), so the app
 *    picker and the plug buttons are both meaningful;
 *  - "Ask the app" (enabled iff the active app has ≥1 docked server)
 *    switches on the reply panel: a deterministic template,
 *    recomputed LIVE on every state change, joining one fixed clause
 *    per docked server in SERVERS order;
 *  - plugging a server into the active app adds a "connected: X" chip
 *    to that app's card and increments the "N tools ready" count;
 *    "Unplug all" clears the active app's sockets (and its ask);
 *  - the socket is a 3D scene built through the `createStageKit`
 *    kit (2D blit + context-loss rebuild) with `alpha: true`: a dim
 *    rounded-rectangle plate, three dim slot rings, and — per docked
 *    server — a colored plug cluster seated in its slot with a cable
 *    drawn to the right;
 *  - every visual state is mirrored in the DOM (chips, count, plug
 *    aria-pressed, reply, hint) — so every control keeps working in
 *    jsdom, where the canvas is replaced by `.viz-fallback`.
 */
import * as THREE from 'three';
import { addStarfield, createStageKit, makeGlowPoints } from '../../three/helpers';
import type { Stage3DHandle } from '../../three/helpers';

type AppId = 'chatbot' | 'codepal';

interface App {
  id: AppId;
  name: string;
  icon: string;
}

/** The two apps that can plug into the socket, in fixed order. */
const APPS: readonly App[] = [
  { id: 'chatbot', name: 'ChatBot', icon: '💬' },
  { id: 'codepal', name: 'CodePal', icon: '⌨️' },
];

type ServerId = 'files' | 'calendar' | 'maps';

interface Server {
  id: ServerId;
  name: string;
  icon: string;
}

/** The three server plugs, in fixed order (slot 0/1/2 top→bottom). */
const SERVERS: readonly Server[] = [
  { id: 'files', name: 'Files', icon: '📁' },
  { id: 'calendar', name: 'Calendar', icon: '📅' },
  { id: 'maps', name: 'Maps', icon: '🗺️' },
];

const NO_TOOLS_NOTE = 'No tools — just words.';

/** The count line: "0 tools ready" / "1 tool ready" / "N tools ready". */
function countText(n: number): string {
  if (n === 1) return '1 tool ready';
  return `${n} tools ready`;
}

/* ---------- the reply: a deterministic, live template ---------- */

/** One fixed clause per server, in SERVERS order. */
const REPLY_CLAUSE: Record<ServerId, string> = {
  files: 'the hike photos are in Hike 2024.zip',
  calendar: 'Saturday is free',
  maps: 'the trail is 8.4 miles',
};

/** Each app phrases the question its way. */
const REPLY_VERB: Record<AppId, string> = { chatbot: 'asked', codepal: 'checked' };

const REPLY_EMPTY = 'Nothing to ask yet — plug something in.';

/**
 * The reply for an app — a pure function of (app, docked set, asked):
 * `"{App} {verb} its tools: {clauses joined with "; "}.`" with the
 * clauses in fixed SERVERS order. The placeholder while nothing is
 * asked or nothing is docked.
 */
function replyFor(appId: AppId, dockedIds: readonly ServerId[], asked: boolean): string {
  if (!asked || dockedIds.length === 0) return REPLY_EMPTY;
  const clauses = SERVERS.filter((s) => dockedIds.includes(s.id)).map((s) => REPLY_CLAUSE[s.id]);
  const name = APPS.find((a) => a.id === appId)!.name;
  return `${name} ${REPLY_VERB[appId]} its tools: ${clauses.join('; ')}.`;
}

/* ============================================================
   The stage: apps | 3D socket | server plugs, a status line,
   the always-present reply panel and the Ask / Unplug bar.
   One mount because everything shares state.
   ============================================================ */

export function mountMcpViz(root: HTMLElement): () => void {
  let activeApp: AppId = 'chatbot';
  /** Per-app docked servers — each app wires its own set. */
  const docked: Record<AppId, ServerId[]> = { chatbot: [], codepal: [] };
  /** Per-app "has the user asked?" — set by Ask the app, reset by Unplug all. */
  const asked: Record<AppId, boolean> = { chatbot: false, codepal: false };

  const stage = document.createElement('section');
  stage.className = 'stage mcp-stage';
  stage.setAttribute('aria-label', 'MCP servers demo');

  /* ---------- head ---------- */

  const head = document.createElement('header');
  head.className = 'mcp-head';
  const headText = document.createElement('div');
  headText.className = 'mcp-head-text';
  const h2 = document.createElement('h2');
  h2.textContent = 'One socket, any tool';
  const sub = document.createElement('p');
  sub.className = 'mcp-sub';
  sub.textContent =
    'Plug a server into the standard port — the app on the other side picks up its tools.';
  headText.append(h2, sub);
  head.appendChild(headText);

  /* ---------- the three columns ---------- */

  const grid = document.createElement('div');
  grid.className = 'mcp-grid';

  // column 1 — apps
  const appsCol = document.createElement('div');
  appsCol.className = 'mcp-col mcp-col--apps';
  const appsLabel = document.createElement('p');
  appsLabel.className = 'mcp-col-label';
  appsLabel.textContent = 'Apps';
  const appsWrap = document.createElement('div');
  appsWrap.className = 'mcp-apps';
  appsWrap.setAttribute('role', 'group');
  appsWrap.setAttribute('aria-label', 'Pick an app');

  const appCards = new Map<AppId, { card: HTMLDivElement; btn: HTMLButtonElement; chips: HTMLSpanElement }>();
  for (const app of APPS) {
    const card = document.createElement('div');
    card.className = 'mcp-app';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcp-app-btn';
    const icon = document.createElement('span');
    icon.className = 'mcp-app-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = app.icon;
    const name = document.createElement('span');
    name.className = 'mcp-app-name';
    name.textContent = app.name;
    btn.append(icon, name);
    btn.setAttribute('aria-pressed', String(app.id === activeApp));
    btn.addEventListener('click', () => {
      activeApp = app.id;
      render();
    });
    const chips = document.createElement('span');
    chips.className = 'mcp-app-chips';
    // role="list" (+ "listitem" chips) so the container's aria-label is
    // actually announced — AT ignores aria-label on a bare span.
    chips.setAttribute('role', 'list');
    chips.setAttribute('aria-label', `${app.name} connected tools`);
    card.append(btn, chips);
    appsWrap.appendChild(card);
    appCards.set(app.id, { card, btn, chips });
  }
  appsCol.append(appsLabel, appsWrap);

  // column 2 — the universal socket (a 3D scene in a fixed 252px wrap;
  // the kit appends its canvas + blit inside, absolutely positioned)
  const socketCol = document.createElement('div');
  socketCol.className = 'mcp-col mcp-col--socket';
  const socketLabel = document.createElement('p');
  socketLabel.className = 'mcp-col-label';
  socketLabel.textContent = 'The socket';
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'mcp-canvas-wrap';
  socketCol.append(socketLabel, canvasWrap);

  // column 3 — server plugs
  const plugsCol = document.createElement('div');
  plugsCol.className = 'mcp-col mcp-col--plugs';
  const plugsLabel = document.createElement('p');
  plugsLabel.className = 'mcp-col-label';
  plugsLabel.textContent = 'Servers';
  const plugsWrap = document.createElement('div');
  plugsWrap.className = 'mcp-plugs';
  plugsWrap.setAttribute('role', 'group');
  plugsWrap.setAttribute('aria-label', 'Plug in a server');

  const plugButtons = new Map<ServerId, HTMLButtonElement>();
  for (const server of SERVERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mcp-plug mcp-plug--${server.id}`;
    const icon = document.createElement('span');
    icon.className = 'mcp-plug-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = server.icon;
    const name = document.createElement('span');
    name.className = 'mcp-plug-name';
    name.textContent = server.name;
    btn.append(icon, name);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => togglePlug(server.id));
    plugsWrap.appendChild(btn);
    plugButtons.set(server.id, btn);
  }
  plugsCol.append(plugsLabel, plugsWrap);

  grid.append(appsCol, socketCol, plugsCol);

  /* ---------- status line (one aria-live region) ---------- */

  const statusline = document.createElement('div');
  statusline.className = 'mcp-statusline';
  statusline.setAttribute('aria-live', 'polite');
  const count = document.createElement('span');
  count.className = 'mcp-count';
  const note = document.createElement('span');
  note.className = 'mcp-notetools';
  note.textContent = NO_TOOLS_NOTE;
  statusline.append(count, note);

  /* ---------- reply panel (always present, fixed min-height) ---------- */

  const reply = document.createElement('div');
  reply.className = 'mcp-reply';
  const replyLabel = document.createElement('p');
  replyLabel.className = 'mcp-reply-label';
  replyLabel.textContent = 'The reply';
  const replyText = document.createElement('p');
  replyText.className = 'mcp-reply-text';
  replyText.setAttribute('aria-live', 'polite');
  reply.append(replyLabel, replyText);

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const askBtn = document.createElement('button');
  askBtn.type = 'button';
  askBtn.className = 'btn btn-primary mcp-ask';
  askBtn.textContent = 'Ask the app';
  askBtn.disabled = true;
  const unplugBtn = document.createElement('button');
  unplugBtn.type = 'button';
  unplugBtn.className = 'btn btn-ghost mcp-unplug';
  unplugBtn.textContent = 'Unplug all';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint mcp-hint';
  bar.append(askBtn, unplugBtn, hint);

  askBtn.addEventListener('click', () => {
    if (docked[activeApp].length === 0) return; // disabled anyway
    asked[activeApp] = true;
    render();
  });

  unplugBtn.addEventListener('click', () => {
    docked[activeApp] = [];
    asked[activeApp] = false;
    render();
  });

  const togglePlug = (id: ServerId) => {
    const list = docked[activeApp];
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    render();
  };

  stage.append(head, grid, statusline, reply, bar);

  // The stage is in the document before the kit is created, so the
  // wrapper already has its final laid-out size (clientWidth/Height)
  // when the renderer buffer is sized — the scene aspect matches the
  // on-screen column in screenshots.
  root.appendChild(stage);

  /* ----- 3D socket (through the kit) -----
     The kit owns the 2D blit and the context-loss rebuild, so the
     section never hand-rolls them. `reapply` mirrors the current
     docked set onto the refs (and tolerates null refs — jsdom
     fallback). It reads the closure state at call time, which is
     what makes the post-context-loss rebuild re-apply correctly. */
  const applySocket = (refs: SocketRefs | null): void => {
    if (!refs) return; // jsdom / no-WebGL — the DOM mirror carries the state
    refs.apply(new Set(docked[activeApp]));
  };

  const kit = createStageKit({
    wrapper: canvasWrap,
    stageOpts: {
      seed: 20260412,
      camera: { position: [0, 0, 8], fov: 40 },
      alpha: true,
    },
    build: (h) => buildSocketScene(h),
    reapply: (refs) => applySocket(refs as SocketRefs | null),
  });

  /* ---------- render: every visual state is a pure function ---------- */

  const render = () => {
    const activeIds = docked[activeApp];
    const activeSet = new Set(activeIds);

    // app cards: active app lit; chips = that app's own docked servers
    for (const app of APPS) {
      const { card, btn, chips } = appCards.get(app.id)!;
      const isActive = app.id === activeApp;
      card.classList.toggle('mcp-app--active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
      chips.replaceChildren(
        ...docked[app.id].map((sid) => {
          const server = SERVERS.find((s) => s.id === sid)!;
          const chip = document.createElement('span');
          chip.className = 'chip mcp-chip';
          chip.setAttribute('role', 'listitem');
          chip.textContent = `connected: ${server.name}`;
          return chip;
        }),
      );
    }

    // plug buttons reflect the ACTIVE app's sockets
    for (const server of SERVERS) {
      plugButtons.get(server.id)!.setAttribute('aria-pressed', String(activeSet.has(server.id)));
    }

    // status line
    count.textContent = countText(activeIds.length);
    note.hidden = activeIds.length > 0;

    // Ask: enabled iff the active app has something docked
    askBtn.disabled = activeIds.length === 0;

    // reply: the deterministic template, recomputed live
    const text = replyFor(activeApp, activeIds, asked[activeApp]);
    replyText.textContent = text;
    replyText.classList.toggle('mcp-reply-text--empty', text === REPLY_EMPTY);

    // hint
    const appName = APPS.find((a) => a.id === activeApp)!.name;
    hint.textContent =
      activeIds.length === 0
        ? 'Nothing plugged in — click a server on the right.'
        : `${appName} has ${countText(activeIds.length).replace(' ready', '')} — "Unplug all" clears this app.`;

    // 3D mirror + blit
    applySocket(kit.refs as SocketRefs | null);
    kit.render();
  };

  render();

  return () => {
    kit.dispose();
    stage.remove();
  };
}

/* ============================================================
   3D socket: a dim rounded-rectangle plate, three dim slot
   rings, and per-docked-server plug clusters with cables.
   ============================================================ */

interface SocketRefs {
  /** Seat/unseat each server's plug + cable for the docked set. */
  apply(docked: ReadonlySet<ServerId>): void;
}

/* Point budget: 236 plate + 3×40 rings + 3×(80 cluster + 24 cable)
   plugs + 80 starfield. */
const PLATE_ROWS = 12;
const PLATE_COLS = 20;
/** The plate's x/y span (world units) — its right edge is x = 0.9. */
const PLATE_X: readonly [number, number] = [-1.9, 0.9];
const PLATE_Y: readonly [number, number] = [-1.4, 1.4];
const PLATE_SIZE = 0.05;
const PLATE_HEX = '#22304F';
const RING_POINTS = 40;
const RING_RADIUS = 0.35;
const RING_SIZE = 0.08;
const RING_HEX = '#33405F';
/** Slot position: the plate's right edge, top→bottom = SERVERS order. */
const SLOT_X = 0.9;
const SLOT_Y: readonly number[] = [0.9, 0, -0.9];
const PLUG_POINTS = 80;
const PLUG_RADIUS = 0.3;
const PLUG_SIZE = 0.14;
const CABLE_POINTS = 24;
const CABLE_X: readonly [number, number] = [1.2, 2.6];
const CABLE_SIZE = 0.1;
/** Server signal colours (3D scene — matches the DOM plug glow). */
const SERVER_HEX: Record<ServerId, string> = {
  files: '#FFB020',
  calendar: '#FF6B5E',
  maps: '#22C48E',
};

function buildSocketScene(handle: Stage3DHandle): SocketRefs | null {
  const scene = handle.scene;
  if (!scene) return null;
  const { rand } = handle;

  /** A constant per-point color array (makeGlowPoints needs one per point). */
  const fill = (hex: string, n: number): Float32Array => {
    const c = new THREE.Color(hex);
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      out[i * 3] = c.r;
      out[i * 3 + 1] = c.g;
      out[i * 3 + 2] = c.b;
    }
    return out;
  };

  /* 1 — the socket block: a flat 12×20 grid in the camera-facing
     xy-plane. Rounded rectangle: each 2×2 corner block drops its far
     diagonal point (grid-unit radius 1) — 240 → 236 points. No
     rand() calls. */
  const dx = (PLATE_X[1] - PLATE_X[0]) / (PLATE_COLS - 1);
  const dy = (PLATE_Y[1] - PLATE_Y[0]) / (PLATE_ROWS - 1);
  const platePts: number[] = [];
  for (let r = 0; r < PLATE_ROWS; r++) {
    for (let c = 0; c < PLATE_COLS; c++) {
      const inCornerBlock =
        (r <= 1 && c <= 1) ||
        (r <= 1 && c >= PLATE_COLS - 2) ||
        (r >= PLATE_ROWS - 2 && c <= 1) ||
        (r >= PLATE_ROWS - 2 && c >= PLATE_COLS - 2);
      if (inCornerBlock && Math.hypot(Math.min(r, PLATE_ROWS - 1 - r), Math.min(c, PLATE_COLS - 1 - c)) > 1) {
        continue; // the far diagonal of a corner block — cuts the corner
      }
      platePts.push(PLATE_X[0] + c * dx, PLATE_Y[0] + r * dy, 0);
    }
  }
  scene.add(
    makeGlowPoints(Float32Array.from(platePts), fill(PLATE_HEX, platePts.length / 3), PLATE_SIZE),
  );

  /* 2 — the three slot rings (top → bottom = files / calendar / maps).
     Evenly spaced angles; two rand() calls per point (radial jitter,
     z jitter), consumed in order. */
  for (const cy of SLOT_Y) {
    const positions = new Float32Array(RING_POINTS * 3);
    for (let i = 0; i < RING_POINTS; i++) {
      const theta = (i / RING_POINTS) * Math.PI * 2;
      const r = RING_RADIUS + (rand() - 0.5) * 0.06;
      const z = (rand() - 0.5) * 0.06;
      positions[i * 3] = SLOT_X + r * Math.cos(theta);
      positions[i * 3 + 1] = cy + r * Math.sin(theta);
      positions[i * 3 + 2] = z;
    }
    scene.add(makeGlowPoints(positions, fill(RING_HEX, RING_POINTS), RING_SIZE));
  }

  /* 3 — the plugs: all three are built (files → calendar → maps),
     each a seeded sphere cluster seated in its slot plus a straight
     cable from the cluster edge to x = 2.6, all in the server's
     colour. Built hidden; `apply()` seats the docked ones.
     Sphere offsets use three rand() calls per point (theta, phi,
     cube-root radius) — the house seeded-sphere order. */
  const sphereOffsets = (count: number, radius: number): Float32Array => {
    const offsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
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

  const plugs = SERVERS.map((server, i) => {
    const hex = SERVER_HEX[server.id];
    const cy = SLOT_Y[i];

    const offsets = sphereOffsets(PLUG_POINTS, PLUG_RADIUS);
    const positions = new Float32Array(PLUG_POINTS * 3);
    for (let j = 0; j < PLUG_POINTS; j++) {
      positions[j * 3] = SLOT_X + offsets[j * 3];
      positions[j * 3 + 1] = cy + offsets[j * 3 + 1];
      positions[j * 3 + 2] = offsets[j * 3 + 2];
    }
    const cluster = makeGlowPoints(positions, fill(hex, PLUG_POINTS), PLUG_SIZE);

    const cablePositions = new Float32Array(CABLE_POINTS * 3);
    for (let j = 0; j < CABLE_POINTS; j++) {
      cablePositions[j * 3] = CABLE_X[0] + (j / (CABLE_POINTS - 1)) * (CABLE_X[1] - CABLE_X[0]);
      cablePositions[j * 3 + 1] = cy;
      cablePositions[j * 3 + 2] = 0;
    }
    const cable = makeGlowPoints(cablePositions, fill(hex, CABLE_POINTS), CABLE_SIZE);

    cluster.visible = false;
    cable.visible = false;
    scene.add(cluster);
    scene.add(cable);
    return { cluster, cable };
  });

  /* 4 — the ambient starfield (2 rand() calls/point, in order). */
  addStarfield(handle, 80, 7, '#22304F');

  /* ----- state application (immediate — the frozen protocol has no
     tweens) ----- */
  let appliedKey = '';
  return {
    apply(docked) {
      const key = SERVERS.map((s) => (docked.has(s.id) ? '1' : '0')).join('');
      if (key === appliedKey) return;
      appliedKey = key;
      plugs.forEach((plug, i) => {
        const on = docked.has(SERVERS[i].id);
        plug.cluster.visible = on;
        plug.cable.visible = on;
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
    body: 'A server that speaks Model Context Protocol (MCP) is a tool that talks one standard language. Any app plugs into the same socket and instantly gets to use it — its files, its calendar, its maps. No new wiring for each pair.',
  },
  {
    glyph: '¶',
    title: 'Why it matters',
    body: "Before MCP, every app needed a custom connector for every tool — two apps and three tools meant six hand-built bridges. One standard port turns that grid into a simple list: any tool fits any model, so adding a third app needs zero new wiring.",
  },
  {
    glyph: '✦',
    title: 'Fun fact',
    body: "USB-C won because it was boring on purpose: one shape, one ruleset, everything just fits. MCP makes the same bet for AI tools — the port matters more than any single plug.",
  },
];

export function mountMcpExplain(root: HTMLElement): () => void {
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
