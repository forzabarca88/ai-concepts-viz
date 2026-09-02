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

const choiceBtn = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name }) as HTMLButtonElement;

const hint = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.stage-bar-hint')?.textContent ?? '';

/** Only the VISIBLE `Tried — no help` tags (jsdom text queries also
    match `[hidden]` elements, so scope with `hidden === false`). */
const triedTags = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.agent-choice-tag')).filter((t) => !t.hidden);

const EMPTY_TEXT = 'Nothing yet — press Next step to start the loop.';
const CHOICES_EMPTY = 'The loop decides when there is nothing to choose.';
const CHOICE_1_CORRECT = 'calendar.check("Saturday")';
const CHOICE_1_WRONG = 'web.search("Saturday weather Portland")';
const CHOICE_2_CORRECT = 'web.search("Portland chocolate + hiking")';
const CHOICE_2_WRONG = 'email.draft(...)';

/** The clean path: 2 × Next step + 2 choice clicks = 4 moves. */
const cleanRun = (root: HTMLElement) => {
  nextBtn(root).click();
  choiceBtn(root, CHOICE_1_CORRECT).click();
  choiceBtn(root, CHOICE_2_CORRECT).click();
  nextBtn(root).click();
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

  it('starts with tools on, an empty timeline, an empty choice panel and the 3D fallback note (jsdom)', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ASSERT
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('true');
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    // the choice panel is always present, with its empty line
    expect(within(root).getByText(CHOICES_EMPTY, { exact: true })).toBeTruthy();
    expect(root.querySelectorAll('.agent-choice')).toHaveLength(0);
    // jsdom has no WebGL — the 3D layer renders its fallback note
    expect(root.querySelector('.agent-canvas-wrap .viz-fallback')).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
    expect(skipBtn(root).disabled).toBe(false);
    expect(restartBtn(root).disabled).toBe(true);
    expect(phaseOn(root, 'think')).toBe(false);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(phaseOn(root, 'observe')).toBe(false);
    expect(repeatChip(root)?.textContent).toBe('Repeat');
    expect(hint(root)).toBe('Press Next step to start — then steer every move.');
  });
});

