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

const counterOf = (root: HTMLElement) =>
  root.querySelector('.pre-counter')?.textContent ?? '';

const lineText = (root: HTMLElement, index: number) =>
  root.querySelectorAll('.pre-line')[index]?.textContent?.replace(/\s+/g, ' ') ?? '';

const badgeFlags = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.pre-badge')).map(
    (el) => el.dataset.unlocked === 'true',
  );

const setStop = (root: HTMLElement, value: string) => {
  const slider = root.querySelector<HTMLInputElement>('.pre-scale-slider');
  if (!slider) throw new Error('scale slider not found');
  slider.value = value;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('pretraining page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', {
        level: 1,
        name: 'Guess the next word. A trillion times.',
      }),
    ).not.toBeNull();
    expect(within(m.root).getByText("04 · How it's trained")).toBeTruthy();
    expect(
      within(m.root).getByText(
        'The first lesson is simple: keep guessing what comes next. Forever.',
      ),
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
});

describe('teach a batch', () => {
  it('adds 100 tokens per press and appends the next example in the fixed cycle', () => {
    // ARRANGE — the feed starts with the first three examples
    const m = mount();
    const root = m.root;
    const batch = within(root).getByRole('button', { name: 'Teach a batch' });
    expect(root.querySelectorAll('.pre-line')).toHaveLength(3);

    // ACT + ASSERT — three presses walk the fixed cycle
    const appended = [
      'She tied her shoes so she could ___ → run',
      'The soup was hot, so I blew on the ___ → spoon',
      'To make tea, first pour hot ___ → water',
    ];
    for (let i = 1; i <= 3; i += 1) {
      batch.click();
      expect(counterOf(root)).toBe(String(i * 100));
      expect(lineText(root, 2 + i)).toBe(appended[i - 1]);
    }
    expect(root.querySelectorAll('.pre-line')).toHaveLength(6);
  });

  it('unlocks Counting at press 2 and Rhyming at press 3', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const batch = within(root).getByRole('button', { name: 'Teach a batch' });

    // ACT — press 1: 100 tokens, no skill yet
    batch.click();
    expect(badgeFlags(root)).toEqual([false, false, false, false]);

    // ACT — press 2: Counting unlocks at 200 tokens
    batch.click();
    expect(badgeFlags(root)).toEqual([true, false, false, false]);
    expect(root.querySelector('.pre-skill-count')?.textContent).toBe(
      'Skills unlocked: 1 / 4',
    );

    // ACT — press 3: Rhyming unlocks at 300 tokens
    batch.click();
    expect(badgeFlags(root)).toEqual([true, true, false, false]);
    expect(root.querySelector('.pre-skill-count')?.textContent).toBe(
      'Skills unlocked: 2 / 4',
    );
  });

  it('the example cycle wraps after all eight sentences', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const batch = within(root).getByRole('button', { name: 'Teach a batch' });

    // ACT — nine more presses after the three initial lines
    for (let i = 0; i < 9; i += 1) {
      batch.click();
    }

    // ASSERT — 12 lines; the last one is cycle index (2 + 9) % 8 = 3
    expect(root.querySelectorAll('.pre-line')).toHaveLength(12);
    expect(lineText(root, 11)).toBe('She tied her shoes so she could ___ → run');
  });
});

describe('log slider, four stops', () => {
  it.each([
    ['0', '1M', [true, true, false, false], 'Skills unlocked: 2 / 4'],
    ['1', '1B', [true, true, true, false], 'Skills unlocked: 3 / 4'],
    ['2', '100B', [true, true, true, false], 'Skills unlocked: 3 / 4'],
    ['3', '15T', [true, true, true, true], 'Skills unlocked: 4 / 4'],
  ] as const)('stop %s reads %s with %s', (value, counter, flags, count) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    setStop(root, value);

    // ASSERT — counter text, badges and active tick per stop
    expect(counterOf(root)).toBe(counter);
    expect(badgeFlags(root)).toEqual(flags);
    expect(root.querySelector('.pre-skill-count')?.textContent).toBe(count);
    expect(root.querySelector('.pre-scale-tick--active')?.textContent).toBe(counter);
  });
});

describe('15T cap', () => {
  it('disables "Teach a batch" once 15T tokens are read', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const batch = within(root).getByRole('button', { name: 'Teach a batch' });

    // ACT
    setStop(root, '3');

    // ASSERT — capped at the real Llama 3.1 figure, button locks,
    // the completion note replaces the hint
    expect(counterOf(root)).toBe('15T');
    expect((batch as HTMLButtonElement).disabled).toBe(true);
    expect(within(root).getByText(/All 15T tokens read/)).toBeTruthy();
  });
});

describe('see the raw model', () => {
  it('toggles the base-model chat on and off', () => {
    // ARRANGE — hidden at first
    const m = mount();
    const root = m.root;
    const toggle = within(root).getByRole('switch', { name: 'See the raw model' });
    const panel = root.querySelector<HTMLElement>('.pre-raw');
    expect(panel?.hidden).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    // ACT — reveal
    toggle.click();

    // ASSERT — switch on, base-model chat with the fixed raw continuation
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(panel?.hidden).toBe(false);
    expect(within(root).getByText('Tell me a joke')).toBeTruthy();
    // v10 string matchers are not whitespace-normalized — match the
    // trimmed text (the rendered line keeps its leading space).
    expect(within(root).getByText('the the the of and …')).toBeTruthy();
    expect(within(root).getByText('No meaning yet — just the next-word reflex.')).toBeTruthy();

    // ACT — hide again
    toggle.click();

    // ASSERT
    expect(panel?.hidden).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
