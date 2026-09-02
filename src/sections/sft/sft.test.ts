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

const userText = (root: HTMLElement) =>
  root.querySelector('.sft-msg--user')?.textContent ?? '';

const baseText = (root: HTMLElement) =>
  root.querySelector('.sft-panel--base .sft-msg--model')?.textContent ?? '';

const instructText = (root: HTMLElement) =>
  root.querySelector('.sft-panel--instruct .sft-msg--model')?.textContent ?? '';

const countText = (root: HTMLElement) =>
  root.querySelector('.sft-strip-count')?.textContent ?? '';

const qualityValue = (root: HTMLElement) =>
  root.querySelector('.sft-quality-value')?.textContent ?? '';

const qualityNow = (root: HTMLElement) =>
  root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? '';

const pairCard = (root: HTMLElement) => root.querySelector<HTMLElement>('.sft-pair');

const pairTexts = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('.sft-pair-text')).map((el) => el.textContent ?? '');

const pairNoteText = (root: HTMLElement) =>
  root.querySelector('.sft-pair-note')?.textContent ?? '';

const sliderOf = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('.sft-quality-slider');

const setStop = (root: HTMLElement, value: string) => {
  const slider = sliderOf(root);
  if (!slider) throw new Error('coaching slider not found');
  slider.value = value;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
};

const mistakeButton = (root: HTMLElement, label: string) =>
  within(root).getByRole('button', { name: label }) as HTMLButtonElement;

describe('sft page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', {
        level: 1,
        name: 'From word-guessing to helping',
      }),
    ).not.toBeNull();
    expect(within(m.root).getByText("05 · How it's trained")).toBeTruthy();
    expect(
      within(m.root).getByText('A little coaching turns a prediction machine into an assistant.'),
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

    // ASSERT — the 3D twin-cloud layer renders its fallback note in jsdom
    expect(m.root.querySelector('.viz-fallback')).not.toBeNull();
    expect(m.root.querySelector('canvas')).toBeNull();
  });
});

describe('initial state', () => {
  it('slider at stop 1, quality 20%, no mistake selected, pair hidden', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const slider = sliderOf(root);

    // ASSERT — stop 1 of the coaching slider
    expect(slider?.value).toBe('0');
    expect(countText(root)).toBe('1 example');
    expect(qualityNow(root)).toBe('20');
    expect(qualityValue(root)).toBe('20%');
    expect((root.querySelector('.sft-quality-note') as HTMLElement).hidden).toBe(true);

    // ASSERT — no mistake selected, the pair card is hidden, the hint returns
    const mistakes = Array.from(root.querySelectorAll<HTMLElement>('.sft-mistake'));
    expect(mistakes).toHaveLength(3);
    for (const btn of mistakes) expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(pairCard(root)?.hidden).toBe(true);
    expect((root.querySelector('.sft-pair-hint') as HTMLElement).hidden).toBe(false);
    expect(root.querySelector('.sft-pair-hint')?.textContent).toBe(
      'Pick a mistake to see the coaching pair.',
    );
  });
});

describe('prompt picker', () => {
  it('defaults to "What\'s a good recipe?" on load', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT — the default prompt is live in both panels
    expect(userText(root)).toBe("What's a good recipe?");
    expect(
      within(root)
        .getByRole('button', { name: "What's a good recipe?" })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it.each([
    ['Write a haiku', 'haiku come from Japan', 'one ripple, then still'],
    ['What\'s a good recipe?', 'a recipe is a list of steps', "It's mostly garlic."],
    ['Explain gravity', 'the Earth is a planet in the solar system', 'bent around anything heavy'],
  ] as const)(
    '"%s" updates both panels with its fixed pair',
    (label, basePart, instructPart) => {
      // ARRANGE
      const m = mount();
      const root = m.root;
      const btn = within(root).getByRole('button', { name: label });

      // ACT
      btn.click();

      // ASSERT — same prompt in both panels, fixed raw answer vs. coached answer
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(root.querySelectorAll('.sft-msg--user')).toHaveLength(2);
      expect(userText(root)).toBe(label);
      expect(baseText(root)).toContain(basePart);
      expect(instructText(root)).toContain(instructPart);
    },
  );
});

describe('coaching slider', () => {
  it('walks 1 → 10 → 100 with quality 20% → 60% → 90%', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const note = root.querySelector<HTMLElement>('.sft-quality-note');

    // ACT — stop 10: 10 examples, 60%
    setStop(root, '1');
    expect(countText(root)).toBe('10 examples');
    expect(qualityNow(root)).toBe('60');
    expect(qualityValue(root)).toBe('60%');
    expect(note?.hidden).toBe(true);

    // ACT — stop 100: 100 examples, 90%, the quality note appears
    setStop(root, '2');
    expect(countText(root)).toBe('100 examples');
    expect(qualityNow(root)).toBe('90');
    expect(qualityValue(root)).toBe('90%');
    expect(note?.hidden).toBe(false);
    expect(note?.textContent).toBe('Quality beats quantity');

    // ASSERT — back to stop 1 again (the slider is not a one-way stepper)
    setStop(root, '0');
    expect(countText(root)).toBe('1 example');
    expect(qualityValue(root)).toBe('20%');
    expect(note?.hidden).toBe(true);
  });
});

describe('what did it get wrong?', () => {
  it.each([
    [
      'Rambles on',
      'Write a haiku about autumn.',
      'Red leaves let go slow\na gust takes them all away\none bare branch remains',
      'The base model kept going for 400 words. The pair teaches it to stop.',
    ],
    [
      'Ignores the question',
      'What color is the sky?',
      'Blue. (Sometimes grey, sometimes pink at sunset.)',
      'The base model gave a history of optics. The pair teaches it to answer, then stop.',
    ],
    [
      'Wrong format',
      'List the days of the week.',
      'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
      'The base model wrote an essay about calendars. The pair teaches it the shape of the answer.',
    ],
  ] as const)('"%s" reveals its fixed coaching pair', (label, instruction, response, noteText) => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = mistakeButton(root, label);

    // ACT
    btn.click();

    // ASSERT — the card is visible with the exact pair, the hint is gone
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(pairCard(root)?.hidden).toBe(false);
    expect(pairTexts(root)).toEqual([instruction, response]);
    expect(pairNoteText(root)).toBe(noteText);
    expect((root.querySelector('.sft-pair-hint') as HTMLElement).hidden).toBe(true);
  });

  it('re-clicking the selected mistake deselects it', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = mistakeButton(root, 'Rambles on');

    // ACT — select, then re-click to deselect
    btn.click();
    expect(pairCard(root)?.hidden).toBe(false);
    btn.click();

    // ASSERT — the card hides and the hint returns
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(pairCard(root)?.hidden).toBe(true);
    expect((root.querySelector('.sft-pair-hint') as HTMLElement).hidden).toBe(false);
    expect(root.querySelector('.sft-pair-hint')?.textContent).toBe(
      'Pick a mistake to see the coaching pair.',
    );
  });

  it('switching mistakes swaps the pair content', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — select one mistake, then switch to another
    mistakeButton(root, 'Rambles on').click();
    mistakeButton(root, 'Ignores the question').click();

    // ASSERT — only the new mistake is pressed, with its pair
    expect(mistakeButton(root, 'Rambles on').getAttribute('aria-pressed')).toBe('false');
    expect(mistakeButton(root, 'Ignores the question').getAttribute('aria-pressed')).toBe('true');
    expect(pairTexts(root)).toEqual([
      'What color is the sky?',
      'Blue. (Sometimes grey, sometimes pink at sunset.)',
    ]);
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
