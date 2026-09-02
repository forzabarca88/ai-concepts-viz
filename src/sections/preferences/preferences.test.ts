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

/** DOM order of the six "This one!" buttons: [A1, B1, A2, B2, A3, B3]. */
const voteAt = (root: HTMLElement, pair: 0 | 1 | 2, card: 'A' | 'B') =>
  within(root).getAllByRole('button', { name: 'This one!' })[pair * 2 + (card === 'A' ? 0 : 1)];

/** DOM order of the six "Voted" chips: [A1, B1, A2, B2, A3, B3]. */
const chipAt = (root: HTMLElement, pair: number, card: 'A' | 'B') =>
  Array.from(root.querySelectorAll<HTMLElement>('.pref-voted'))[pair * 2 + (card === 'A' ? 0 : 1)];

const meterNow = (root: HTMLElement) =>
  root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? '';

const meterValueA = (root: HTMLElement) =>
  root.querySelector('.pref-meter-value--a')?.textContent ?? '';

const meterValueB = (root: HTMLElement) =>
  root.querySelector('.pref-meter-value--b')?.textContent ?? '';

const levelChip = (root: HTMLElement) => root.querySelector('.pref-level')?.textContent ?? '';

const trainedText = (root: HTMLElement) =>
  root.querySelector('.pref-trained-text')?.textContent ?? '';

const trainedNote = (root: HTMLElement) => root.querySelector<HTMLElement>('.pref-trained-note');

const trainBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Train on my votes' }) as HTMLButtonElement;

const resetBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Start over' }) as HTMLButtonElement;

const FINAL_TEXT =
  'Best draft yet: fluffy scrambled eggs in five minutes. Whisk three eggs with a splash of milk and a pinch of salt. Melt a knob of butter over medium heat, pour the eggs in and stir slowly, then take them off the heat while still a little soft — they finish on the plate.';
const NOTE_ALL_A =
  'Trained on your three votes — the new draft keeps the helpful details and drops the attitude.';
const NOTE_MIXED =
  'Trained on your three votes — one of them was B, so the model also learned to be a little more careful with big claims.';

describe('preferences page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', {
        level: 1,
        name: 'Showing it which answer is better',
      }),
    ).not.toBeNull();
    expect(within(m.root).getByText("06 · How it's trained")).toBeTruthy();
    expect(
      within(m.root).getByText('Two answers. One is better. Point at it — the model takes notes.'),
    ).toBeTruthy();
  });

  it('shows the three shared explain cards', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(m.root.querySelector('.explain-grid')?.querySelectorAll('.explain-card')).toHaveLength(
      3,
    );
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });

  it('degrades to the .viz-fallback in jsdom, without a canvas', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — the 3D seesaw layer renders its fallback note in jsdom
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });

  it('shows the three pairs, no votes, train disabled and the meter at "—"', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT — the three fixed prompts are live
    expect(root.querySelectorAll('.pref-pair')).toHaveLength(3);
    expect(within(root).getByText('How do I make scrambled eggs?')).toBeTruthy();
    expect(within(root).getByText('Explain quantum physics in one sentence.')).toBeTruthy();
    expect(within(root).getByText('Should I cancel my gym membership?')).toBeTruthy();

    // ASSERT — six vote buttons, none pressed, no "Voted" chips visible
    expect(within(root).getAllByRole('button', { name: 'This one!' })).toHaveLength(6);
    for (const btn of within(root).getAllByRole('button', { name: 'This one!' })) {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
    for (const chip of root.querySelectorAll<HTMLElement>('.pref-voted')) {
      expect(chip.hidden).toBe(true);
    }

    // ASSERT — meter idle, panel on the untrained draft, train unarmed
    expect(meterValueA(root)).toBe('—');
    expect(meterValueB(root)).toBe('—');
    expect(meterNow(root)).toBe('0');
    expect(levelChip(root)).toBe('no notes yet');
    expect(trainedNote(root)?.hidden).toBe(true);
    expect(trainBtn(root).disabled).toBe(true);
    expect(resetBtn(root).disabled).toBe(true);
  });
});

