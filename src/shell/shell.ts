/**
 * Shell chrome — the persistent frame around every page:
 *
 *   .token-field  ambient mono word-chips (12 hardcoded positions,
 *                 60–120s CSS loops, frozen by the `.pw` protocol)
 *   .site-header  brand + grouped curriculum nav + mobile menu toggle
 *   main.page     filled by `renderPage()` (hero + .page-content + .pager)
 *   .site-footer  one line, full stop
 *
 * `renderShell(rootEl)` builds the frame once (app-lifetime). The router
 * then calls `ShellHandle.renderPage(page, routeName)` on every route
 * change, which fills `main.page` with the shared template and keeps the
 * nav's `aria-current="page"` in sync.
 *
 * `renderPage()` and `renderPageTemplate()` are also standalone so tests
 * (`src/test/mountPage.ts`) can render the real template without the
 * full chrome.
 */
import type { Page } from '../router';
import { navGroups, navItems } from './nav';

const HOME_ROUTE = 'home';

/** Curriculum order the pager walks: home, 01 … 10. */
const ORDER = [HOME_ROUTE, ...navItems.map((item) => item.route)];

export interface ShellHandle {
  /** The `main.page` element the page template renders into. */
  pageEl: HTMLElement;
  /** Fill the shared page template, sync nav `aria-current`. Returns the h1. */
  renderPage(page: Page, routeName: string): HTMLElement;
}

/** True under the Playwright freeze protocol (`<html class="pw">`). */
function isFrozen(): boolean {
  return document.documentElement.classList.contains('pw');
}

/**
 * Build the shell frame into `rootEl`: token field, header, empty
 * `main.page`, footer. The router clears the root when it stops.
 */
export function renderShell(rootEl: HTMLElement): ShellHandle {
  rootEl.innerHTML = '';
  rootEl.append(createTokenField(), createHeader());

  const main = document.createElement('main');
  main.className = 'page';
  rootEl.append(main, createFooter());

  const syncNavAriaCurrent = (routeName: string) => {
    const brand = rootEl.querySelector<HTMLElement>('.brand');
    rootEl
      .querySelectorAll<HTMLElement>('.nav-link')
      .forEach((link) => link.removeAttribute('aria-current'));
    if (routeName === HOME_ROUTE) {
      brand?.setAttribute('aria-current', 'page');
    } else {
      brand?.removeAttribute('aria-current');
      rootEl
        .querySelector<HTMLElement>(`.nav-link[href="#/${routeName}"]`)
        ?.setAttribute('aria-current', 'page');
    }
  };

  const toggle = rootEl.querySelector<HTMLButtonElement>('.nav-toggle');
  const nav = rootEl.querySelector<HTMLElement>('.site-nav');
  if (toggle && nav) {
    const setOpen = (open: boolean) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    };
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // On mobile the menu closes after choosing a stop.
    nav.addEventListener('click', (event) => {
      const target = event.target;
      if (
        nav.classList.contains('open') &&
        target instanceof Element &&
        target.closest('.nav-link')
      ) {
        setOpen(false);
      }
    });
  }

  return {
    pageEl: main,
    renderPage(page, routeName) {
      syncNavAriaCurrent(routeName);
      return renderPage(page, main, routeName);
    },
  };
}

/**
 * Fill a `main.page` element with the shared page template:
 * `.page-hero` (`.eyebrow`, `h1`, `.lede`) + `.page-content` host +
 * `.pager` (prev/next in curriculum order). Adds the `page-enter`
 * transition class, skipped under the `.pw` freeze. Returns the h1 for
 * focus management.
 */
export function renderPage(
  page: Page,
  pageEl: HTMLElement,
  routeName: string,
): HTMLElement {
  pageEl.innerHTML = '';
  pageEl.className = `page page--${routeName}`;

  const hero = document.createElement('header');
  hero.className = 'page-hero';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = page.eyebrow;

  const h1 = document.createElement('h1');
  h1.textContent = page.title;
  h1.tabIndex = -1;

  const lede = document.createElement('p');
  lede.className = 'lede';
  lede.textContent = page.lede;

  hero.append(eyebrow, h1, lede);

  const host = document.createElement('div');
  host.className = 'page-content';
  pageEl.append(hero, host);

  const pager = createPager(routeName);
  if (pager) pageEl.appendChild(pager);

  if (!isFrozen()) {
    pageEl.classList.add('page-enter');
    schedulePageEnterDone(pageEl);
  }
  return h1;
}

/**
 * Remove the enter class after the first paint(s) so the transition runs
 * exactly once. rAF is absent in some environments — fall back to a short
 * timeout (tests never observe this class).
 */
function schedulePageEnterDone(pageEl: HTMLElement): void {
  const done = () => pageEl.classList.remove('page-enter');
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(done));
  } else {
    setTimeout(done, 64);
  }
}

/**
 * Template renderer for callers without the full shell (e.g.
 * `src/test/mountPage.ts`): reuses a `main.page` direct child of `root`
 * when present, otherwise creates one. Kept export-compatible with the
 * original router's `renderPageTemplate(page, root, routeName)`.
 */
