import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page). Playwright clicks can auto-scroll the target into
 * view and re-frame the page, so this is re-applied after every
 * interaction before capturing.
 */
async function scrollToSelector(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const header = document.querySelector('.site-header');
    if (!el || !header) return;
    const y =
      el.getBoundingClientRect().top +
      window.scrollY -
      (header.getBoundingClientRect().height + 24);
    window.scrollTo(0, y);
  }, selector);
}

const nextStep = (page: Page) => page.getByRole('button', { name: 'Next step', exact: true });
const skipBtn = (page: Page) => page.getByRole('button', { name: 'Skip to the end', exact: true });
const restartBtn = (page: Page) => page.getByRole('button', { name: 'Restart', exact: true });
const toolsSwitch = (page: Page) => page.getByRole('switch', { name: 'Tools: on/off' });

test.describe('agent — think, act, observe, repeat', () => {
  test('initial state — the goal, the loop, an empty timeline', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Think. Act. Observe. Repeat.' }),
    ).toBeVisible();
    // exact: the goal text contains "Saturday", which also appears in the
    // timeline entries once the run starts
    await expect(
      page.getByText(
        'Plan a surprise birthday hike for Sam — he loves chocolate and mountains; check Saturday and email his sister.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(toolsSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(nextStep(page)).toBeEnabled();
    await expect(skipBtn(page)).toBeEnabled();
    await expect(restartBtn(page)).toBeDisabled();
    // initial shot at top scroll (house pattern)
    await shot('agent-initial.png');
  });

  test('step 1 — the first thought', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await nextStep(page).click();
    await expect(page.getByText('I need the date first.', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.agent-stage');
    await shot('agent-step-1.png');
  });

  test('step 3 — the first observation', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await nextStep(page).click();
    await nextStep(page).click();
    await nextStep(page).click();
    await expect(page.getByText('Saturday: free', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.agent-stage');
    await shot('agent-step-3.png');
  });

  test('six steps — done, email drafted', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    for (let i = 0; i < 6; i += 1) {
      await nextStep(page).click();
    }
    await expect(page.getByText('Done! Email drafted ✅', { exact: true })).toBeVisible();
    await expect(nextStep(page)).toBeDisabled();
    await expect(skipBtn(page)).toBeDisabled();
    await scrollToSelector(page, '.agent-stage');
    await shot('agent-done.png');
  });

  test('tools off — step 2 is a coral failure', async ({ page, shot }) => {
    await page.goto('/#/agent');
    await scrollToSelector(page, '.agent-stage');

    await toolsSwitch(page).click();
    await nextStep(page).click();
    await nextStep(page).click();
    await expect(page.getByText('Action failed: no calendar tool', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.agent-stage');
    await shot('agent-notools-step-2.png');
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
    await shot('agent-notools-final.png');
  });
});
