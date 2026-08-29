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

/** The "This one!" vote lives inside a card — scope by card class to
    keep the strict-mode query unambiguous (the label appears twice). */
const voteOn = (page: Page, card: 'a' | 'b') =>
  page.locator(`.pref-card--${card}`).getByRole('button', { name: 'This one!' });

test.describe('preferences — showing it which answer is better', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Showing it which answer is better' }),
    ).toBeVisible();
    await shot('pref-initial.png');
  });

  test('vote "This one!" on answer A', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');

    await voteOn(page, 'a').click();
    await expect(page.locator('.pref-card--a')).toHaveClass(/pref-card--chosen/);
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '80');
    await expect(page.locator('.pref-meter-value--a')).toHaveText('80');
    await expect(page.locator('.pref-meter-value--b')).toHaveText('20');
    await expect(page.getByRole('button', { name: 'Train on that' })).toBeEnabled();

    await scrollToSelector(page, '.pref-stage');
    await shot('pref-voted-a.png');
  });

  test('vote "This one!" on answer B', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');

    await voteOn(page, 'b').click();
    await expect(page.locator('.pref-card--b')).toHaveClass(/pref-card--chosen/);
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '20');
    await expect(page.locator('.pref-meter-value--a')).toHaveText('20');
    await expect(page.locator('.pref-meter-value--b')).toHaveText('80');

    await scrollToSelector(page, '.pref-stage');
    await shot('pref-voted-b.png');
  });

  test('train on that — level 1, then level 2', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');
    const train = page.getByRole('button', { name: 'Train on that' });
    await expect(train).toBeDisabled();

    await voteOn(page, 'a').click();
    await expect(train).toBeEnabled();

    await train.click();
    await expect(page.locator('.pref-level')).toHaveText('level 1');
    await scrollToSelector(page, '.pref-stage');
    await shot('pref-trained-1.png');

    await train.click();
    await expect(page.locator('.pref-level')).toHaveText('level 2');
    await expect(train).toBeDisabled();
    await scrollToSelector(page, '.pref-stage');
    await shot('pref-trained-2.png');
  });

  test('reset vote', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');
    const train = page.getByRole('button', { name: 'Train on that' });
    const reset = page.getByRole('button', { name: 'Reset vote' });
    await expect(reset).toBeDisabled();

    await voteOn(page, 'a').click();
    await train.click();
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '80');

    await reset.click();
    await expect(page.locator('.pref-card--chosen')).toHaveCount(0);
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
    await expect(train).toBeDisabled();
    await expect(page.locator('.pref-level')).toHaveText('no notes yet');

    // The state is back to the initial one — re-frame at the very top of
    // the page (same framing as pref-initial.png) before capturing.
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('pref-reset.png');
  });
});