describe('steering the moves', () => {
  it('Next step appends the first thought, then offers choice 1 (both exact options)', () => {
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
    // the run now waits for the user's call
    expect(nextBtn(root).disabled).toBe(true);
    expect(hint(root)).toBe('Your call: what should it do?');
    expect(choiceBtn(root, CHOICE_1_CORRECT).disabled).toBe(false);
    expect(choiceBtn(root, CHOICE_1_WRONG).disabled).toBe(false);
    expect(triedTags(root)).toHaveLength(0);
  });

  it('a wrong choice 1 stalls the run and retires the button', () => {
    // ARRANGE — choice 1 is pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();

    // ACT
    choiceBtn(root, CHOICE_1_WRONG).click();

    // ASSERT — the wasted act + a coral STALL entry
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      CHOICE_1_WRONG,
      'Useless — I still do not know if Saturday is free.',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'act', 'stall']);
    // the stall sits in the Act phase of the loop badge
    expect(phaseOn(root, 'act')).toBe(true);
    // the wrong button is disabled + tagged; choice 1 stays pending
    expect(choiceBtn(root, CHOICE_1_WRONG).disabled).toBe(true);
    expect(choiceBtn(root, CHOICE_1_CORRECT).disabled).toBe(false);
    expect(triedTags(root)).toHaveLength(1);
    expect(triedTags(root)[0].textContent).toBe('Tried — no help');
    expect(nextBtn(root).disabled).toBe(true);
    expect(hint(root)).toBe('Your call: what should it do?');
  });

  it('the correct choice 1 advances to choice 2', () => {
    // ARRANGE — choice 1 is pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();

    // ACT
    choiceBtn(root, CHOICE_1_CORRECT).click();

    // ASSERT — act + observation, then the second decision
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'calendar.check("Saturday")',
      'Saturday: free',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'act', 'observe']);
    expect(phaseOn(root, 'observe')).toBe(true);
    expect(nextBtn(root).disabled).toBe(true);
    expect(choiceBtn(root, CHOICE_2_CORRECT).disabled).toBe(false);
    expect(choiceBtn(root, CHOICE_2_WRONG).disabled).toBe(false);
    expect(hint(root)).toBe('Your call: what should it do?');
  });

  it('the correct choice 2 clears the trail and re-enables Next step', () => {
    // ARRANGE — choice 2 is pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_CORRECT).click();

    // ACT
    choiceBtn(root, CHOICE_2_CORRECT).click();

    // ASSERT
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'calendar.check("Saturday")',
      'Saturday: free',
      'web.search("Portland chocolate + hiking")',
      'Maple Ridge trail ✓',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'act', 'observe', 'act', 'observe']);
    // nothing left to choose — back to the step controls
    expect(nextBtn(root).disabled).toBe(false);
    expect(root.querySelectorAll('.agent-choice')).toHaveLength(0);
    expect(within(root).getByText(CHOICES_EMPTY, { exact: true })).toBeTruthy();
    expect(hint(root)).toBe('Press Next step to finish the loop.');
  });

  it('the final Next step drafts the email: 7 entries, 0 wobbles', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — the clean path (identical texts to the old scripted run)
    cleanRun(root);

    // ASSERT
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
    expect(hint(root)).toBe('Done! 4 moves, 0 wobbles.');
  });

  it('the Done entry sets the badge to its Done state (no phase lit)', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    cleanRun(root);

    // ASSERT — no phase highlighted; the trailing chip flips to "Done ✓"
    expect(phaseOn(root, 'think')).toBe(false);
    expect(phaseOn(root, 'act')).toBe(false);
    expect(phaseOn(root, 'observe')).toBe(false);
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
    expect(repeatChip(root)?.dataset.state).toBe('done');
    expect(hint(root)).toBe('Done! 4 moves, 0 wobbles.');
  });

  it('the locked button cannot advance past the end', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    cleanRun(root);
    expect(nextBtn(root).disabled).toBe(true);

    // ACT
    nextBtn(root).click();

    // ASSERT — still exactly the finished run
    expect(entryTexts(root)).toHaveLength(7);
    expect(nextBtn(root).disabled).toBe(true);
  });

  it('a wrong choice 2 stalls too: "Too early — I have no trail to write about."', () => {
    // ARRANGE — choice 2 is pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_CORRECT).click();

    // ACT
    choiceBtn(root, CHOICE_2_WRONG).click();

    // ASSERT
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'calendar.check("Saturday")',
      'Saturday: free',
      'email.draft(...)',
      'Too early — I have no trail to write about.',
    ]);
    expect(entryKinds(root)).toEqual(['thought', 'act', 'observe', 'act', 'stall']);
    expect(choiceBtn(root, CHOICE_2_WRONG).disabled).toBe(true);
    expect(choiceBtn(root, CHOICE_2_CORRECT).disabled).toBe(false);
    expect(triedTags(root)).toHaveLength(1);
    // choice 2 stays pending
    expect(hint(root)).toBe('Your call: what should it do?');
  });

  it('wrong + wrong: 11 entries (7 + 2 per stall), 6 moves, 2 wobbles', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT — both decisions wobble once before landing
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_WRONG).click();
    choiceBtn(root, CHOICE_1_CORRECT).click();
    choiceBtn(root, CHOICE_2_WRONG).click();
    choiceBtn(root, CHOICE_2_CORRECT).click();
    nextBtn(root).click();

    // ASSERT — each wrong try added its ACT + STALL pair
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'web.search("Saturday weather Portland")',
      'Useless — I still do not know if Saturday is free.',
      'calendar.check("Saturday")',
      'Saturday: free',
      'email.draft(...)',
      'Too early — I have no trail to write about.',
      'web.search("Portland chocolate + hiking")',
      'Maple Ridge trail ✓',
      'email.draft(...)',
      'Done! Email drafted ✅',
    ]);
    expect(entryKinds(root)).toEqual([
      'thought',
      'act',
      'stall',
      'act',
      'observe',
      'act',
      'stall',
      'act',
      'observe',
      'act',
      'done',
    ]);
    expect(nextBtn(root).disabled).toBe(true);
    expect(hint(root)).toBe('Done! 6 moves, 2 wobbles.');
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
  });
});