export function renderPageTemplate(
  page: Page,
  root: HTMLElement,
  routeName: string,
): HTMLElement {
  let pageEl = root.querySelector<HTMLElement>(':scope > main.page');
  if (!pageEl) {
    pageEl = document.createElement('main');
    root.appendChild(pageEl);
  }
  return renderPage(page, pageEl, routeName);
}

/** Course-order prev/next links. Returns null for unknown routes. */
function createPager(routeName: string): HTMLElement | null {
  const idx = ORDER.indexOf(routeName);
  if (idx === -1) return null;

  const nav = document.createElement('nav');
  nav.className = 'pager';
  nav.setAttribute('aria-label', 'Course order');

  const prevRoute = idx > 0 ? ORDER[idx - 1] : null;
  const nextRoute = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

  nav.appendChild(prevRoute ? pagerLink(prevRoute, 'prev') : pagerGap());
  nav.appendChild(nextRoute ? pagerLink(nextRoute, 'next') : pagerGap());
  return nav;
}

function pagerGap(): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'pager-gap';
  return span;
}

function pagerLink(route: string, direction: 'prev' | 'next'): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.className = `pager-link pager-${direction}`;
  anchor.href = route === HOME_ROUTE ? '#/' : `#/${route}`;
  const label =
    route === HOME_ROUTE ? 'Start' : pagerItem(route).number + ' · ' + pagerItem(route).title;
  anchor.textContent = direction === 'prev' ? `← ${label}` : `${label} →`;
  return anchor;
}

function pagerItem(route: string): { number: string; title: string } {
  return navItems.find((item) => item.route === route)!;
}

/**
 * 12 hardcoded ambient chips — fixed positions, 60–120s linear loops,
 * negative delays for organic spread. Paused at t=0 by the `.pw`
 * protocol, so screenshots always capture the base positions.
 *
 * Two chips carry a constellation accent (`token-chip--amber` / `--mint`).
 */
interface TokenChip {
  text: string;
  left: string;
  top: string;
  dur: string;
  delay: string;
  variant?: 'amber' | 'mint';
}

const TOKEN_CHIPS: readonly TokenChip[] = [
  { text: 'the', left: '6%', top: '18%', dur: '84s', delay: '-12s' },
  { text: 'tok_2941', left: '22%', top: '64%', dur: '66s', delay: '-30s', variant: 'amber' },
  { text: '…', left: '38%', top: '30%', dur: '120s', delay: '-5s' },
  { text: 'a', left: '52%', top: '78%', dur: '78s', delay: '-44s' },
  { text: 'model', left: '64%', top: '14%', dur: '96s', delay: '-21s' },
  { text: '…', left: '78%', top: '58%', dur: '60s', delay: '-9s' },
  { text: 'next', left: '12%', top: '86%', dur: '108s', delay: '-52s' },
  { text: 'tok_0007', left: '30%', top: '8%', dur: '88s', delay: '-37s' },
  { text: '…', left: '46%', top: '52%', dur: '72s', delay: '-15s', variant: 'mint' },
  { text: 'word', left: '70%', top: '84%', dur: '114s', delay: '-60s' },
  { text: '…', left: '88%', top: '30%', dur: '63s', delay: '-25s' },
  { text: 'tok_1832', left: '92%', top: '72%', dur: '99s', delay: '-41s' },
];

function createTokenField(): HTMLElement {
  const field = document.createElement('div');
  field.className = 'token-field';
  field.setAttribute('aria-hidden', 'true');
  for (const chip of TOKEN_CHIPS) {
    const span = document.createElement('span');
    span.className = chip.variant
      ? `token-chip token-chip--${chip.variant}`
      : 'token-chip';
    span.style.left = chip.left;
    span.style.top = chip.top;
    span.style.animationDuration = chip.dur;
    span.style.animationDelay = chip.delay;
    span.textContent = chip.text;
    field.appendChild(span);
  }
  return field;
}

function createHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'site-header';

  const bar = document.createElement('div');
  bar.className = 'site-header-bar';

  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '#/';
  const mark = document.createElement('span');
  mark.className = 'brand-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '✦';
  const name = document.createElement('span');
  name.className = 'brand-name';
  name.textContent = 'How Machines Talk';
  brand.append(mark, name);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'site-nav');
  toggle.textContent = 'Menu';

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.id = 'site-nav';
  nav.setAttribute('aria-label', 'Course sections');
  for (const group of navGroups) {
    const g = document.createElement('div');
    g.className = 'nav-group';
    const label = document.createElement('span');
    label.className = 'nav-group-label';
    label.textContent = group.label;
    const list = document.createElement('ul');
    list.className = 'nav-list';
    for (const item of group.items) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'nav-link';
      link.href = `#/${item.route}`;
      const num = document.createElement('span');
      num.className = 'nav-num';
      num.textContent = item.number;
      const title = document.createElement('span');
      title.className = 'nav-title';
      title.textContent = item.title;
      link.append(num, title);
      li.appendChild(link);
      list.appendChild(li);
    }
    g.append(label, list);
    nav.appendChild(g);
  }

  bar.append(brand, toggle);
  header.append(bar, nav);
  return header;
}

function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  const text = document.createElement('p');
  text.className = 'site-footer-text';
  text.textContent = 'How Machines Talk — a friendly tour of large language models.';
  footer.appendChild(text);
  return footer;
}
