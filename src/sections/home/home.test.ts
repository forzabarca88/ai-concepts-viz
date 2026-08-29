import { afterEach, describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';
import { navItems } from '../../shell/nav';
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

/** Normalised textContent of an element (whitespace-collapsed). */
const textOf = (selector: string, scope: HTMLElement) =>
  scope.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('home hero', () => {
  it('renders the eyebrow, h1 and lede', () => {
    const m = mount();
    expect(
      within(m.root).queryByRole('heading', { level: 1, name: 'How machines learn to talk' }),
    ).not.toBeNull();
    expect(within(m.root).getByText('00 · Start here')).toBeTruthy();
    expect(
      within(m.root).getByText(
        'A friendly, hands-on tour of large language models. No math required — just curiosity.',
      ),
    ).toBeTruthy();
  });

  it('shows the three shared explain cards', () => {
    const m = mount();
    const grid = m.root.querySelector('.explain-grid');
    expect(grid?.querySelectorAll('.explain-card')).toHaveLength(3);
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });
});

describe('next-token hero demo', () => {
  it.each([
    ['it never ends', 'The best part of learning is that it never ends', 0],
    ['you can practice', 'The best part of learning is that you can practice', 1],
    ["it's expensive", "The best part of learning is that it's expensive", 2],
  ] as const)('clicking "%s" completes the sentence and explains the guess', (candidate, full, chosen) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    within(root).getByRole('button', { name: new RegExp(candidate) }).click();

    // ASSERT — the sentence completes with the chosen word
    expect(textOf('.nt-sentence', root)).toBe(full);
    expect(within(root).queryByText('___')).toBeNull();
    // the chosen candidate is the only pressed one (its bar glows amber)
    root.querySelectorAll<HTMLElement>('.nt-cand').forEach((btn, i) => {
      expect(btn.getAttribute('aria-pressed')).toBe(String(i === chosen));
    });
    // the one-line explainer appears
    const explain = root.querySelector<HTMLElement>('.nt-explain');
    expect(explain?.hidden).toBe(false);
    expect(explain?.textContent).toBe(
      "The model never knows the answer — it just ranks what's likely next.",
    );
  });

  it('"New sentence" cycles the three fixed sentences and resets the state', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const next = within(root).getByRole('button', { name: 'New sentence' });
    const cycle: Array<[stem: string, firstCandidate: string]> = [
      ['Mistakes are useful because they', 'show what to try next'],
      ['Your phone already knows your favourite', 'word'],
      ['The best part of learning is that', 'it never ends'],
    ];

    // ACT + ASSERT — three presses walk the whole fixed list and wrap
    for (const [stem, firstCandidate] of cycle) {
      next.click();
      expect(textOf('.nt-sentence', root)).toBe(`${stem} ___`);
      root.querySelectorAll<HTMLElement>('.nt-cand').forEach((btn) => {
        expect(btn.getAttribute('aria-pressed')).toBe('false');
      });
      expect(root.querySelector<HTMLElement>('.nt-explain')?.hidden).toBe(true);
      expect(within(root).getByRole('button', { name: new RegExp(firstCandidate) })).toBeTruthy();
    }
  });
});

describe('overview map', () => {
  it('links all ten sections in curriculum order with number, title and teaser', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result: ten cards, correct hrefs, in nav order
    const cards = m.root.querySelectorAll<HTMLElement>('.map-card');
    expect(cards).toHaveLength(10);
    navItems.forEach((item, i) => {
      expect(cards[i].getAttribute('href')).toBe(`#/${item.route}`);
      expect(cards[i].textContent).toContain(item.number);
      expect(cards[i].textContent).toContain(item.title);
    });
    for (const label of ['Core ideas', "How it's trained", 'Going agentic']) {
      expect(within(m.root).queryByRole('heading', { level: 3, name: label })).not.toBeNull();
    }
  });
});
