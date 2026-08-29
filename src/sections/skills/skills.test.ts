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

const statusText = (root: HTMLElement) =>
  root.querySelector('.skill-status')?.textContent ?? '';

const countText = (root: HTMLElement) =>
  root.querySelector('.skill-inv-count')?.textContent ?? '';

const cardFor = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll('.skill-card')).find((c) =>
    (c.textContent ?? '').includes(name),
  );

const teachButton = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Teach a skill' }) as HTMLButtonElement;

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

  it('starts empty: no skills, no task, idle readiness line', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(within(root).getByText('No skills yet — just a very smart mind')).toBeTruthy();
    expect(root.querySelectorAll('.skill-card')).toHaveLength(0);
    expect(root.querySelectorAll('.skill-task')).toHaveLength(3);
    expect(root.querySelectorAll('.skill-task[aria-pressed="true"]')).toHaveLength(0);
    expect(statusText(root)).toBe('Pick a task to check.');
    expect(countText(root)).toBe('0 / 3');
  });
});

describe('teach a skill', () => {
  it('cycles the three fixed skills in order, then locks', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    const teach = teachButton(root);

    // ACT — press 1
    teach.click();
    expect(within(root).getByText('Browse the web', { exact: true })).toBeTruthy();
    expect(within(root).getByText('Learned!', { exact: true })).toBeTruthy();
    expect((root.querySelector('.skill-empty') as HTMLElement).hidden).toBe(true);
    expect(countText(root)).toBe('1 / 3');

    // ACT — press 2
    teach.click();
    expect(within(root).getByText('Write code', { exact: true })).toBeTruthy();
    expect(countText(root)).toBe('2 / 3');

    // ACT — press 3
    teach.click();
    expect(within(root).getByText('Summarize', { exact: true })).toBeTruthy();
    expect(countText(root)).toBe('3 / 3');

    // ASSERT — capped: the button locks
    expect(teach.disabled).toBe(true);
  });
});

describe('task picker', () => {
  it('a task whose skill is learned reads Ready! 🎒 and glows the card', () => {
    // ARRANGE — learn Browse the web (the trail task needs it)
    const m = mount();
    const root = m.root;
    teachButton(root).click();
    const task = within(root).getByRole('button', {
      name: /Find Portland's best hiking trail/,
    });

    // ACT
    task.click();

    // ASSERT
    expect(task.getAttribute('aria-pressed')).toBe('true');
    expect(statusText(root)).toBe('Ready! 🎒');
    const needed = root.querySelector('.skill-card--needed');
    expect(needed?.textContent).toContain('Browse the web');
  });

  it('a task whose skill is not learned reads Not ready + Missing: <skill>', () => {
    // ARRANGE — only Browse is learned; the script task needs Write code
    const m = mount();
    const root = m.root;
    teachButton(root).click();

    // ACT
    within(root).getByRole('button', { name: /Write a script to rename files/ }).click();

    // ASSERT
    expect(statusText(root)).toBe('Not ready');
    expect(within(root).getByText('Missing: Write code', { exact: true })).toBeTruthy();
    expect(root.querySelector('.skill-card--needed')).toBeNull();
  });

  it('deselecting the task returns the readiness line to idle', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    teachButton(root).click();
    const task = within(root).getByRole('button', {
      name: /Find Portland's best hiking trail/,
    });

    // ACT — select, then deselect
    task.click();
    expect(statusText(root)).toBe('Ready! 🎒');
    task.click();

    // ASSERT
    expect(task.getAttribute('aria-pressed')).toBe('false');
    expect(statusText(root)).toBe('Pick a task to check.');
  });
});

describe('forget a skill', () => {
  it('removes the card and flips readiness to Not ready', () => {
    // ARRANGE — Browse learned, trail task selected (Ready)
    const m = mount();
    const root = m.root;
    const teach = teachButton(root);
    teach.click();
    within(root).getByRole('button', { name: /Find Portland's best hiking trail/ }).click();
    expect(statusText(root)).toBe('Ready! 🎒');

    // ACT — forget the skill the selected task needs
    const card = cardFor(root, 'Browse the web');
    expect(card).toBeTruthy();
    within(card as HTMLElement).getByRole('button', { name: 'Forget' }).click();

    // ASSERT — card gone, empty state back, readiness flipped
    expect(root.querySelectorAll('.skill-card')).toHaveLength(0);
    expect(within(root).getByText('No skills yet — just a very smart mind')).toBeTruthy();
    expect(statusText(root)).toBe('Not ready');
    expect(within(root).getByText('Missing: Browse the web', { exact: true })).toBeTruthy();

    // ASSERT — the forgotten slot reopens: the cycle teaches it again
    expect(teach.disabled).toBe(false);
    teach.click();
    expect(within(root).getByText('Browse the web', { exact: true })).toBeTruthy();
    expect(statusText(root)).toBe('Ready! 🎒');
  });

  it('forgetting a skill the task does not need leaves readiness alone', () => {
    // ARRANGE — Browse + Write code learned, script task selected (Ready)
    const m = mount();
    const root = m.root;
    const teach = teachButton(root);
    teach.click();
    teach.click();
    within(root).getByRole('button', { name: /Write a script to rename files/ }).click();
    expect(statusText(root)).toBe('Ready! 🎒');

    // ACT — forget Browse (not needed by the selected task)
    within(cardFor(root, 'Browse the web') as HTMLElement)
      .getByRole('button', { name: 'Forget' })
      .click();

    // ASSERT — still ready; the Write code card still glows
    expect(statusText(root)).toBe('Ready! 🎒');
    expect(within(root).getByText('Write code', { exact: true })).toBeTruthy();
    const needed = root.querySelector('.skill-card--needed');
    expect(needed?.textContent).toContain('Write code');
  });
});
