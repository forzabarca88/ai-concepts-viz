/**
 * MCP servers visualisation — DOM/CSS/SVG only (no canvas, no 3D, per
 * the Task 11 spec), so every control is jsdom-testable and
 * screenshot-frozen:
 *
 *  - three columns: Apps (ChatBot / CodePal) · the universal socket
 *    (a big USB-C-shaped port, inline SVG) · Server plugs
 *    (Files / Calendar / Maps);
 *  - each app keeps its OWN set of docked servers (the honest MCP
 *    model: every client configures its own servers), so the app
 *    picker and the plug buttons are both meaningful; the socket SVG
 *    shows the active app's docked plugs, one per slot, with its
 *    cable drawn to the final state only (no animated draw);
 *  - plugging a server into the active app adds a "connected: X" chip
 *    to that app's card and increments the "N tools ready" count;
 *    "Unplug all" clears the active app's sockets;
 *  - the status line ("N tools ready" + "No tools — just words." at
 *    zero) is one aria-live="polite" region; plugs are real buttons
 *    with aria-pressed;
 *  - the socket SVG is fully re-rendered per state with fixed
 *    geometry and no randomness (deterministic-everything);
 *  - each mount() returns a cleanup that removes its subtree.
 */

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

/* ---------- the socket SVG (fixed geometry, no measurement) ---------- */

const SVG_W = 240;
const SVG_H = 252;

/** Vertical centre of each of the three slots (top → bottom). */
const SLOT_CY = [46, 114, 182] as const;

/**
 * Build the full SVG inner markup for the current state. The block and
 * the three slots are always drawn; each docked server adds its plug
 * head (seated in its slot) plus its cable, drawn to the final state
 * only. Fully deterministic: fixed coordinates, no randomness.
 */
function buildSocket(docked: ReadonlySet<ServerId>): string {
  const block =
    `<rect class="mc-block" x="16" y="12" width="104" height="204" rx="20"/>` +
    `<text class="mc-portlabel" x="68" y="240" text-anchor="middle">USB-C</text>`;

  const slots = SLOT_CY.map((cy) => {
    return `<rect class="mc-slot" x="80" y="${cy - 12}" width="36" height="24" rx="12"/>`;
  }).join('');

  const plugs = SERVERS.filter((s) => docked.has(s.id))
    .map((s) => {
      const cy = SLOT_CY[SERVERS.indexOf(s)];
      return (
        `<g class="mc-docked">` +
        `<line class="mc-cable mc-cable--${s.id}" x1="152" y1="${cy}" x2="232" y2="${cy}"/>` +
        `<circle class="mc-cabledot mc-cabledot--${s.id}" cx="232" cy="${cy}" r="4.5"/>` +
        `<rect class="mc-plughead mc-plughead--${s.id}" x="84" y="${cy - 16}" width="68" height="32" rx="9"/>` +
        `<circle class="mc-led" cx="96" cy="${cy}" r="3.5"/>` +
        `</g>`
      );
    })
    .join('');

  return block + slots + plugs;
}

/* ============================================================
   The stage: apps | socket | server plugs, a status line and
   the "Unplug all" bar. One mount because everything shares
   state.
   ============================================================ */

export function mountMcpViz(root: HTMLElement): () => void {
  let activeApp: AppId = 'chatbot';
  /** Per-app docked servers — each app wires its own set. */
  const docked: Record<AppId, ServerId[]> = { chatbot: [], codepal: [] };

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

  // column 2 — the universal socket
  const socketCol = document.createElement('div');
  socketCol.className = 'mcp-col mcp-col--socket';
  const socketLabel = document.createElement('p');
  socketLabel.className = 'mcp-col-label';
  socketLabel.textContent = 'The socket';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mc-svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'The universal USB-C socket');
  socketCol.append(socketLabel, svg);

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

  /* ---------- stage bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const unplugBtn = document.createElement('button');
  unplugBtn.type = 'button';
  unplugBtn.className = 'btn btn-primary mcp-unplug';
  unplugBtn.textContent = 'Unplug all';
  const hint = document.createElement('span');
  hint.className = 'stage-bar-hint mcp-hint';
  bar.append(unplugBtn, hint);

  unplugBtn.addEventListener('click', () => {
    docked[activeApp] = [];
    render();
  });

  const togglePlug = (id: ServerId) => {
    const list = docked[activeApp];
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    render();
  };

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

    // socket: full re-render, fixed geometry
    svg.innerHTML = buildSocket(activeSet);

    // status line
    count.textContent = countText(activeIds.length);
    note.hidden = activeIds.length > 0;

    // hint
    const appName = APPS.find((a) => a.id === activeApp)!.name;
    hint.textContent =
      activeIds.length === 0
        ? 'Nothing plugged in — click a server on the right.'
        : `${appName} has ${countText(activeIds.length).replace(' ready', '')} — "Unplug all" clears this app.`;
  };

  render();

  stage.append(head, grid, statusline, bar);
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
