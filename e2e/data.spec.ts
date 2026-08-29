import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page).
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

test.describe('data — river of pages (3D)', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/data');
    await expect(
      page.getByRole('heading', { level: 1, name: 'How much reading does it take?' }),
    ).toBeVisible();
    await shot('data-initial.png');
  });

  test('filters: walk the pipeline to completion', async ({ page, shot }) => {
    await page.goto('/#/data');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.data-stage');

    const next = page.getByRole('button', { name: 'Next filter' });
    // Each click auto-scrolls the button to the viewport centre, so the
    // framing is re-applied before every capture.
    for (const name of [
      'data-filter-1.png',
      'data-filter-2.png',
      'data-filter-3.png',
    ] as const) {
      await next.click();
      await scrollToSelector(page, '.data-stage');
      await shot(name);
    }

    // Step 4 (Deduplication) is reached: the button disables and the
    // token chips materialise below the tube — frame the bottom of the
    // stage where they appear.
    await expect(next).toBeDisabled();
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.data-stage');
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight - 800;
      window.scrollTo(0, Math.max(0, y));
    });
    await shot('data-complete.png');
  });

  test('topic mix: code only, then none', async ({ page, shot }) => {
    await page.goto('/#/data');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.data-side');

    // Leave only Code in the mix.
    for (const name of ['Books', 'Web pages', 'Chats'] as const) {
      await page.getByRole('switch', { name }).click();
    }
    await expect(page.getByRole('switch', { name: 'Code' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await shot('data-mix-code-only.png');

    // Empty the mix entirely.
    await page.getByRole('switch', { name: 'Code' }).click();
    await shot('data-mix-none.png');
  });
});
