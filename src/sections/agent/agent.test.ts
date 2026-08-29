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

/* ---------- small helpers over the end result ---------- */

const entryTexts = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.agent-entry .agent-entry-text')).map(
    (el) => el.textContent ?? '',
  );

const entryKinds = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.agent-entry')).map((el) => {
    const kind = /agent-entry--(\w+)/.exec(el.className)?.[1];
    return kind ?? '';
  });

const phaseOn = (root: HTMLElement, phase: 'think' | 'act' | 'observe') =>
  root.querySelector<HTMLElement>(`.agent-loop-step[data-phase='${phase}']`)?.dataset.on ===
  'true';

const repeatChip = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.agent-loop-repeat');

const toolsSwitch = (root: HTMLElement) =>
  within(root).getByRole('switch', { name: 'Tools: on/off' }) as HTMLButtonElement;

const nextBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Next step' }) as HTMLButtonElement;

const skipBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Skip to the end' }) as HTMLButtonElement;

const restartBtn = (root: HTMLElement) =>
  within(root).getByRole('button', { name: 'Restart' }) as HTMLButtonElement;

const hint = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.stage-bar-hint')?.textContent ?? '';

const EMPTY_TEXT = 'Nothing yet — press Next step to start the loop.';

const fullRun = (root: HTMLElement) => {
  for (let i = 0; i < 6; i += 1) nextBtn(root).click();
};

describe('agent page', () => {
  it('renders the eyebrow, h1 and lede', () => {
    // ARRANGE
    const m = mount();

    // ASSERT — end result in the shared template
    expect(
      within(m.root).queryByRole('heading', { level: 1, name: 'Think. Act. Observe. Repeat.' }),
    ).not.toBeNull();
    expect(within(m.root).getByText('10 · Going agentic')).toBeTruthy();
    expect(
      within(m.root).getByText('Give it a goal and some tools — then watch the loop.'),
    ).toBeTruthy();
  });

  it('shows the task card and the three shared explain cards', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(
      within(root).getByText(
        'Plan a surprise birthday hike for Sam — he loves chocolate and mountains; check Saturday and email his sister.',
        { exact: true },
      ),
    ).toBeTruthy();
    expect(root.querySelector('.explain-grid')?.querySelectorAll('.explain-card')).toHaveLength(3);
    for (const title of ["What's happening", 'Why it matters', 'Fun fact']) {
      expect(within(root).getByText(title)).toBeTruthy();
    }
  });

  it('starts with tools on, an empty timeline and a dim loop badge', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('true');
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
    expect(skipBtn(root).disabled).toBe(false);
    expect(restartBtn(root).disabled).toBe(true);
    expect(phaseOn(root, 'think')).toBe(false);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(phaseOn(root, 'observe')).toBe(false);
    expect(repeatChip(root)?.textContent).toBe('Repeat');
  });
});

describe('next step', () => {
  it('step 1 appends the first thought and highlights Think', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    nextBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toEqual(['I need the date first.']);
    expect(entryKinds(root)).toEqual(['thought']);
    expect(phaseOn(root, 'think')).toBe(true);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(hint(root)).toBe('Step 1 of 6');
  });

  it('step 2 is the calendar act, step 3 the first observation', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    nextBtn(root).click();

    // ACT + ASSERT — step 2: Act phase, mono tool call
    nextBtn(root).click();
    expect(entryTexts(root)).toEqual(['I need the date first.', 'calendar.check("Saturday")']);
    expect(entryKinds(root)).toEqual(['thought', 'act']);
    expect(phaseOn(root, 'act')).toBe(true);
    expect(phaseOn(root, 'think')).toBe(false);

    // ACT + ASSERT — step 3: Observe phase
    nextBtn(root).click();
    expect(entryTexts(root)[2]).toBe('Saturday: free');
    expect(entryKinds(root)[2]).toBe('observe');
    expect(phaseOn(root, 'observe')).toBe(true);
    expect(phaseOn(root, 'act')).toBe(false);
  });

  it('six steps finish the run: 7 entries ending in the Done entry', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    fullRun(root);

    // ASSERT — the full fixed sequence, Done included
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'calendar.check("Saturday")',
      'Saturday: free',
      'web.search("Portland chocolate + hiking")',
      'Maple Ridge trail ✓',
      'email.draft(...)',
      'Done! Email drafted ✅',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'act', 'observe', 'act', 'observe', 'act', 'done']);
    expect(nextBtn(root).disabled).toBe(true);
    expect(skipBtn(root).disabled).toBe(true);
  });

  it('the Done entry sets the badge to its Done state (no phase lit)', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    fullRun(root);

    // ASSERT — no phase highlighted; the trailing chip flips to "Done ✓"
    expect(phaseOn(root, 'think')).toBe(false);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(phaseOn(root, 'observe')).toBe(false);
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
    expect(repeatChip(root)?.dataset.state).toBe('done');
    expect(hint(root)).toBe('Done! Six steps, one loop.');
  });

  it('the locked button cannot advance past the end', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    fullRun(root);
    expect(nextBtn(root).disabled).toBe(true);

    // ACT
    nextBtn(root).click();

    // ASSERT — still exactly the finished run
    expect(entryTexts(root)).toHaveLength(7);
    expect(nextBtn(root).disabled).toBe(true);
  });
});

