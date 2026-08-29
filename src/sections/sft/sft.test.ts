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

const userText = (root: HTMLElement) =>
  root.querySelector('.sft-msg--user')?.textContent ?? '';

const baseText = (root: HTMLElement) =>
  root.querySelector('.sft-panel--base .sft-msg--model')?.textContent ?? '';

const instructText = (root: HTMLElement) =>
  root.querySelector('.sft-panel--instruct .sft-msg--model')?.textContent ?? '';

const countText = (root: HTMLElement) =>
  root.querySelector('.sft-strip-count')?.textContent ?? '';

const qualityNow = (root: HTMLElement) =>
  root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? '';

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

describe('add examples stepper', () => {
  it('walks 1 → 10 → 100 with quality 20% → 60% → 90%', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const add = within(root).getByRole('button', { name: 'Add 10 examples' }) as HTMLButtonElement;
    const note = root.querySelector<HTMLElement>('.sft-quality-note');

    expect(countText(root)).toBe('1 example');
    expect(qualityNow(root)).toBe('20');
    expect(note?.hidden).toBe(true);

    // ACT — press 1: 10 examples, 60%
    add.click();
    expect(countText(root)).toBe('10 examples');
    expect(qualityNow(root)).toBe('60');
    expect(note?.hidden).toBe(true);

    // ACT — press 2: 100 examples, 90%, the quality note appears
    add.click();
    expect(countText(root)).toBe('100 examples');
    expect(qualityNow(root)).toBe('90');
    expect(note?.hidden).toBe(false);
    expect(note?.textContent).toBe('Quality beats quantity');

    // ASSERT — capped: the stepper locks
    expect(add.disabled).toBe(true);
  });
});

describe('show a training pair', () => {
  it('reveals the fixed instruction/response card', () => {
    // ARRANGE — hidden at first
    const m = mount();
    const root = m.root;
    const btn = within(root).getByRole('button', { name: 'Show a training pair' }) as HTMLButtonElement;
    const card = root.querySelector<HTMLElement>('.sft-pair');
    expect(card?.hidden).toBe(true);

    // ACT
    btn.click();

    // ASSERT — the fixed pair is visible and the button locks
    expect(card?.hidden).toBe(false);
    expect(within(root).getByText('Instruction:')).toBeTruthy();
    expect(within(root).getByText('Response:')).toBeTruthy();
    const texts = Array.from(root.querySelectorAll('.sft-pair-text')).map((el) =>
      el.textContent ?? '',
    );
    expect(texts[0]).toBe('Write a haiku about autumn.');
    expect(texts[1]).toBe('Red leaves let go slow\na gust takes them all away\none bare branch remains');
    expect(btn.disabled).toBe(true);
  });
});
