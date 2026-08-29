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

const fmt = new Intl.NumberFormat('en-US');

/** Drive the size slider like a user would: set value, fire `input`. */
function setSize(root: HTMLElement, value: number): void {
  const slider = root.querySelector<HTMLInputElement>('.par-size-slider');
  if (!slider) throw new Error('size slider not found');
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

const metricValue = (root: HTMLElement) =>
  root.querySelector('.par-metric .metric-value')?.textContent ?? '';

describe('parameters hero + template', () => {
  it('renders the eyebrow, h1, lede and the three shared explain cards', () => {
    // ARRANGE + ACT
    const m = mount();

    // ASSERT
    expect(
      within(m.root).getByRole('heading', { level: 1, name: 'Billions of tiny knobs' }),
    ).not.toBeNull();
    expect(within(m.root).getByText('03 · Core ideas')).toBeTruthy();
    expect(
      within(m.root).getByText(
        "Everything a model 'knows' lives in billions of numbers, nudged a little at a time.",
      ),
    ).toBeTruthy();
    expect(m.root.querySelectorAll('.explain-card')).toHaveLength(3);
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(m.root).getByText(title)).toBeTruthy();
    }
  });

  it('degrades to the .viz-fallback in jsdom, without a canvas', () => {
    const m = mount();
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });
});

describe('training steps', () => {
  it('starts at zero steps with an empty knowledge meter', () => {
    // ARRANGE + ACT
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('0 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('0%');
    expect(root.querySelector('.par-status')?.textContent).toContain('factory setting');
    expect(
      (within(root).getByRole('button', { name: 'Train one step' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('each train step advances the counter, the meter and the nudged-knob sequence', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const train = within(root).getByRole('button', { name: 'Train one step' }) as HTMLButtonElement;

    // ACT + ASSERT — step 1: the first seeded batch (200 knobs) moves
    train.click();
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('1 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('10%');
    expect(root.querySelector('.par-status')?.textContent).toContain('200 of 2,000');

    // ACT + ASSERT — steps 2–5 follow the seeded sequence
    for (let i = 0; i < 4; i++) train.click();
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('5 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('50%');
    expect(root.querySelector('.par-status')?.textContent).toContain('1,000 of 2,000');

    // ACT + ASSERT — steps 6–10: every knob nudged, then the button disables
    for (let i = 0; i < 5; i++) train.click();
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('10 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('100%');
    expect(root.querySelector('.par-status')?.textContent).toContain('All 2,000 knobs nudged');
    expect(train.disabled).toBe(true);
    train.click(); // disabled — no further advance
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('10 of 10 steps');
  });
});

describe('size slider', () => {
  it('defaults to the 7B model', () => {
    // ARRANGE + ACT
    const m = mount();

    // ASSERT
    expect(metricValue(m.root)).toBe(fmt.format(7_000_000_000));
    expect(m.root.querySelector('.par-metric .metric-label')?.textContent).toBe('knobs');
    expect(m.root.querySelector('.par-tick--active')?.textContent).toBe('7B');
  });

  it.each([
    [0, '1,000,000', '1M'],
    [1, '7,000,000,000', '7B'],
    [2, '70,000,000,000', '70B'],
  ] as const)('stop %i sets the metric to %s knobs (%s)', (value, text, label) => {
    // ARRANGE
    const m = mount();

    // ACT
    setSize(m.root, value);

    // ASSERT — metric text + active stop
    expect(metricValue(m.root)).toBe(text);
    expect(m.root.querySelector('.par-tick--active')?.textContent).toBe(label);
  });
});

describe('inspect a knob', () => {
  it('hidden until pressed, then cycles the fixed knob order with id + value', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const tip = root.querySelector<HTMLElement>('.par-tip');
    const inspect = within(root).getByRole('button', { name: 'Inspect a knob' });
    expect(tip?.hidden).toBe(true);

    // ACT + ASSERT — 1st press → knob A, …, 5th press wraps back to A
    const expected = [
      'Knob #4,291,114 · value 0.42',
      'Knob #612,084 · value 0.87',
      'Knob #6,930,551 · value 0.13',
      'Knob #1,547,302 · value 0.66',
      'Knob #4,291,114 · value 0.42',
    ];
    for (const text of expected) {
      inspect.click();
      expect(tip?.hidden).toBe(false);
      expect(tip?.textContent).toBe(text);
    }
  });
});
