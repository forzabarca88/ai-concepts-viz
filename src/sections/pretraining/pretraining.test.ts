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

const counterOf = (root: HTMLElement) =>
  root.querySelector('.pre-counter')?.textContent ?? '';

const lineText = (root: HTMLElement, index: number) =>
  root.querySelectorAll('.pre-line')[index]?.textContent?.replace(/\s+/g, ' ') ?? '';

const badgeFlags = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.pre-badge')).map(
    (el) => el.dataset.unlocked === 'true',
  );

const badgeThresholds = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.pre-badge-at')).map(
    (el) => el.textContent ?? '',
  );

const dietButton = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;

const batchButton = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Teach a batch' }) as HTMLButtonElement;

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

  it('degrades to the .viz-fallback in jsdom, without a canvas', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — the 3D bowl layer renders its fallback note in jsdom
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });
});

describe('diet picker', () => {
  it('starts on "Everything mixed" with the mixed thresholds visible', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT — three diet buttons, the mixed one pressed by default
    expect(dietButton(root, 'Everything mixed').getAttribute('aria-pressed')).toBe('true');
    expect(dietButton(root, 'Rhymes & stories').getAttribute('aria-pressed')).toBe('false');
    expect(dietButton(root, 'Math & code').getAttribute('aria-pressed')).toBe('false');

    // ASSERT — mixed thresholds shown on the badges
    expect(badgeThresholds(root)).toEqual(['200', '300', '1B', '15T']);
  });

  it.each([
    ['Rhymes & stories', ['500', '100', '1B', '15T']],
    ['Math & code', ['100', '800', '200M', '15T']],
  ] as const)('switching to %s re-shares the thresholds', (name, thresholds) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    dietButton(root, name).click();

    // ASSERT — the badge labels now show that diet's values
    expect(dietButton(root, name).getAttribute('aria-pressed')).toBe('true');
    expect(dietButton(root, 'Everything mixed').getAttribute('aria-pressed')).toBe('false');
    expect(badgeThresholds(root)).toEqual(thresholds);
  });

  it('Math & code: 3 batches (300 tokens) unlocks Counting only', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    dietButton(root, 'Math & code').click();

    // ACT — three batches = 300 tokens
    for (let i = 0; i < 3; i += 1) batchButton(root).click();

    // ASSERT — Counting @100 is on; Rhyming @800, Coding @200M are not
    expect(counterOf(root)).toBe('300');
    expect(badgeFlags(root)).toEqual([true, false, false, false]);
    expect(root.querySelector('.pre-skill-count')?.textContent).toBe(
      'Skills unlocked: 1 / 4',
    );
  });

  it('Rhymes & stories: 1 batch (100 tokens) unlocks Rhyming but not Counting', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    dietButton(root, 'Rhymes & stories').click();

    // ACT — one batch = 100 tokens
    batchButton(root).click();

    // ASSERT — Rhyming @100 is on; Counting @500 is not
    expect(badgeFlags(root)).toEqual([false, true, false, false]);
    expect(root.querySelector('.pre-skill-count')?.textContent).toBe(
      'Skills unlocked: 1 / 4',
    );
  });

  it('slider to 15T unlocks 4 / 4 in any diet', () => {
    // ARRANGE + ACT — one fresh mount per diet, jump to the 15T stop
    for (const name of ['Everything mixed', 'Rhymes & stories', 'Math & code']) {
      const m = mount();
      const root = m.root;
      dietButton(root, name).click();
      setStop(root, '3');

      // ASSERT
      expect(counterOf(root)).toBe('15T');
      expect(badgeFlags(root)).toEqual([true, true, true, true]);
      expect(root.querySelector('.pre-skill-count')?.textContent).toBe(
        'Skills unlocked: 4 / 4',
      );
      m.unmount();
      mounted = undefined;
    }
  });
});

describe('teach a batch', () => {
  it('adds 100 tokens per press and appends the next example in the fixed cycle', () => {
    // ARRANGE — the feed starts with the first three examples
    const m = mount();
    const root = m.root;
    const batch = batchButton(root);
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

  it('unlocks Counting at press 2 and Rhyming at press 3 (mixed diet)', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const batch = batchButton(root);

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
    const batch = batchButton(root);

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
    const batch = batchButton(root);

    // ACT
    setStop(root, '3');

    // ASSERT — capped at the real Llama 3.1 figure, button locks,
    // the completion note replaces the hint
    expect(counterOf(root)).toBe('15T');
    expect(batch.disabled).toBe(true);
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
