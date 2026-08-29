import { afterEach, describe, expect, it } from 'vitest';
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

const countLine = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.mcp-count')?.textContent ?? '';
const noteEl = (root: HTMLElement) => root.querySelector<HTMLElement>('.mcp-notetools')!;
const svgEl = (root: HTMLElement) => root.querySelector<SVGElement>('.mc-svg')!;
const dockedCount = (root: HTMLElement) => svgEl(root).querySelectorAll('.mc-docked').length;
const hasCable = (root: HTMLElement, id: string) =>
  svgEl(root).querySelector(`.mc-cable--${id}`) !== null;

const appCard = (root: HTMLElement, name: string) => appBtn(root, name).closest('.mcp-app')!;
const appChips = (root: HTMLElement, name: string): string[] =>
  Array.from(appCard(root, name).querySelectorAll('.mcp-chip')).map((c) => c.textContent ?? '');

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

  it('starts on ChatBot with an empty socket and the no-tools note', () => {
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
    expect(dockedCount(root)).toBe(0);
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
    expect(dockedCount(root)).toBe(0);

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
  ] as const)('clicking %s docks it, draws its cable and adds a chip', (name, id) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    plugBtn(root, name).click();

    // ASSERT — plug docked in the SVG, cable drawn, chip on the active app, count up
    expect(plugBtn(root, name).getAttribute('aria-pressed')).toBe('true');
    expect(dockedCount(root)).toBe(1);
    expect(hasCable(root, id)).toBe(true);
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
    expect(dockedCount(root)).toBe(3);
    expect(hasCable(root, 'files')).toBe(true);
    expect(hasCable(root, 'calendar')).toBe(true);
    expect(hasCable(root, 'maps')).toBe(true);
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
    expect(dockedCount(root)).toBe(2);

    // ACT
    plugBtn(root, 'Files').click();

    // ASSERT
    expect(plugBtn(root, 'Files').getAttribute('aria-pressed')).toBe('false');
    expect(hasCable(root, 'files')).toBe(false);
    expect(hasCable(root, 'calendar')).toBe(true);
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Calendar']);
    expect(countLine(root)).toBe('1 tool ready');
  });
});

describe('unplug all', () => {
  it('clears the active app: cables, chips and count go to zero', () => {
    // ARRANGE — dock two servers
    const m = mount();
    const root = m.root;
    plugBtn(root, 'Files').click();
    plugBtn(root, 'Calendar').click();
    expect(countLine(root)).toBe('2 tools ready');
    expect(dockedCount(root)).toBe(2);

    // ACT
    within(root).getByRole('button', { name: 'Unplug all' }).click();

    // ASSERT
    expect(countLine(root)).toBe('0 tools ready');
    expect(noteEl(root).hidden).toBe(false);
    expect(noteEl(root).textContent).toBe('No tools — just words.');
    expect(dockedCount(root)).toBe(0);
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
    within(root).getByRole('button', { name: 'Unplug all' }).click();

    // ASSERT — CodePal is empty, ChatBot still has Files
    expect(countLine(root)).toBe('0 tools ready');
    appBtn(root, 'ChatBot').click();
    expect(countLine(root)).toBe('1 tool ready');
    expect(appChips(root, 'ChatBot')).toEqual(['connected: Files']);
  });
});