describe('labeling queue', () => {
  it('voting A on pair 1 chips the card and sets the meter to 100', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    expect(meterValueA(root)).toBe('—');

    // ACT
    voteAt(root, 0, 'A').click();

    // ASSERT — the chosen card is pressed and chipped; meter 100/0
    expect(voteAt(root, 0, 'A').getAttribute('aria-pressed')).toBe('true');
    expect(chipAt(root, 0, 'A').hidden).toBe(false);
    expect(chipAt(root, 0, 'A').textContent).toBe('Voted A');
    expect(chipAt(root, 0, 'B').hidden).toBe(true);
    expect(root.querySelector('.pref-card--chosen')?.classList.contains('pref-card--a')).toBe(
      true,
    );
    expect(meterNow(root)).toBe('100');
    expect(meterValueA(root)).toBe('100');
    expect(meterValueB(root)).toBe('0');

    // ASSERT — one of three labeled: train still disabled
    expect(trainBtn(root).disabled).toBe(true);
    expect(resetBtn(root).disabled).toBe(false);
  });

  it('voting B on pair 2 splits the meter to 50/50', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();

    // ACT
    voteAt(root, 1, 'B').click();

    // ASSERT — one A, one B: 50/50
    expect(chipAt(root, 1, 'B').hidden).toBe(false);
    expect(chipAt(root, 1, 'B').textContent).toBe('Voted B');
    expect(meterNow(root)).toBe('50');
    expect(meterValueA(root)).toBe('50');
    expect(meterValueB(root)).toBe('50');
    expect(trainBtn(root).disabled).toBe(true);
  });

  it('voting A on pair 3 reaches 67 and enables training', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'B').click();

    // ACT
    voteAt(root, 2, 'A').click();

    // ASSERT — two A of three: round(100 × 2 / 3) = 67
    expect(meterNow(root)).toBe('67');
    expect(meterValueA(root)).toBe('67');
    expect(meterValueB(root)).toBe('33');
    expect(trainBtn(root).disabled).toBe(false);
  });

  it('voting the other card moves the vote and recomputes the meter', () => {
    // ARRANGE — [A, B, A] → meter 67
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'B').click();
    voteAt(root, 2, 'A').click();
    expect(meterNow(root)).toBe('67');

    // ACT — flip pair 1 from A to B: [B, B, A]
    voteAt(root, 0, 'B').click();

    // ASSERT — the chip and the press move; round(100 × 1 / 3) = 33
    expect(voteAt(root, 0, 'A').getAttribute('aria-pressed')).toBe('false');
    expect(voteAt(root, 0, 'B').getAttribute('aria-pressed')).toBe('true');
    expect(chipAt(root, 0, 'A').hidden).toBe(true);
    expect(chipAt(root, 0, 'B').hidden).toBe(false);
    expect(meterNow(root)).toBe('33');
    expect(meterValueA(root)).toBe('33');
    expect(meterValueB(root)).toBe('67');
  });
});

describe('train on my votes', () => {
  it('is a no-op until all three votes are cast', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'B').click();
    expect(trainBtn(root).disabled).toBe(true);

    // ACT — a press before the third vote must be a no-op
    trainBtn(root).click();
    expect(levelChip(root)).toBe('no notes yet');
    expect(trainedNote(root)?.hidden).toBe(true);

    // ACT — the third vote arms the button
    voteAt(root, 2, 'A').click();

    // ASSERT
    expect(trainBtn(root).disabled).toBe(false);
  });

  it('one press trains: mixed note, final draft and the "trained" chip', () => {
    // ARRANGE — [A, B, A]
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'B').click();
    voteAt(root, 2, 'A').click();

    // ACT
    trainBtn(root).click();

    // ASSERT — exact mixed note + final draft + chip
    expect(levelChip(root)).toBe('trained');
    expect(trainedNote(root)?.hidden).toBe(false);
    expect(trainedNote(root)?.textContent).toBe(NOTE_MIXED);
    expect(trainedText(root)).toBe(FINAL_TEXT);
    expect(trainBtn(root).disabled).toBe(true);
  });

  it('reset, then B, B, B → meter 0, and training still gets the mixed note', () => {
    // ARRANGE — train once on [A, B, A], then wipe the run
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'B').click();
    voteAt(root, 2, 'A').click();
    trainBtn(root).click();
    expect(levelChip(root)).toBe('trained');

    // ACT — Start over
    resetBtn(root).click();

    // ASSERT — votes and the trained state are both gone
    for (let i = 0; i < 3; i += 1) {
      expect(chipAt(root, i, 'A').hidden).toBe(true);
      expect(chipAt(root, i, 'B').hidden).toBe(true);
      expect(voteAt(root, i as 0, 'A').getAttribute('aria-pressed')).toBe('false');
    }
    expect(meterValueA(root)).toBe('—');
    expect(meterNow(root)).toBe('0');
    expect(levelChip(root)).toBe('no notes yet');
    expect(trainedNote(root)?.hidden).toBe(true);
    expect(trainBtn(root).disabled).toBe(true);

    // ACT — a fresh run of B, B, B
    voteAt(root, 0, 'B').click();
    voteAt(root, 1, 'B').click();
    voteAt(root, 2, 'B').click();

    // ASSERT — zero A votes: meter 0
    expect(meterNow(root)).toBe('0');
    expect(meterValueA(root)).toBe('0');
    expect(meterValueB(root)).toBe('100');
    expect(trainBtn(root).disabled).toBe(false);

    // ACT
    trainBtn(root).click();

    // ASSERT — not all-A, so the mixed note (exact)
    expect(levelChip(root)).toBe('trained');
    expect(trainedNote(root)?.textContent).toBe(NOTE_MIXED);
    expect(trainedText(root)).toBe(FINAL_TEXT);
  });

  it('A, A, A trains with the exact all-A note', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteAt(root, 0, 'A').click();
    voteAt(root, 1, 'A').click();
    voteAt(root, 2, 'A').click();
    expect(meterNow(root)).toBe('100');

    // ACT
    trainBtn(root).click();

    // ASSERT — exact all-A note
    expect(levelChip(root)).toBe('trained');
    expect(trainedNote(root)?.hidden).toBe(false);
    expect(trainedNote(root)?.textContent).toBe(NOTE_ALL_A);
    expect(trainedText(root)).toBe(FINAL_TEXT);
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
