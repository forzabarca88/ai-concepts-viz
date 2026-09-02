import type { Page } from '@playwright/test';
import { test, expect, scrollToSelector } from './helper';

const nextStep = (page: Page) => page.getByRole('button', { name: 'Next step', exact: true });
const skipBtn = (page: Page) => page.getByRole('button', { name: 'Skip to the end', exact: true });
const restartBtn = (page: Page) => page.getByRole('button', { name: 'Restart', exact: true });
const toolsSwitch = (page: Page) => page.getByRole('switch', { name: 'Tools: on/off' });
const choice = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

const CHOICE_1_CORRECT = 'calendar.check("Saturday")';
const CHOICE_1_WRONG = 'web.search("Saturday weather Portland")';
const CHOICE_2_CORRECT = 'web.search("Portland chocolate + hiking")';

test.describe('agent — steer every move, wrong moves stall', () => {
  test('initial — the goal, the loop, an empty timeline and choice panel', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/agent');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Think. Act. Observe. Repeat.' }),
    ).toBeVisible();
    // exact: the goal text contains "Saturday", which also appears in
    // the choice buttons once the run starts
    await expect(
      page.getByText(
        'Plan a surprise birthday hike for Sam — he loves chocolate and mountains; check Saturday and email his sister.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText('The loop decides when there is nothing to choose.', { exact: true }),
    ).toBeVisible();
    await expect(toolsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(nextStep(page)).toBeEnabled();
    await expect(skipBtn(page)).toBeEnabled();
    await expect(restartBtn(page)).toBeDisabled();
    // initial shot at top scroll (house pattern)
    await shot('ag-initial.png');
  });

  test('first thought — then the first decision', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await nextStep(page).click();
    await expect(page.getByText('I need the date first.', { exact: true })).toBeVisible();
    // the run waits for the user: both tools of choice 1 are on offer
    await expect(choice(page, CHOICE_1_CORRECT)).toBeEnabled();
    await expect(choice(page, CHOICE_1_WRONG)).toBeEnabled();
    await expect(nextStep(page)).toBeDisabled();
    await expect(
      page.getByText('Your call: what should it do?', { exact: true }),
    ).toBeVisible();
    await scrollToSelector(page, '.agent-stage');
    await shot('ag-choice-1.png');
  });

  test('wrong move — a stall and a retired button', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await nextStep(page).click();
    await choice(page, CHOICE_1_WRONG).click();
    // the wasted act stalled the loop — coral entry + STALLED tag
    await expect(
      page.getByText('Useless — I still do not know if Saturday is free.', { exact: true }),
    ).toBeVisible();
    // the wrong button is retired; the right one is still on the table
    await expect(choice(page, CHOICE_1_WRONG)).toBeDisabled();
    // scoped to the retired button — the other button carries a hidden
    // twin tag (Playwright text queries match [hidden] elements too)
    await expect(
      choice(page, CHOICE_1_WRONG).getByText('Tried — no help', { exact: true }),
    ).toBeVisible();
    await expect(choice(page, CHOICE_1_CORRECT)).toBeEnabled();
    await expect(nextStep(page)).toBeDisabled();
    await scrollToSelector(page, '.agent-stage');
    await shot('ag-wrong.png');
  });

  test('clean run — steered to a drafted email', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await nextStep(page).click();
    await choice(page, CHOICE_1_CORRECT).click();
    await expect(page.getByText('Saturday: free', { exact: true })).toBeVisible();
    await choice(page, CHOICE_2_CORRECT).click();
    await expect(page.getByText('Maple Ridge trail ✓', { exact: true })).toBeVisible();
    await expect(nextStep(page)).toBeEnabled();
    await nextStep(page).click();
    await expect(page.getByText('Done! Email drafted ✅', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Done! 4 moves, 0 wobbles.', { exact: true }),
    ).toBeVisible();
    await expect(nextStep(page)).toBeDisabled();
    await expect(skipBtn(page)).toBeDisabled();
    await scrollToSelector(page, '.agent-stage');
    await shot('ag-done.png');
  });

  test('tools off — gave up and asked you instead', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await toolsSwitch(page).click();
    await nextStep(page).click();
    await nextStep(page).click();
    await nextStep(page).click();
    // the failure path asserts both mandated strings
    await expect(page.getByText('Action failed: no calendar tool', { exact: true })).toBeVisible();
    await expect(page.getByText('Gave up — and asked you instead', { exact: true })).toBeVisible();
    await expect(nextStep(page)).toBeDisabled();
    await scrollToSelector(page, '.agent-stage');
    await shot('ag-notools-final.png');
  });
});
