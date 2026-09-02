import { test, expect, scrollToSelector } from './helper';

const RESULTS_EMPTY = 'No results yet — teach it a skill, pick a task, then try it.';
const TRAIL_RESULT =
  'It opened three tabs, compared reviews and settled on: Maple Ridge, 8.4 miles, one good chocolate shop at the trailhead.';

test.describe('skills — teach what you pick, then try the task', () => {
  test('teach browse → trail ready → try → forget', async ({ page, shot }) => {
    await page.goto('/#/skills');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Teaching it a job' }),
    ).toBeVisible();

    // --- sk-initial: three unpressed teach cards, results placeholder ---
    await expect(page.locator('.skill-teach-card')).toHaveCount(3);
    await expect(
      page.locator('.skill-teach-card .skill-teach[aria-pressed="true"]'),
    ).toHaveCount(0);
    await expect(page.locator('.skill-results')).toContainText(RESULTS_EMPTY);
    await expect(
      page.getByText('Teach a skill — pick which one first.', { exact: true }),
    ).toBeVisible();
    await scrollToSelector(page, '.skill-stage');
    await shot('sk-initial.png');

    // --- sk-teach-browse: the user picks which skill to teach ---
    const browseCard = page.locator('.skill-teach-card', { hasText: 'Browse the web' });
    await browseCard.getByRole('button', { name: 'Teach', exact: true }).click();
    await expect(page.locator('.skill-inv-count')).toHaveText('1 / 3');
    await expect(page.getByText('Learned!', { exact: true })).toBeVisible();
    await expect(
      page.getByText('The backpack holds 1 of 3 skills.', { exact: true }),
    ).toBeVisible();
    await scrollToSelector(page, '.skill-stage');
    await shot('sk-teach-browse.png');

    // --- sk-ready: the trail task is ready, Try the task is offered ---
    const trailTask = page.getByRole('button', { name: /Find Portland's best hiking trail/ });
    await trailTask.click();
    await expect(page.getByText('Ready! 🎒', { exact: true })).toBeVisible();
    const tryBtn = page.getByRole('button', { name: 'Try the task', exact: true });
    await expect(tryBtn).toBeEnabled();
    await scrollToSelector(page, '.skill-stage');
    await shot('sk-ready.png');

    // --- sk-done: the task runs and prints its exact result ---
    await tryBtn.click();
    await expect(page.getByText(TRAIL_RESULT, { exact: true })).toBeVisible();
    await expect(trailTask.getByText('Done ✓', { exact: true })).toBeVisible();
    await expect(tryBtn).toBeDisabled();
    await scrollToSelector(page, '.skill-stage');
    await shot('sk-done.png');

    // --- sk-forget: forgetting the skill un-readies the task and
    // clears its result line ---
    await page.getByRole('button', { name: 'Forget', exact: true }).click();
    await expect(page.getByText('Not ready', { exact: true })).toBeVisible();
    await expect(page.getByText('Missing: Browse the web', { exact: true })).toBeVisible();
    await expect(page.locator('.skill-results')).toContainText(RESULTS_EMPTY);
    await expect(trailTask.getByText('Done ✓', { exact: true })).toBeHidden();
    await scrollToSelector(page, '.skill-stage');
    await shot('sk-forget.png');
  });
});
