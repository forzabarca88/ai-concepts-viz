import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header. Deterministic
 * offset (header height + 24px) — no scrollIntoView heuristics — so the
 * captured state is the same on every run.
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

test.describe('data — the user-run filter console (3D)', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/data');
    await expect(
      page.getByRole('heading', { level: 1, name: 'How much reading does it take?' }),
    ).toBeVisible();
    await scrollToSelector(page, '.data-stage');
    await shot('data-initial.png');
  });

  test('three curation decisions: walk to the verdict', async ({ page, shot }) => {
    await page.goto('/#/data');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.data-stage');

    // Stage 1 — Curation: "Best sources only" (4,200,000 clean pages).
    await page.getByRole('button', { name: /^Best sources only/ }).click();
    await expect(page.locator('.data-status')).toHaveText(
      'Curation decided — the river narrows. How hard do we scrub the pages?',
    );
    await scrollToSelector(page, '.data-stage');
    await shot('data-stage-2.png');

    // Stage 2 — Cleaning: "Standard scrub" (2,310,000 unique pages).
    await page.getByRole('button', { name: /^Standard scrub/ }).click();
    await scrollToSelector(page, '.data-stage');
    await shot('data-stage-3.png');

    // Stage 3 — Deduplication: "Standard dedup" completes the run
    // (1,039,500 pages → 8,316,000 tokens, quality 60%).
    await page.getByRole('button', { name: /^Standard dedup/ }).click();
    await expect(page.locator('.data-verdict')).toHaveText(
      'Careful data — you would be proud of the reading list.',
    );
    await expect(page.getByText('Data quality 60%')).toBeVisible();
    await scrollToSelector(page, '.data-stage');
    await shot('data-complete.png');

    // Back one stage: the last decision is pre-pressed and re-selectable.
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(
      page.getByRole('button', { name: /^Standard dedup/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await scrollToSelector(page, '.data-stage');
    await shot('data-back.png');
  });

  test('topic mix: one topic toggled off', async ({ page, shot }) => {
    await page.goto('/#/data');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.data-side');

    // Toggle Books off in the initial state — the mix re-weights.
    await page.getByRole('switch', { name: 'Books' }).click();
    await expect(page.getByRole('switch', { name: 'Books' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await scrollToSelector(page, '.data-stage');
    await shot('data-topic-off.png');
  });
});
