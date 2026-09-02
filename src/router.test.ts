import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRouter, routes, routeFromHash } from './router';
import { page as dataPage } from './sections/data/page';
import { mountPage } from './test/mountPage';

function setHash(hash: string) {
  window.location.hash = hash;
  // jsdom fires `hashchange` asynchronously — give it a macrotask tick.
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('router', () => {
  let app: HTMLDivElement;
  let stop: () => void;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '';
    // jsdom delivers hashchange on a macrotask: flush the stale event
    // while no router is listening (previous test already stopped its
    // router), so it can't leak into this test.
    await new Promise((resolve) => setTimeout(resolve, 0));
    app = document.getElementById('app') as HTMLDivElement;
  });

  afterEach(() => {
    stop?.();
  });

  it('resolves hashes to route names, defaulting to home', () => {
    expect(routeFromHash('')).toBe('home');
    expect(routeFromHash('#')).toBe('home');
    expect(routeFromHash('#/')).toBe('home');
    expect(routeFromHash('#/data')).toBe('data');
    expect(routeFromHash('#/tool-calling')).toBe('tool-calling');
  });

  it('registers all ten sections plus home', () => {
    expect(Object.keys(routes).sort()).toEqual(
      [
        'home',
        'data',
        'tokenisation',
        'parameters',
        'pretraining',
        'sft',
        'preferences',
        'tool-calling',
        'skills',
        'mcp',
        'agent',
      ].sort(),
    );
  });

  it('renders the home page by default without stealing focus', () => {
    stop = startRouter(app);
    expect(app.querySelector('h1')?.textContent).toBe('How machines learn to talk');
    expect(app.querySelector('.eyebrow')?.textContent).toBe('00 · Start here');
    // Home content (next-token demo + overview map) is in the host.
    expect(app.querySelector('.nt-sentence')).not.toBeNull();
    expect(app.querySelector('.map-card')).not.toBeNull();
    // No programmatic focus on initial load (keeps screenshots ring-free).
    expect(document.activeElement).toBe(document.body);
  });

  it('re-renders a section on hash change', async () => {
    stop = startRouter(app);
    await setHash('#/data');
    expect(app.querySelector('h1')?.textContent).toBe('How much reading does it take?');
    expect(app.querySelector('.eyebrow')?.textContent).toBe('01 · Core ideas');
    // In-app navigation moves keyboard focus to the h1.
    expect(document.activeElement).toBe(app.querySelector('h1'));

    await setHash('#/tokenisation');
    // tokenisation is a real section (Task 4) — its h1 renders
    expect(app.querySelector('h1')?.textContent).toBe("Words aren't words — they're tokens");
  });

  it('runs the previous page cleanup on route change', async () => {
    stop = startRouter(app);

    // Spy must wrap mount BEFORE `#/data` renders, so the saved cleanup
    // is the spied one.
    const realMount = dataPage.mount;
    const cleanupSpy = vi.fn();
    dataPage.mount = (root: HTMLElement) => {
      const cleanup = realMount(root);
      return () => {
        cleanupSpy();
        cleanup();
      };
    };

    await setHash('#/data'); // data mounts through the spy
    await setHash('#/tokenisation'); // leaving data → cleanup runs
    expect(app.querySelector('h1')?.textContent).toBe("Words aren't words — they're tokens");
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    dataPage.mount = realMount;
  });

  it('falls back for unknown routes', async () => {
    stop = startRouter(app);
    await setHash('#/does-not-exist');
    expect(app.querySelector('h1')?.textContent).toBe('Page not found');
    expect(app.querySelector('a.btn')).not.toBeNull();
    expect(app.querySelector('main')?.className).toContain('page--not-found');
  });

  it('stop() runs the pending cleanup and empties the root', async () => {
    stop = startRouter(app);

    const realMount = dataPage.mount;
    const cleanupSpy = vi.fn();
    dataPage.mount = (root: HTMLElement) => {
      const cleanup = realMount(root);
      return () => {
        cleanupSpy();
        cleanup();
      };
    };

    await setHash('#/data'); // data mounts through the spy
    stop(); // stop must run data's pending cleanup
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(app.innerHTML).toBe('');
    dataPage.mount = realMount;
  });
});

describe('mountPage (shared test helper)', () => {
  it('renders the real template hero and unmounts cleanly', () => {
    const m = mountPage(dataPage);
    expect(m.root.querySelector('h1')?.textContent).toBe('How much reading does it take?');
    expect(m.root.querySelector('.eyebrow')?.textContent).toBe('01 · Core ideas');
    expect(m.host.querySelector('.stage')).not.toBeNull();

    m.unmount();
    expect(m.root.parentElement).toBeNull();
    expect(document.body.querySelector('.page-content')).toBeNull();
  });
});
