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

const statusText = (root: HTMLElement) =>
  root.querySelector('.skill-status')?.textContent ?? '';

const countText = (root: HTMLElement) =>
  root.querySelector('.skill-inv-count')?.textContent ?? '';

const teachCardFor = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('.skill-teach-card')).find((c) =>
    (c.textContent ?? '').includes(name),
  ) as HTMLElement;

const teachIn = (root: HTMLElement, name: string) =>
  within(teachCardFor(root, name)).getByRole('button', { name: 'Teach' }) as HTMLButtonElement;

const cardFor = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('.skill-card')).find((c) =>
    (c.textContent ?? '').includes(name),
  );

const selectTask = (root: HTMLElement, name: RegExp) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;

const tryTask = (root: HTMLElement) =>
  within(root).queryByRole('button', { name: 'Try the task' }) as HTMLButtonElement | null;

const TRAIL_RESULT =
  'It opened three tabs, compared reviews and settled on: Maple Ridge, 8.4 miles, one good chocolate shop at the trailhead.';

/** The single visible Done badge (hidden ones exist on the other task cards). */
const doneBadge = (root: HTMLElement) =>
  root.querySelector('.skill-task-done:not([hidden])');

const RESULTS_EMPTY = 'No results yet — teach it a skill, pick a task, then try it.';

describe('skills page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).getByRole('heading', { level: 1, name: 'Teaching it a job' }),
    ).not.toBeNull();
    expect(within(m.root).getByText('08 · Going agentic')).toBeTruthy();
    expect(
      within(m.root).getByText('An agent is a model plus a set of skills it gets to practice.'),
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

  it('starts empty: unpressed teach cards, empty inventory, results placeholder, jsdom fallback', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(root.querySelectorAll('.skill-teach-card')).toHaveLength(3);
    for (const btn of root.querySelectorAll<HTMLButtonElement>('.skill-teach')) {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    }
    expect(within(root).getByText('No skills yet — just a very smart mind')).toBeTruthy();
    expect(countText(root)).toBe('0 / 3');
    expect(root.querySelectorAll('.skill-task')).toHaveLength(3);
    expect(root.querySelectorAll('.skill-task[aria-pressed="true"]')).toHaveLength(0);
    expect(statusText(root)).toBe('Pick a task to check.');
    expect(tryTask(root)).toBeNull();
    expect(within(root).getByText(RESULTS_EMPTY, { exact: true })).toBeTruthy();
    expect(within(root).getByText('Teach a skill — pick which one first.')).toBeTruthy();
    expect(root.querySelector('.viz-fallback')).toBeTruthy();
  });
});

describe('teach cards', () => {
  it('teaching a skill lights a chest light and adds the Learned! badge', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const teach = teachIn(root, 'Browse the web');

    // ACT
    teach.click();

    // ASSERT
    expect(teach.getAttribute('aria-pressed')).toBe('true');
    expect(countText(root)).toBe('1 / 3');
    expect(root.querySelectorAll('.sk-light--on')).toHaveLength(1);
    expect(within(root).getByText('Learned!', { exact: true })).toBeTruthy();
    expect(within(root).getByText('The backpack holds 1 of 3 skills.')).toBeTruthy();
  });

  it('teaching all three fills the backpack and the hint', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — teach in an arbitrary order (the user picks)
    teachIn(root, 'Summarize').click();
    teachIn(root, 'Browse the web').click();
    expect(within(root).getByText('The backpack holds 2 of 3 skills.')).toBeTruthy();
    teachIn(root, 'Write code').click();

    // ASSERT
    expect(countText(root)).toBe('3 / 3');
    expect(root.querySelectorAll('.sk-light--on')).toHaveLength(3);
    expect(within(root).getByText('All 3 skills learned — the backpack is full.')).toBeTruthy();
  });
});