describe('restart', () => {
  it('clears the timeline and reopens the controls', () => {
    // ARRANGE — a run in flight
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    nextBtn(root).click();
    expect(entryTexts(root)).toHaveLength(2);

    // ACT
    restartBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
    expect(skipBtn(root).disabled).toBe(false);
    expect(restartBtn(root).disabled).toBe(true);
    expect(phaseOn(root, 'think')).toBe(false);
  });

  it('is disabled while the timeline is empty', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(restartBtn(m.root).disabled).toBe(true);
  });
});

describe('skip to the end', () => {
  it('fills all remaining entries instantly from mid-run', () => {
    // ARRANGE — two steps in
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    nextBtn(root).click();
    expect(entryTexts(root)).toHaveLength(2);

    // ACT
    skipBtn(root).click();

    // ASSERT — the run is complete in one press
    expect(entryTexts(root)).toHaveLength(7);
    expect(entryTexts(root)[6]).toBe('Done! Email drafted ✅');
    expect(nextBtn(root).disabled).toBe(true);
    expect(skipBtn(root).disabled).toBe(true);
  });

  it('works from the empty timeline too', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    skipBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(7);
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
  });

  it('does nothing once the run is complete', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    fullRun(root);
    expect(skipBtn(root).disabled).toBe(true);

    // ACT
    skipBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(7);
  });
});

describe('tools on/off', () => {
  it('flipping tools mid-run restarts the run (timeline cleared)', () => {
    // ARRANGE — two steps in with tools on
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    nextBtn(root).click();
    expect(entryTexts(root)).toHaveLength(2);

    // ACT
    toolsSwitch(root).click();

    // ASSERT — the run was restarted under the new tools state
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('false');
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
  });

  it('tools off: the run is thought, failure, then "asked you instead"', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsSwitch(root).click();

    // ACT + ASSERT — step 1: the same first thought
    nextBtn(root).click();
    expect(entryTexts(root)).toEqual(['I need the date first.']);
    expect(phaseOn(root, 'think')).toBe(true);

    // ACT + ASSERT — step 2: the coral failure entry (Act phase)
    nextBtn(root).click();
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'Action failed: no calendar tool',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'failed']);
    expect(phaseOn(root, 'act')).toBe(true);

    // ACT + ASSERT — step 3: the run ends asking instead
    nextBtn(root).click();
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'Action failed: no calendar tool',
      'Gave up — and asked you instead',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'failed', 'gaveup']);
    expect(nextBtn(root).disabled).toBe(true);
    expect(skipBtn(root).disabled).toBe(true);
    expect(hint(root)).toBe('No calendar tool — it gave up and asked you instead.');
  });

  it('after the gave-up entry no phase is highlighted (stopped badge)', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsSwitch(root).click();
    nextBtn(root).click();
    nextBtn(root).click();
    nextBtn(root).click();

    // ASSERT
    expect(phaseOn(root, 'think')).toBe(false);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(phaseOn(root, 'observe')).toBe(false);
    expect(repeatChip(root)?.textContent).toBe('Repeat');
    expect(repeatChip(root)?.dataset.state).toBe('stopped');
  });

  it('skip to the end with tools off lands on the gave-up entry', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    toolsSwitch(root).click();

    // ACT
    skipBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'Action failed: no calendar tool',
      'Gave up — and asked you instead',
    ]);
    expect(nextBtn(root).disabled).toBe(true);
    expect(skipBtn(root).disabled).toBe(true);
  });

  it('flipping tools back on starts the normal run again', () => {
    // ARRANGE — failed run finished
    const m = mount();
    const root = m.root;
    toolsSwitch(root).click();
    nextBtn(root).click();
    nextBtn(root).click();
    nextBtn(root).click();
    expect(nextBtn(root).disabled).toBe(true);

    // ACT
    toolsSwitch(root).click();

    // ASSERT — tools on again, run restarted from step 0
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('true');
    expect(entryTexts(root)).toHaveLength(0);
    expect(nextBtn(root).disabled).toBe(false);
  });
});
