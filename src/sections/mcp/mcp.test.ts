import { afterEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/dom';
import { mountPage } from '../../test/mountPage';
import { page } from './page';

let mounted: ReturnType<typeof mountPage> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

const mount = () => {
  mounted = mountPage(page);
  return mounted;
};

/* ---------- small state readers (end-result assertions) ---------- */

const appBtn = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;
const plugBtn = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;
const askBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Ask the app' }) as HTMLButtonElement;
const unplugBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Unplug all' }) as HTMLButtonElement;

const countLine = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.mcp-count')?.textContent ?? '';
const noteEl = (root: HTMLElement) => root.querySelector<HTMLElement>('.mcp-notetools')!;
const replyText = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.mcp-reply-text')?.textContent ?? '';

const appCard = (root: HTMLElement, name: string) => appBtn(root, name).closest('.mcp-app')!;
const appChips = (root: HTMLElement, name: string): string[] =>
  Array.from(appCard(root, name).querySelectorAll('.mcp-chip')).map((c) => c.textContent ?? '');

const REPLY_EMPTY = 'Nothing to ask yet — plug something in.';

describe('mcp page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — the shared template carries the fixed copy
    expect(within(m.root).queryByRole('heading', { level: 1, name: 'The USB-C of AI' })).not.toBeNull();
    expect(within(m.root).getByText('09 · Going agentic')).toBeTruthy();
    expect(
      within(m.root).getByText('One standard socket means any tool fits any model — no custom wiring.'),
    ).toBeTruthy();
  });

  it('shows the three shared explain cards', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(m.root.querySelector('.explain-grid')?.querySelectorAll('.explain-card')).toHaveLength(3);
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });

  it('starts on ChatBot: empty sockets, no tools, Ask disabled, jsdom fallback', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(appBtn(root, 'ChatBot').getAttribute('aria-pressed')).toBe('true');
    expect(appBtn(root, 'CodePal').getAttribute('aria-pressed')).toBe('false');
    for (const name of ['Files', 'Calendar', 'Maps']) {
      expect(plugBtn(root, name).getAttribute('aria-pressed')).toBe('false');
    }
    expect(countLine(root)).toBe('0 tools ready');
    expect(noteEl(root).hidden).toBe(false);
    expect(noteEl(root).textContent).toBe('No tools — just words.');
    expect(askBtn(root).disabled).toBe(true);
    expect(replyText(root)).toBe(REPLY_EMPTY);
    // the 3D socket falls back to a note in jsdom (no WebGL)
    expect(root.querySelector('.viz-fallback')).toBeTruthy();
  });
});

describe('app picker', () => {
  it('switching to CodePal lights it and dims ChatBot', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    appBtn(root, 'CodePal').click();

    // ASSERT
    expect(appBtn(root, 'CodePal').getAttribute('aria-pressed')).toBe('true');
    expect(appBtn(root, 'ChatBot').getAttribute('aria-pressed')).toBe('false');
    expect(appCard(root, 'CodePal').classList.contains('mcp-app--active')).toBe(true);
    expect(appCard(root, 'ChatBot').classList.contains('mcp-app--active')).toBe(false);
  });

  it('each app keeps its own sockets', () => {
    // ARRANGE — dock Files into ChatBot, then switch to CodePal
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    expect(countLine(root)).toBe('1 tool ready');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files']);

    // ACT — look at CodePal
    appBtn(root, 'CodePal').click();

    // ASSERT — CodePal is empty; nothing leaked across apps
    expect(countLine(root)).toBe('0 tools ready');
    expect(noteEl(root).hidden).toBe(false);
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('false');
    expect(appChips(root, 'CodePal')).toEqual([]);

    // ACT — back to ChatBot
    appBtn(root, 'ChatBot').click();

    // ASSERT — ChatBot's Files is still docked
    expect(countLine(root)).toBe('1 tool ready');
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('true');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files']);
  });
});

