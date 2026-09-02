import { afterEach, describe, expect, it, vi } from 'vitest';
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

/**
 * Walk the full duel: pick `picks` (per sentence) and advance between
 * them, landing in the score phase.
 */
const walkToScore = (root: HTMLElement, picks: number[]) => {
  const pickTexts: string[][] = [
    ['it never ends', 'you can practice', "it's expensive"],
    ['show what to try next', 'feel uncomfortable', 'never happen twice'],
    ['word', 'song', 'coffee order'],
  ];
  picks.forEach((pick, i) => {
    within(root).getByRole('button', { name: new RegExp(`^${pickTexts[i][pick]}`) }).click();
    within(root)
      .getByRole('button', { name: i < picks.length - 1 ? 'Next sentence' : 'See your score' })
      .click();
  });
};

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

describe('you-vs-the-model duel', () => {
  it('renders the initial duel state: candidates, zero score, gated start', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT — three candidates with their probability texts
    const cands = root.querySelectorAll<HTMLButtonElement>('.nt-cand');
    expect(cands).toHaveLength(3);
    expect(cands[0]?.textContent).toContain('it never ends');
    expect(cands[0]?.textContent).toContain('38%');
    expect(cands[1]?.textContent).toContain('you can practice');
    expect(cands[1]?.textContent).toContain('27%');
    expect(cands[2]?.textContent).toContain("it's expensive");
    expect(cands[2]?.textContent).toContain('4%');
    // the score pill starts empty and the duel is gated
    expect(textOf('.nt-score', root)).toBe('Score: 0 / 3');
    expect(within(root).getByRole<HTMLButtonElement>('button', { name: 'Next sentence' }).disabled).toBe(true);
    expect(within(root).queryByRole('button', { name: 'Play again' })).toBeNull();
    // no-WebGL jsdom gets the fallback note from the 3D kit
    expect(root.querySelector('.viz-fallback')).not.toBeNull();
  });

  it('picking the model’s top pick scores a match and locks the candidates', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    within(root).getByRole('button', { name: new RegExp('^it never ends') }).click();

    // ASSERT — the agree line, the score, and locked candidates
    expect(root.querySelector<HTMLElement>('.nt-reveal')?.textContent).toBe(
      'You and the model agree: "it never ends".',
    );
    expect(textOf('.nt-score', root)).toBe('Score: 1 / 3');
    root.querySelectorAll<HTMLButtonElement>('.nt-cand').forEach((btn, i) => {
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe(String(i === 0));
    });
    // the blank is filled and the advance button is live
    expect(within(root).queryByText('___')).toBeNull();
    expect(within(root).getByRole<HTMLButtonElement>('button', { name: 'Next sentence' }).disabled).toBe(false);
  });

  it('picking a non-argmax candidate explains what the model would say', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    within(root).getByRole('button', { name: new RegExp('^you can practice') }).click();

    // ASSERT — the exact mismatch line and a flat score
    expect(root.querySelector<HTMLElement>('.nt-reveal')?.textContent).toBe(
      'You said "you can practice". The model would say "it never ends" (38%). Both are possible — that is the game.',
    );
    expect(textOf('.nt-score', root)).toBe('Score: 0 / 3');
    root.querySelectorAll<HTMLButtonElement>('.nt-cand').forEach((btn, i) => {
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe(String(i === 1));
    });
  });

  it('three picks [0, 1, 0] end in the score card with two matches', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    walkToScore(root, [0, 1, 0]);

    // ASSERT — result card with the exact lines; candidates and reveal gone
    const result = root.querySelector<HTMLElement>('.nt-result');
    expect(result?.hidden).toBe(false);
    expect(result?.querySelector('.nt-result-line')?.textContent).toBe(
      'You matched the model 2 out of 3 times.',
    );
    expect(result?.querySelector('.nt-result-summary')?.textContent).toBe(
      'Two matches — you and the model share a sense of the likely. That is why it feels natural to read.',
    );
    expect(root.querySelector<HTMLElement>('.nt-cands')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('.nt-reveal')?.hidden).toBe(true);
    // score pill and the reset control
    expect(textOf('.nt-score', root)).toBe('Score: 2 / 3');
    expect(within(root).queryByRole('button', { name: 'See your score' })).toBeNull();
    expect(within(root).getByRole('button', { name: 'Play again' })).toBeTruthy();
  });

  it('"Play again" resets to sentence 1 with a clean slate', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    walkToScore(root, [0, 1, 0]);

    // ACT
    within(root).getByRole('button', { name: 'Play again' }).click();

    // ASSERT — back to the first sentence, zero score, pick phase
    expect(textOf('.nt-sentence', root)).toBe('The best part of learning is that ___');
    expect(textOf('.nt-score', root)).toBe('Score: 0 / 3');
    root.querySelectorAll<HTMLButtonElement>('.nt-cand').forEach((btn) => {
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
    expect(within(root).getByRole<HTMLButtonElement>('button', { name: 'Next sentence' }).disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('.nt-result')?.hidden).toBe(true);
    expect(within(root).queryByRole('button', { name: 'Play again' })).toBeNull();
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

describe('window listener hygiene', () => {
  it('removes its window resize listener on unmount (no leak on the no-WebGL path)', () => {
    // ARRANGE — spy on registration instead of dispatching events. In
    // jsdom every home-page mount takes the no-WebGL fallback path, but
    // the 3D kit still owns one window resize listener per mount that
    // dispose() must remove.
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
