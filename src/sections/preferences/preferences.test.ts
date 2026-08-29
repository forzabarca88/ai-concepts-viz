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

const meterNow = (root: HTMLElement) =>
  root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? '';

const meterValueA = (root: HTMLElement) =>
  root.querySelector('.pref-meter-value--a')?.textContent ?? '';

const meterValueB = (root: HTMLElement) =>
  root.querySelector('.pref-meter-value--b')?.textContent ?? '';

const levelChip = (root: HTMLElement) =>
  root.querySelector('.pref-level')?.textContent ?? '';

const trainedText = (root: HTMLElement) =>
  root.querySelector('.pref-trained-text')?.textContent ?? '';

const trainBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Train on that' }) as HTMLButtonElement;

const resetBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Reset vote' }) as HTMLButtonElement;

const voteBtn = (root: HTMLElement, card: '.pref-card--a' | '.pref-card--b') => {
  const el = root.querySelector<HTMLElement>(card);
  if (!el) throw new Error(`missing ${card}`);
  return within(el).getByRole('button', { name: 'This one!' }) as HTMLButtonElement;
};

const isChosen = (root: HTMLElement, card: '.pref-card--a' | '.pref-card--b') =>
  root.querySelector(card)?.classList.contains('pref-card--chosen') ?? false;

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

  it('shows the prompt over two answers with the meter at 50/50 and no vote', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT — the fixed prompt is live, the meter is dead even,
    // and both stage controls are unarmed
    expect(within(root).getByText('How do I make scrambled eggs?')).toBeTruthy();
    expect(within(root).getByText('Answer A')).toBeTruthy();
    expect(within(root).getByText("Eggs are bad for you, don't.")).toBeTruthy();
    expect(meterNow(root)).toBe('50');
    expect(meterValueA(root)).toBe('50');
    expect(meterValueB(root)).toBe('50');
    expect(levelChip(root)).toBe('no notes yet');
    expect(trainBtn(root).disabled).toBe(true);
    expect(resetBtn(root).disabled).toBe(true);
  });
});

describe('votes', () => {
  it('voting "This one!" on A rings A and shifts the meter to 80/20', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = voteBtn(root, '.pref-card--a');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(isChosen(root, '.pref-card--a')).toBe(false);

    // ACT
    btn.click();

    // ASSERT — amber ring on A, meter 80/20, stage controls armed
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(isChosen(root, '.pref-card--a')).toBe(true);
    expect(isChosen(root, '.pref-card--b')).toBe(false);
    expect(meterNow(root)).toBe('80');
    expect(meterValueA(root)).toBe('80');
    expect(meterValueB(root)).toBe('20');
    expect(trainBtn(root).disabled).toBe(false);
    expect(resetBtn(root).disabled).toBe(false);
  });

  it('voting "This one!" on B rings B and shifts the meter to 20/80', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    voteBtn(root, '.pref-card--b').click();

    // ASSERT — amber ring on B, meter 20/80
    expect(voteBtn(root, '.pref-card--b').getAttribute('aria-pressed')).toBe('true');
    expect(isChosen(root, '.pref-card--b')).toBe(true);
    expect(isChosen(root, '.pref-card--a')).toBe(false);
    expect(meterNow(root)).toBe('20');
    expect(meterValueA(root)).toBe('20');
    expect(meterValueB(root)).toBe('80');
    expect(trainBtn(root).disabled).toBe(false);
  });

  it('switching the vote moves the ring and the meter', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteBtn(root, '.pref-card--a').click();
    expect(meterNow(root)).toBe('80');

    // ACT
    voteBtn(root, '.pref-card--b').click();

    // ASSERT — the ring and the meter follow the new vote
    expect(voteBtn(root, '.pref-card--a').getAttribute('aria-pressed')).toBe('false');
    expect(isChosen(root, '.pref-card--b')).toBe(true);
    expect(isChosen(root, '.pref-card--a')).toBe(false);
    expect(meterNow(root)).toBe('20');
    expect(meterValueB(root)).toBe('80');
  });
});

describe('train on that', () => {
  it('is genuinely disabled until a vote exists', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const train = trainBtn(root);
    expect(train.disabled).toBe(true);

    // ACT — a press before voting must be a no-op
    train.click();
    expect(levelChip(root)).toBe('no notes yet');

    // ACT
    voteBtn(root, '.pref-card--a').click();

    // ASSERT
    expect(train.disabled).toBe(false);
  });

  it('upgrades the new-model answer through two fixed levels', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    voteBtn(root, '.pref-card--a').click();
    const train = trainBtn(root);
    const draft = trainedText(root);

    // ACT — press 1: level 1
    train.click();
    expect(levelChip(root)).toBe('level 1');
    expect(trainedText(root)).not.toBe(draft);
    expect(trainedText(root)).toContain('Improved draft');

    // ACT — press 2: level 2
    train.click();
    expect(levelChip(root)).toBe('level 2');
    expect(trainedText(root)).toContain('Best draft yet');

    // ASSERT — capped at level 2, the button locks
    expect(train.disabled).toBe(true);
  });
});

describe('reset vote', () => {
  it('clears the ring, returns the meter to 50 and disables training', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const reset = resetBtn(root);
    expect(reset.disabled).toBe(true);
    voteBtn(root, '.pref-card--a').click();
    trainBtn(root).click();
    expect(meterNow(root)).toBe('80');
    expect(levelChip(root)).toBe('level 1');

    // ACT
    reset.click();

    // ASSERT — no ring, meter back to 50/50, training re-armed but
    // disabled (no vote), the answer back to the untrained draft
    expect(root.querySelector('.pref-card--chosen')).toBeNull();
    expect(voteBtn(root, '.pref-card--a').getAttribute('aria-pressed')).toBe('false');
    expect(meterNow(root)).toBe('50');
    expect(meterValueA(root)).toBe('50');
    expect(meterValueB(root)).toBe('50');
    expect(trainBtn(root).disabled).toBe(true);
    expect(levelChip(root)).toBe('no notes yet');
    expect(reset.disabled).toBe(true);
  });
});
