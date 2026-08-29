import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page). Playwright clicks/keypresses can auto-scroll the
 * target into view and re-frame the page, so this is re-applied after
 * every interaction before capturing.
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

test.describe('pretraining — guess the next word, a trillion times', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/pretraining');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Guess the next word. A trillion times.' }),
    ).toBeVisible();
    await shot('pre-initial.png');
  });

  test('teach a batch ×3 — counter climbs, feed appends, badges unlock', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');
    const batch = page.getByRole('button', { name: 'Teach a batch' });
    const counter = page.locator('.pre-counter');

    await batch.click();
    await expect(counter).toHaveText('100');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-batch-1.png');

    await batch.click();
    await expect(counter).toHaveText('200');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-batch-2.png');

    await batch.click();
    await expect(counter).toHaveText('300');
    await expect(page.locator('.pre-skill-count')).toHaveText('Skills unlocked: 2 / 4');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-batch-3.png');
  });

  test('log slider to 15T — the real Llama 3.1 figure', async ({ page, shot }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');
    const slider = page.locator('.pre-scale-slider');
    const counter = page.locator('.pre-counter');

    await slider.focus();
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('ArrowRight');
      await scrollToSelector(page, '.pre-stage');
    }
    await expect(slider).toHaveValue('3');
    await expect(counter).toHaveText('15T');
    await expect(page.getByRole('button', { name: 'Teach a batch' })).toBeDisabled();
    await expect(page.locator('.pre-skill-count')).toHaveText('Skills unlocked: 4 / 4');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-slider-15t.png');
  });

  test('see the raw model — the base-model reflex', async ({ page, shot }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');

    await page.getByRole('switch', { name: 'See the raw model' }).click();
    await expect(page.locator('.pre-raw')).toBeVisible();
    await expect(page.getByText('No meaning yet — just the next-word reflex.')).toBeVisible();
    // Frame the revealed panel itself (it sits below the stage bar).
    await scrollToSelector(page, '.pre-raw');
    await shot('pre-raw-revealed.png');
  });
});
