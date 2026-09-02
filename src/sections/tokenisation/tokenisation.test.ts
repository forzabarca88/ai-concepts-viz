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

/** The fixed subword table the stage starts with (text keeps its leading space). */
const CHIPS: ReadonlyArray<readonly [text: string, id: number]> = [
  ['I', 52],
  [' love', 418],
  [' learning', 1159],
  [' about', 623],
  [' AI', 65211],
  ['!', 0],
];

const chipEls = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.tok-chip'));

const setGrain = (root: HTMLElement, value: string) => {
  const slider = root.querySelector<HTMLInputElement>('.tok-grain-slider');
  if (!slider) throw new Error('grain slider not found');
  slider.value = value;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
};

const inspector = (root: HTMLElement) => ({
  box: root.querySelector<HTMLElement>('.tok-insp'),
  text: root.querySelector<HTMLElement>('.tok-insp-text')?.textContent ?? '',
  id: root.querySelector<HTMLElement>('.tok-insp-id')?.textContent ?? '',
  badge: root.querySelector<HTMLElement>('.tok-insp-badge')?.textContent ?? '',
});

describe('tokenisation page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', {
        level: 1,
        name: "Words aren't words — they're tokens",
      }),
    ).not.toBeNull();
    expect(within(m.root).getByText('02 · Core ideas')).toBeTruthy();
    expect(
      within(m.root).getByText(
        "Models can't read letters. They read text in small chunks called tokens.",
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

describe('token chips → inspector', () => {
  it('every chip click shows its token text, id and "piece of a word" badge', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const chips = chipEls(root);
    expect(chips).toHaveLength(6);

    // ACT + ASSERT — loop over ALL chips
    chips.forEach((chip, i) => {
      chip.click();
      const [text, id] = CHIPS[i];
      expect(root.querySelector<HTMLElement>('.tok-insp-empty')?.hidden).toBe(true);
      const insp = inspector(root);
      expect(insp.box?.hidden).toBe(false);
      expect(insp.text).toBe(text);
      expect(insp.id).toBe(`id ${id}`);
      expect(insp.badge).toBe('piece of a word');
      chips.forEach((other, j) =>
        expect(other.getAttribute('aria-pressed')).toBe(String(j === i)),
      );
    });
  });
});

describe('add an emoji', () => {
  it('appends the rocket as three chips, shows the note and disables itself', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const btn = within(root).getByRole('button', { name: 'Add an emoji' });

    // ACT
    btn.click();

    // ASSERT — button locks, note appears, three rocket chips appended
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(within(root).getByText('Even robots can break!')).toBeTruthy();
    const chips = chipEls(root);
    expect(chips).toHaveLength(9);

    // the first rocket fragment is inspectable like any other token
    chips[6].click();
    const insp = inspector(root);
    expect(insp.text).toBe('🚀');
    expect(insp.id).toBe('id 17184');
    expect(insp.badge).toBe('piece of an emoji');
  });
});

describe('grain slider', () => {
  it.each([
    ['0', 21, 'Character'],
    ['1', 6, 'Subword'],
    ['2', 5, 'Word'],
  ] as const)('stop %s regroups the sentence into %i chips (%s)', (value, count, label) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    setGrain(root, value);

    // ASSERT — chips regroup, count + active stop update
    expect(chipEls(root)).toHaveLength(count);
    expect(root.querySelector('.tok-grain-count')?.textContent).toBe(`${count} chips`);
    expect(root.querySelector('.tok-grain-tick--active')?.textContent).toBe(label);
  });

  it('the rocket respects the grain: three fragments at character, one "word" at word', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    within(root).getByRole('button', { name: 'Add an emoji' }).click();

    // ACT + ASSERT
    setGrain(root, '0');
    expect(chipEls(root)).toHaveLength(24);
    setGrain(root, '2');
    expect(chipEls(root)).toHaveLength(6);
  });
});

