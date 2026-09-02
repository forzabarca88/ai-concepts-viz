/**
 * Hash router.
 *
 * Every page lives at `src/sections/<name>/page.ts` and exports a `page`
 * constant implementing the {@link Page} contract below. The folder name
 * IS the route: `#/data` → `src/sections/data/page.ts`; `#/` (or no hash)
 * → `home`.
 *
 * Contract (later tasks depend on it — do not change the shape):
 *  - `page.mount(root)` renders the section into `root` and MUST return
 *    a cleanup function (dispose Three.js scenes, remove listeners, …).
 *  - `startRouter()` builds the shell chrome (header, footer, token
 *    field — see `src/shell/shell.ts`), renders the current route, re-
 *    renders on `hashchange`, and calls the previous page's cleanup on
 *    every route change. It returns a stop function (removes the
 *    listener, runs the pending cleanup).
 *
 * The shared page template (`.page > .page-hero + .page-content +
 * .pager`) lives in the shell: re-exported below as
 * `renderPageTemplate` so `src/test/mountPage.ts` keeps working.
 */

import { renderShell } from './shell/shell';

export { renderPageTemplate } from './shell/shell';

export interface Page {
  /** h1 */
  title: string;
  /** e.g. "02 · Core ideas" */
  eyebrow: string;
  /** One plain-English sentence. */
  lede: string;
  /** Render the section into `root`. MUST return a cleanup function. */
  mount(root: HTMLElement): () => void;
}

/* Auto-discover sections: folder name = route name. */
const modules = import.meta.glob('./sections/*/page.ts', {
  eager: true,
}) as Record<string, { page: Page }>;

/** Route name → page, e.g. `{ home: Page, data: Page, … }`. */
export const routes: Record<string, Page> = {};
for (const [path, mod] of Object.entries(modules)) {
  const name = path.split('/')[2];
  if (name) routes[name] = mod.page;
}

/** Resolve a hash to a route name. `''`, `'#'` and `'#/'` → `home`. */
export function routeFromHash(hash: string = window.location.hash): string {
  const name = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  return name || 'home';
}

const fallbackPage: Page = {
  title: 'Page not found',
  eyebrow: 'Lost a token',
  lede: 'That page doesn’t exist — but every other one does.',
  mount(root) {
    const link = document.createElement('a');
    link.className = 'btn btn-primary';
    link.href = '#/';
    link.textContent = 'Back to the start';
    root.appendChild(link);
    return () => {
      link.remove();
    };
  },
};

/**
 * Boot the router into `rootEl` (default: `#app`) and render the
 * current route. Builds the shell chrome once, then fills `main.page`
 * per route. Returns a stop function.
 */
export function startRouter(
  rootEl: HTMLElement = document.getElementById('app') as HTMLElement,
): () => void {
  let cleanup: (() => void) | null = null;
  let firstRender = true;
  const shell = renderShell(rootEl);

  const render = () => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    const name = routeFromHash();
    const known = name in routes;
    const page = known ? (routes[name] as Page) : fallbackPage;

    document.title = `${page.title} · How Machines Talk`;
    const h1 = shell.renderPage(page, known ? name : 'not-found');
    const host = rootEl.querySelector<HTMLElement>('.page-content');
    if (host) cleanup = page.mount(host);

    // Scroll/focus management: new page starts at the top; on in-app
    // navigation keyboard focus lands on the h1. The very first render
    // deliberately takes no focus — on a fresh document load the browser
    // owns focus, and a script focus would paint a :focus-visible ring
    // into every screenshot.
    if (window.visualViewport) window.scrollTo(0, 0);
    if (!firstRender) h1.focus({ preventScroll: true });
    firstRender = false;
  };

  window.addEventListener('hashchange', render);
  render();

  return () => {
    window.removeEventListener('hashchange', render);
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    rootEl.innerHTML = '';
  };
}
