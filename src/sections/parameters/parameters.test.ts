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

const statusText = (root: HTMLElement) =>
  root.querySelector('.par-status')?.textContent ?? '';

const trainButton = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Train one step' }) as HTMLButtonElement;

const topicButton = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;

const knobCards = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.par-knob-card'));

/** Click `Train one step` `n` times. */
function trainTo(root: HTMLElement, n: number): void {
  const train = trainButton(root);
  for (let i = 0; i < n; i += 1) train.click();
}

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

describe('initial state', () => {
  it('starts on Poetry with four named knob cards and an enabled train button', () => {
    // ARRANGE + ACT
    const m = mount();
    const root = m.root;

    // ASSERT — topic picker: three buttons, Poetry pressed by default
    for (const name of ['Poetry', 'Facts', 'Code']) {
      const btn = topicButton(root, name);
      expect(btn.classList.contains('par-topic')).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe(String(name === 'Poetry'));
    }

    // ASSERT — four knob cards with exact names and ids
    const cards = knobCards(root);
    expect(cards).toHaveLength(4);
    const names = [
      'The "is"-after-"the" knob',
      'The "moon"-in-poems knob',
      'The "capital-cities" knob',
      'The "brackets" knob',
    ];
    const ids = ['#4,291,114 · 0.42', '#612,084 · 0.87', '#6,930,551 · 0.13', '#1,547,302 · 0.66'];
    cards.forEach((card, i) => {
      expect(within(card).getByText(names[i])).toBeTruthy();
      expect(within(card).getByText(ids[i])).toBeTruthy();
      expect(card.getAttribute('aria-pressed')).toBe('false');
    });

    // ASSERT — train enabled, step-0 status, test card placeholder
    expect(trainButton(root).disabled).toBe(false);
    expect(statusText(root)).toContain('factory setting');
    expect(root.querySelector('.par-test-empty')?.textContent).toBe(
      'Finish training to test the model.',
    );
    expect(root.querySelector('.viz-fallback')).not.toBeNull();
  });
});

describe('training steps with a topic', () => {
  it('starts at zero steps with an empty knowledge meter', () => {
    // ARRANGE + ACT
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('0 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('0%');
    expect(statusText(root)).toBe('Step 0 of 10 — every knob is still at its factory setting.');
  });

  it('Poetry: steps 3, 6 and 10 hit the milestone captions and unlock the test card', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT + ASSERT — 3 steps: the poetry milestone-3 line
    trainTo(root, 3);
    expect(statusText(root)).toBe('It can rhyme "rose" with "goes" — barely.');
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('3 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('30%');

    // ACT + ASSERT — 3 more: milestone-6
    trainTo(root, 3);
    expect(statusText(root)).toBe(
      'It writes passable haiku with a suspicious amount of "moon".',
    );

    // ACT + ASSERT — 4 more: milestone-10, train disabled, test card unlocked
    trainTo(root, 4);
    expect(statusText(root)).toBe(
      'It finished the poetry course. Ask it for a haiku about coffee.',
    );
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('10 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-meter-fill')?.style.width).toBe('100%');
    expect(trainButton(root).disabled).toBe(true);
    trainTo(root, 1); // disabled — no further advance
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('10 of 10 steps');
    expect(root.querySelector<HTMLElement>('.par-test-prompt')?.hidden).toBe(false);
    expect(root.querySelector('.par-test-prompt')?.textContent).toBe(
      'Write a haiku about coffee',
    );
  });

  it('the test answer is a one-shot reveal, then the button disables', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    trainTo(root, 10);
    const reveal = within(root).getByRole('button', { name: 'Reveal answer' }) as HTMLButtonElement;
    expect(reveal.disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('.par-test-answer')?.hidden).toBe(true);

    // ACT
    reveal.click();

    // ASSERT — exact answer visible, button disabled; a second click is a no-op
    expect(root.querySelector<HTMLElement>('.par-test-answer')?.hidden).toBe(false);
    expect(root.querySelector('.par-test-answer')?.textContent).toBe(
      'Steam curls, then stills — / the cup holds the morning sun / one sip, and the day starts',
    );
    expect(reveal.disabled).toBe(true);
    reveal.click();
    expect(root.querySelector<HTMLElement>('.par-test-answer')?.hidden).toBe(false);
  });

  it('switching topic at step 10 keeps the milestone (in the new topic’s voice) and swaps the test', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    trainTo(root, 10);
    expect(statusText(root)).toContain('poetry course');

    // ACT — switch to Facts without losing the ten steps
    topicButton(root, 'Facts').click();

    // ASSERT — still on milestone-10 (Facts line), test prompt swapped
    expect(statusText(root)).toBe('It finished the facts course. Ask it where the Nile flows.');
    expect(root.querySelector('.par-meter-count')?.textContent).toBe('10 of 10 steps');
    expect(root.querySelector('.par-test-prompt')?.textContent).toBe('Where does the Nile flow?');
    expect(topicButton(root, 'Facts').getAttribute('aria-pressed')).toBe('true');
  });

  it('the generic step line is used for non-milestone steps', () => {
    // ARRANGE + ACT
    const m = mount();
    const root = m.root;
    trainTo(root, 4);

    // ASSERT
    expect(statusText(root)).toBe('Step 4 of 10 — 800 of 2,000 knobs nudged so far.');
  });
});

describe('knob cards', () => {
  it('select and deselect with the exact spotlight tooltip text', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const tip = root.querySelector<HTMLElement>('.par-tip');
    const cards = knobCards(root);
    expect(tip?.hidden).toBe(true);

    // ACT + ASSERT — select the "moon"-in-poems knob
    cards[1].click();
    expect(tip?.hidden).toBe(false);
    expect(tip?.textContent).toBe('Knob #612,084 · value 0.87');
    expect(cards[1].getAttribute('aria-pressed')).toBe('true');

    // ACT + ASSERT — clicking the selected card again deselects
    cards[1].click();
    expect(tip?.hidden).toBe(true);
    expect(cards[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('the favourite knob card follows the topic', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const favIndex = () =>
      knobCards(root).findIndex((card) => card.classList.contains('par-knob-card--fav'));

    // ASSERT + ACT — Poetry → card 1 (the "moon"-in-poems knob)
    expect(favIndex()).toBe(1);

    // ACT + ASSERT — Facts → card 2 (the "capital-cities" knob)
    topicButton(root, 'Facts').click();
    expect(favIndex()).toBe(2);

    // ACT + ASSERT — Code → card 3 (the "brackets" knob)
    topicButton(root, 'Code').click();
    expect(favIndex()).toBe(3);
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