describe('type your own sentence', () => {
  const setTyped = (root: HTMLElement, value: string) => {
    const input = root.querySelector<HTMLInputElement>('.tok-typed-input');
    if (!input) throw new Error('typed input not found');
    input.value = value;
  };

  const go = (root: HTMLElement) =>
    within(root).getByRole('button', { name: 'Tokenise it' }).click();

  it('initial state: reset is disabled and the empty note is hidden', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    const resetBtn = within(root)
      .getByRole('button', { name: 'Back to the example' }) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('.tok-typed-empty')?.hidden).toBe(true);
    expect(
      within(root).getByText('Watch your words become tokens — the same rules apply.'),
    ).toBeTruthy();
  });

  it('a typed sentence replaces the stage: exactly 7 chips, example controls disabled', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    setTyped(root, 'The cat sat on the moon!');
    go(root);

    // ASSERT — exactly 7 chips, in order, in the existing chip style
    const chips = chipEls(root);
    expect(chips.map((c) => c.textContent)).toEqual([
      'The',
      'cat',
      'sat',
      'on',
      'the',
      'moon',
      '!',
    ]);
    expect(root.querySelector('.tok-grain-count')?.textContent).toBe('7 chips');
    const slider = root.querySelector<HTMLInputElement>('.tok-grain-slider');
    expect(slider?.disabled).toBe(true);
    const emojiBtn = within(root)
      .getByRole('button', { name: 'Add an emoji' }) as HTMLButtonElement;
    expect(emojiBtn.disabled).toBe(true);
    expect(
      within(root).getByText('Grain view uses the example sentence.'),
    ).toBeTruthy();
    const resetBtn = within(root)
      .getByRole('button', { name: 'Back to the example' }) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(false);
  });

  it('typed chips inspect with their own badge and id: moon → id 200 word, ! → punctuation —', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    setTyped(root, 'The cat sat on the moon!');
    go(root);
    const chips = chipEls(root);

    // ACT + ASSERT — dictionary word
    chips[5].click();
    let insp = inspector(root);
    expect(insp.text).toBe('moon');
    expect(insp.id).toBe('id 200');
    expect(insp.badge).toBe('word');

    // ACT + ASSERT — punctuation
    chips[6].click();
    insp = inspector(root);
    expect(insp.text).toBe('!');
    expect(insp.id).toBe('—');
    expect(insp.badge).toBe('punctuation');
  });

  it('an unfamiliar word fragments into 3-letter pieces', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    setTyped(root, 'xylophone');
    go(root);

    // ASSERT — three fragmented chips, each badged "unfamiliar piece"
    const chips = chipEls(root);
    expect(chips.map((c) => c.textContent)).toEqual(['xyl', 'oph', 'one']);
    chips.forEach((chip) => {
      chip.click();
      const insp = inspector(root);
      expect(insp.badge).toBe('unfamiliar piece');
    });
  });

  it('empty input shows the note and keeps the example chips', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    setTyped(root, '   ');
    go(root);

    // ASSERT
    expect(root.querySelector<HTMLElement>('.tok-typed-empty')?.hidden).toBe(false);
    expect(within(root).getByText('Type something first.')).toBeTruthy();
    expect(chipEls(root)).toHaveLength(6);
  });

  it('Back to the example restores the sentence and re-enables the grain slider', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    setTyped(root, 'The cat sat on the moon!');
    go(root);

    // ACT
    within(root).getByRole('button', { name: 'Back to the example' }).click();

    // ASSERT — example chips back, slider enabled, note hidden, reset disabled
    expect(chipEls(root)).toHaveLength(6);
    const slider = root.querySelector<HTMLInputElement>('.tok-grain-slider');
    expect(slider?.disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('.tok-typed-empty')?.hidden).toBe(true);
    const resetBtn = within(root)
      .getByRole('button', { name: 'Back to the example' }) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(true);
  });
});

describe('next-token mini', () => {
  it.each([
    ['mat', 'The cat sat on the mat', 0],
    ['floor', 'The cat sat on the floor', 1],
    ['moon', 'The cat sat on the moon', 2],
  ] as const)('clicking "%s" completes the sentence', (word, full, picked) => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    within(root).getByRole('button', { name: new RegExp(word) }).click();

    // ASSERT — sentence completes, chosen candidate lit, explainer shown
    const sentence =
      root.querySelector('.tok-next-sentence')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(sentence).toBe(full);
    root.querySelectorAll<HTMLElement>('.tok-next-cand').forEach((cand, i) => {
      expect(cand.getAttribute('aria-pressed')).toBe(String(i === picked));
    });
    expect(root.querySelector<HTMLElement>('.tok-next-explain')?.hidden).toBe(false);
  });
});