describe('task picker', () => {
  it('a task whose skill is learned reads Ready! 🎒, offers Try the task, and glows the card', () => {
    // ARRANGE — learn Browse the web (the trail task needs it)
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    const task = selectTask(root, /Find Portland's best hiking trail/);

    // ACT
    task.click();

    // ASSERT
    expect(task.getAttribute('aria-pressed')).toBe('true');
    expect(statusText(root)).toBe('Ready! 🎒');
    const tryBtn = tryTask(root);
    expect(tryBtn).not.toBeNull();
    expect(tryBtn?.disabled).toBe(false);
    const needed = root.querySelector('.skill-card--needed');
    expect(needed?.textContent).toContain('Browse the web');
  });

  it('a task whose skill is not learned reads Not ready + Missing: <skill>, no Try button', () => {
    // ARRANGE — only Browse is learned; the script task needs Write code
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();

    // ACT
    selectTask(root, /Write a script to rename files/).click();

    // ASSERT
    expect(statusText(root)).toBe('Not ready');
    expect(within(root).getByText('Missing: Write code', { exact: true })).toBeTruthy();
    expect(tryTask(root)).toBeNull();
    expect(root.querySelector('.skill-card--needed')).toBeNull();
  });

  it('deselecting the task returns the readiness line to idle', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    const task = selectTask(root, /Find Portland's best hiking trail/);

    // ACT — select, then deselect
    task.click();
    expect(statusText(root)).toBe('Ready! 🎒');
    task.click();

    // ASSERT
    expect(task.getAttribute('aria-pressed')).toBe('false');
    expect(statusText(root)).toBe('Pick a task to check.');
    expect(tryTask(root)).toBeNull();
  });
});

describe('try the task', () => {
  it('a ready task prints its exact result line, earns Done ✓ and locks the button', () => {
    // ARRANGE — Browse learned, trail task selected (Ready)
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    selectTask(root, /Find Portland's best hiking trail/).click();
    const tryBtn = tryTask(root) as HTMLButtonElement;
    expect(tryBtn.disabled).toBe(false);

    // ACT
    tryBtn.click();

    // ASSERT
    expect(within(root).getByText(TRAIL_RESULT, { exact: true })).toBeTruthy();
    expect(doneBadge(root)?.textContent).toBe('Done ✓');
    expect(tryBtn.disabled).toBe(true);
    expect((root.querySelector('.skill-results-empty') as HTMLElement).hidden).toBe(true);
  });

  it('forgetting the skill un-readies the task and clears its result line', () => {
    // ARRANGE — tried the trail task, so its result line is on display
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    selectTask(root, /Find Portland's best hiking trail/).click();
    (tryTask(root) as HTMLButtonElement).click();
    expect(within(root).getByText(TRAIL_RESULT, { exact: true })).toBeTruthy();

    // ACT — forget the skill the task needs
    within(cardFor(root, 'Browse the web') as HTMLElement)
      .getByRole('button', { name: 'Forget' })
      .click();

    // ASSERT — readiness flipped, the result line and badge are gone
    expect(statusText(root)).toBe('Not ready');
    expect(within(root).getByText('Missing: Browse the web', { exact: true })).toBeTruthy();
    expect(within(root).queryByText(TRAIL_RESULT, { exact: true })).toBeNull();
    expect(doneBadge(root)).toBeNull();
    expect(within(root).getByText(RESULTS_EMPTY, { exact: true })).toBeTruthy();
  });
});

describe('forget a skill', () => {
  it('removes the card and flips readiness to Not ready', () => {
    // ARRANGE — Browse learned, trail task selected (Ready)
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    selectTask(root, /Find Portland's best hiking trail/).click();
    expect(statusText(root)).toBe('Ready! 🎒');

    // ACT — forget the skill the selected task needs
    within(cardFor(root, 'Browse the web') as HTMLElement)
      .getByRole('button', { name: 'Forget' })
      .click();

    // ASSERT — card gone, empty state back, readiness flipped
    expect(root.querySelectorAll('.skill-card')).toHaveLength(0);
    expect(within(root).getByText('No skills yet — just a very smart mind')).toBeTruthy();
    expect(statusText(root)).toBe('Not ready');
    expect(within(root).getByText('Missing: Browse the web', { exact: true })).toBeTruthy();

    // ASSERT — the teach card reopens: teaching it again re-readies the task
    const teach = teachIn(root, 'Browse the web');
    expect(teach.getAttribute('aria-pressed')).toBe('false');
    teach.click();
    expect(statusText(root)).toBe('Ready! 🎒');
  });

  it('forgetting a skill the task does not need leaves readiness alone', () => {
    // ARRANGE — Browse + Write code learned, script task selected (Ready)
    const m = mount();
    const root = m.root;
    teachIn(root, 'Browse the web').click();
    teachIn(root, 'Write code').click();
    selectTask(root, /Write a script to rename files/).click();
    expect(statusText(root)).toBe('Ready! 🎒');

    // ACT — forget Browse (not needed by the selected task)
    within(cardFor(root, 'Browse the web') as HTMLElement)
      .getByRole('button', { name: 'Forget' })
      .click();

    // ASSERT — still ready; the Write code card still glows
    expect(statusText(root)).toBe('Ready! 🎒');
    const codeCard = cardFor(root, 'Write code');
    expect(codeCard).toBeTruthy();
    const needed = root.querySelector('.skill-card--needed');
    expect(needed?.textContent).toContain('Write code');
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