describe('skip to the end', () => {
  it('fills the remaining entries via the CORRECT path from mid-choice', () => {
    // ARRANGE — one thought + one wrong try, choice 1 still pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_WRONG).click();
    expect(entryTexts(root)).toHaveLength(3);

    // ACT
    skipBtn(root).click();

    // ASSERT — the past stall stays, the rest of the run is the clean path
    expect(entryTexts(root)).toEqual([
      'I need the date first.',
      'web.search("Saturday weather Portland")',
      'Useless — I still do not know if Saturday is free.',
      'calendar.check("Saturday")',
      'Saturday: free',
      'web.search("Portland chocolate + hiking")',
      'Maple Ridge trail ✓',
      'email.draft(...)',
      'Done! Email drafted ✅',
    ]);
    expect(nextBtn(root).disabled).toBe(true);
    expect(skipBtn(root).disabled).toBe(true);
    expect(hint(root)).toBe('Done! 5 moves, 1 wobbles.');
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
  });

  it('works from the empty timeline too', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;

    // ACT
    skipBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(7);
    expect(entryTexts(root)[6]).toBe('Done! Email drafted ✅');
    expect(hint(root)).toBe('Done! 4 moves, 0 wobbles.');
    expect(repeatChip(root)?.textContent).toBe('Done ✓');
  });

  it('does nothing once the run is complete', () => {
    // ARRANGE
    const m = mount();
    const root = m.root;
    cleanRun(root);
    expect(skipBtn(root).disabled).toBe(true);

    // ACT
    skipBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(7);
  });
});

describe('restart', () => {
  it('clears the timeline and reopens the controls', () => {
    // ARRANGE — a run in flight
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_CORRECT).click();
    expect(entryTexts(root)).toHaveLength(3);

    // ACT
    restartBtn(root).click();

    // ASSERT
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    expect(within(root).getByText(CHOICES_EMPTY, { exact: true })).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
    expect(skipBtn(root).disabled).toBe(false);
    expect(restartBtn(root).disabled).toBe(true);
    expect(phaseOn(root, 'think')).toBe(false);
  });

  it('clears wrong tries: the retired button comes back and the run is clean', () => {
    // ARRANGE — one wrong try on record
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    choiceBtn(root, CHOICE_1_WRONG).click();
    expect(choiceBtn(root, CHOICE_1_WRONG).disabled).toBe(true);
    expect(triedTags(root)).toHaveLength(1);

    // ACT
    restartBtn(root).click();
    nextBtn(root).click();

    // ASSERT — the wrong button is fresh again, no tag anywhere
    expect(choiceBtn(root, CHOICE_1_WRONG).disabled).toBe(false);
    expect(triedTags(root)).toHaveLength(0);

    // ACT — finish cleanly
    choiceBtn(root, CHOICE_1_CORRECT).click();
    choiceBtn(root, CHOICE_2_CORRECT).click();
    nextBtn(root).click();

    // ASSERT — the wobbles are gone
    expect(entryTexts(root)).toHaveLength(7);
    expect(hint(root)).toBe('Done! 4 moves, 0 wobbles.');
  });

  it('is disabled while the timeline is empty', () => {
    // ARRANGE
    const m = mount();

    // ASSERT
    expect(restartBtn(m.root).disabled).toBe(true);
  });
});

describe('tools on/off', () => {
  it('flipping tools mid-run restarts the run (timeline cleared, no pending choice)', () => {
    // ARRANGE — mid-run with tools on, a choice pending
    const m = mount();
    const root = m.root;
    nextBtn(root).click();
    expect(choiceBtn(root, CHOICE_1_CORRECT)).toBeTruthy();

    // ACT
    toolsSwitch(root).click();

    // ASSERT — the run was restarted under the new tools state
    expect(toolsSwitch(root).getAttribute('aria-checked')).toBe('false');
    expect(entryTexts(root)).toHaveLength(0);
    expect(within(root).getByText(EMPTY_TEXT, { exact: true })).toBeTruthy();
    expect(within(root).getByText(CHOICES_EMPTY, { exact: true })).toBeTruthy();
    expect(nextBtn(root).disabled).toBe(false);
    expect(hint(root)).toBe('Tools off — this run will end early.');
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
    // the choice panel never offers acts without tools
    expect(within(root).getByText(CHOICES_EMPTY, { exact: true })).toBeTruthy();

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

  it('flipping tools back on starts the steered run again', () => {
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
    expect(hint(root)).toBe('Press Next step to start — then steer every move.');
  });
});

describe('3D layer hygiene', () => {
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