describe('plug clicks', () => {
  it.each([
    ['Files', 'files'],
    ['Calendar', 'calendar'],
    ['Maps', 'maps'],
  ] as const)('clicking %s docks it and adds a chip', (name, _id) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    plugBtn(root, name).click();

    // ASSERT — plug docked (aria-pressed mirror), chip on the active app, count up
    expect(plugBtn(root, name).getAttribute('aria-pressed')).toBe('true');
    expect(appChips(root, 'ChatBot')).toEqual([`connected: ${name}`]);
    // the chip row is announced as a named list (aria-label on a bare span
    // is ignored by assistive tech)
    const chipsRow = appCard(root, 'ChatBot').querySelector('.mcp-app-chips')!;
    expect(chipsRow.getAttribute('role')).toBe('list');
    expect(chipsRow.getAttribute('aria-label')).toBe('ChatBot connected tools');
    expect(chipsRow.querySelector('.mcp-chip')?.getAttribute('role')).toBe('listitem');
    expect(countLine(root)).toBe('1 tool ready');
    expect(noteEl(root).hidden).toBe(true);
  });

  it('docks all three and counts up to three', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    plugBtn(root, 'Files').click();
    plugBtn(root, 'Calendar').click();
    plugBtn(root, 'Maps').click();

    // ASSERT
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('true');
    expect(plugBtn(root, 'Calendar').getAttribute('aria-pressed')).toBe('true');
    expect(plugBtn(root, 'Maps').getAttribute('aria-pressed')).toBe('true');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files', 'connected: Calendar', 'connected: Maps']);
    expect(countLine(root)).toBe('3 tools ready');
    expect(noteEl(root).hidden).toBe(true);
  });

  it('clicking a docked plug again undocks it', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    plugBtn(root, 'Calendar').click();

    // ACT
    plugBtn(root, 'Files').click();

    // ASSERT
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('false');
    expect(plugBtn(root, 'Calendar').getAttribute('aria-pressed')).toBe('true');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Calendar']);
    expect(countLine(root)).toBe('1 tool ready');
  });
});

describe('ask the app', () => {
  it('plugging a server enables Ask, and asking prints the exact reply', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — dock Files; Ask unlocks but the reply stays at the placeholder
    plugBtn(root, 'Files').click();
    expect(askBtn(root).disabled).toBe(false);
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files']);
    expect(countLine(root)).toBe('1 tool ready');
    expect(replyText(root)).toBe(REPLY_EMPTY);

    // ACT — ask
    askBtn(root).click();

    // ASSERT
    expect(replyText(root)).toBe('ChatBot asked its tools: the hike photos are in Hike 2024.zip.');
  });

  it('the reply is live: docking another server re-computes it in SERVERS order', () => {
    // ARRANGE — ask with only Calendar docked (clause order is SERVERS
    // order, not plug order)
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Calendar').click();
    askBtn(root).click();
    expect(replyText(root)).toBe('ChatBot asked its tools: Saturday is free.');

    // ACT — dock Files after the ask
    plugBtn(root, 'Files').click();

    // ASSERT — live re-compute; the Files clause comes FIRST (SERVERS order)
    expect(replyText(root)).toBe(
      'ChatBot asked its tools: the hike photos are in Hike 2024.zip; Saturday is free.',
    );

    // ACT — dock the third server
    plugBtn(root, 'Maps').click();

    // ASSERT — all three clauses, files → calendar → maps
    expect(replyText(root)).toBe(
      'ChatBot asked its tools: the hike photos are in Hike 2024.zip; Saturday is free; the trail is 8.4 miles.',
    );
  });

  it('undocking a server after the ask re-computes the reply live', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    plugBtn(root, 'Maps').click();
    askBtn(root).click();
    expect(replyText(root)).toBe(
      'ChatBot asked its tools: the hike photos are in Hike 2024.zip; the trail is 8.4 miles.',
    );

    // ACT — unplug Files
    plugBtn(root, 'Files').click();

    // ASSERT — the reply follows the docked set
    expect(replyText(root)).toBe('ChatBot asked its tools: the trail is 8.4 miles.');
  });

  it('each app keeps its own ask state and its own reply verb', () => {
    // ARRANGE — ask ChatBot with Files docked
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    askBtn(root).click();
    expect(replyText(root)).toBe('ChatBot asked its tools: the hike photos are in Hike 2024.zip.');

    // ACT — look at CodePal
    appBtn(root, 'CodePal').click();

    // ASSERT — empty chips, Ask disabled, placeholder
    expect(appChips(root, 'CodePal')).toEqual([]);
    expect(askBtn(root).disabled).toBe(true);
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('false');
    expect(replyText(root)).toBe(REPLY_EMPTY);

    // ACT — dock Calendar and ask CodePal
    plugBtn(root, 'Calendar').click();
    askBtn(root).click();

    // ASSERT — CodePal phrases it its way
    expect(replyText(root)).toBe('CodePal checked its tools: Saturday is free.');

    // ACT — back to ChatBot
    appBtn(root, 'ChatBot').click();

    // ASSERT — its reply is still live
    expect(replyText(root)).toBe('ChatBot asked its tools: the hike photos are in Hike 2024.zip.');
  });

  it('Unplug all resets the ask: re-plugging needs a fresh Ask', () => {
    // ARRANGE — asked with Files docked
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    askBtn(root).click();
    expect(replyText(root)).toBe('ChatBot asked its tools: the hike photos are in Hike 2024.zip.');

    // ACT
    unplugBtn(root).click();

    // ASSERT — zero tools + placeholder
    expect(countLine(root)).toBe('0 tools ready');
    expect(noteEl(root).hidden).toBe(false);
    expect(askBtn(root).disabled).toBe(true);
    expect(replyText(root)).toBe(REPLY_EMPTY);

    // ACT — plug Files again: the reply stays at the placeholder
    plugBtn(root, 'Files').click();
    expect(countLine(root)).toBe('1 tool ready');
    expect(replyText(root)).toBe(REPLY_EMPTY);

    // ACT — ask again
    askBtn(root).click();

    // ASSERT
    expect(replyText(root)).toBe('ChatBot asked its tools: the hike photos are in Hike 2024.zip.');
  });
});

