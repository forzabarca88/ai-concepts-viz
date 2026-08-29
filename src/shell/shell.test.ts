import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startRouter } from '../router';
import { navGroups, navItems } from './nav';
import { renderShell } from './shell';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const setHash = async (hash: string) => {
  window.location.hash = hash;
  // jsdom delivers hashchange on a macrotask — flush it.
  await tick();
};

describe('renderShell', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="shell-host"></div>';
    host = document.getElementById('shell-host') as HTMLDivElement;
  });

  it('renders brand, grouped nav, token field and footer', () => {
    const shell = renderShell(host);

    const brand = host.querySelector<HTMLAnchorElement>('.brand');
    expect(brand?.getAttribute('href')).toBe('#/');
    expect(brand?.textContent).toContain('How Machines Talk');

    const labels = [...host.querySelectorAll<HTMLElement>('.nav-group-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(navGroups.map((group) => group.label));

    const links = [...host.querySelectorAll<HTMLAnchorElement>('.nav-link')];
    expect(links).toHaveLength(navItems.length);
    links.forEach((link, i) => {
      expect(link.getAttribute('href')).toBe(`#/${navItems[i].route}`);
      expect(link.textContent).toContain(navItems[i].number);
      expect(link.textContent).toContain(navItems[i].title);
    });

    const field = host.querySelector('.token-field');
    expect(field?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.token-chip')).toHaveLength(12);

    expect(host.querySelector('.site-footer-text')?.textContent).toBe(
      'How Machines Talk — a friendly tour of large language models.',
    );
    expect(shell.pageEl.classList.contains('page')).toBe(true);
  });

  it('fills the page template and syncs aria-current to the route', () => {
    const shell = renderShell(host);
    const sectionPage = {
      title: 'Some section',
      eyebrow: '01 · Core ideas',
      lede: 'A lede.',
      mount: (root: HTMLElement) => {
        root.textContent = 'content';
        return () => {
          root.textContent = '';
        };
      },
    };
    shell.renderPage(sectionPage, 'data');
    sectionPage.mount(host.querySelector('.page-content') as HTMLElement);

    expect(host.querySelector('h1')?.textContent).toBe('Some section');
    expect(host.querySelector('.page')?.className).toContain('page--data');
    expect(host.querySelector('.page-content')?.textContent).toBe('content');

    expect(host.querySelector('.nav-link[href="#/data"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(host.querySelectorAll('.nav-link[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelector('.brand')?.hasAttribute('aria-current')).toBe(false);
  });

  it('mobile toggle expands and collapses the nav', () => {
    renderShell(host);
    const toggle = host.querySelector<HTMLButtonElement>('.nav-toggle');
    const nav = host.querySelector<HTMLElement>('.site-nav');

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(nav?.classList.contains('open')).toBe(false);

    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(nav?.classList.contains('open')).toBe(true);

    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(nav?.classList.contains('open')).toBe(false);
  });

  it('choosing a stop in the open mobile menu closes it', () => {
    renderShell(host);
    const toggle = host.querySelector<HTMLButtonElement>('.nav-toggle');
    const nav = host.querySelector<HTMLElement>('.site-nav');

    toggle?.click();
    expect(nav?.classList.contains('open')).toBe(true);

    nav?.querySelector<HTMLAnchorElement>('.nav-link')?.click();
    expect(nav?.classList.contains('open')).toBe(false);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('startRouter + shell (full app)', () => {
  let app: HTMLDivElement;
  let stop: (() => void) | null = null;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    // jsdom queues anchor-click navigations as tasks: an earlier test's
    // nav-link click may still be pending. Flush it first, then pin the
    // hash to home and flush the resulting hashchange (no router yet).
    window.location.hash = '#/';
    await tick();
    window.location.hash = '#/';
    await tick();
    app = document.getElementById('app') as HTMLDivElement;
    stop = startRouter(app);
  });

  afterEach(() => {
    stop?.();
    stop = null;
  });

  it('marks the current route with aria-current and walks the pager', async () => {
    // home: the brand link is current, pager shows only "next"
    expect(app.querySelector('.brand')?.getAttribute('aria-current')).toBe('page');
    expect(app.querySelectorAll('.nav-link[aria-current="page"]')).toHaveLength(0);
    expect(
      [...app.querySelectorAll<HTMLAnchorElement>('.pager a')].map((a) => a.getAttribute('href')),
    ).toEqual(['#/data']);

    await setHash('#/data');
    expect(app.querySelector('.brand')?.hasAttribute('aria-current')).toBe(false);
    const current = app.querySelectorAll<HTMLElement>('.nav-link[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('href')).toBe('#/data');
    // pager: prev is home, next is the second section
    expect(
      [...app.querySelectorAll<HTMLAnchorElement>('.pager a')].map((a) => a.getAttribute('href')),
    ).toEqual(['#/', '#/tokenisation']);

    await setHash('#/agent');
    expect(
      app.querySelector('.nav-link[href="#/agent"]')?.getAttribute('aria-current'),
    ).toBe('page');
    // last stop: pager shows only "prev"
    expect(
      [...app.querySelectorAll<HTMLAnchorElement>('.pager a')].map((a) => a.getAttribute('href')),
    ).toEqual(['#/mcp']);
  });

  it('falls back for an unknown hash', async () => {
    await setHash('#/no-such-page');
    expect(app.querySelector('h1')?.textContent).toBe('Page not found');
    expect(app.querySelector('main')?.className).toContain('page--not-found');
    expect(app.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    expect(app.querySelector('.pager')).toBeNull();
  });
});