describe('unplug all', () => {
  it('clears the active app: chips and count go to zero', () => {
    // ARRANGE — dock two servers
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    plugBtn(root, 'Calendar').click();
    expect(countLine(root)).toBe('2 tools ready');

    // ACT
    unplugBtn(root).click();

    // ASSERT
    expect(countLine(root)).toBe('0 tools ready');
    expect(noteEl(root).hidden).toBe(false);
    expect(noteEl(root).textContent).toBe('No tools — just words.');
    expect(appChips(root, 'ChatBot')).toEqual([]);
    for (const name of ['Files', 'Calendar', 'Maps']) {
      expect(plugBtn(root, name).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('only clears the active app, leaving the other app intact', () => {
    // ARRANGE — Files into ChatBot, then Calendar into CodePal
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    appBtn(root, 'CodePal').click();
    plugBtn(root, 'Calendar').click();
    expect(countLine(root)).toBe('1 tool ready');

    // ACT — unplug on CodePal
    unplugBtn(root).click();

    // ASSERT — CodePal is empty, ChatBot still has Files
    expect(countLine(root)).toBe('0 tools ready');
    appBtn(root, 'ChatBot').click();
    expect(countLine(root)).toBe('1 tool ready');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files']);
  });
});

describe('window listener hygiene', () => {
  it('removes its window resize listener on unmount (no leak on the no-WebGL path)', () => {
    // ARRANGE — the kit registers exactly one window resize listener per
    // mount (removed again on dispose); the section adds none of its own.
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // ACT — three mount/unmount cycles.
    for (let i = 0; i < 3; i += 1) {
      const m = mountPage(page);
      m.unmount();
    }
    const adds = addSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    const removes = removeSpy.mock.calls.filter((args) => args[0] === 'resize').length;
    addSpy.mockRestore();
    removeSpy.mockRestore();

    // ASSERT — balanced: one removal for every registration (3/3).
    expect(adds).toBe(3);
    expect(removes).toBe(3);
  });
});
