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

test.describe('sft — from word-guessing to helping', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/sft');
    await expect(
      page.getByRole('heading', { level: 1, name: 'From word-guessing to helping' }),
    ).toBeVisible();
    await shot('sft-initial.png');
  });

  test('prompt picker — haiku, then gravity', async ({ page, shot }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');
    const instruct = page.locator('.sft-panel--instruct .sft-msg--model');

    await page.getByRole('button', { name: 'Write a haiku' }).click();
    await expect(instruct).toContainText('one ripple, then still');
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-haiku.png');

    await page.getByRole('button', { name: 'Explain gravity' }).click();
    await expect(instruct).toContainText('bent around anything heavy');
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-gravity.png');
  });

  test('add examples — 10, then 100 with the quality note', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');
    const add = page.getByRole('button', { name: 'Add 10 examples' });
    const quality = page.locator('.sft-quality-value');

    await add.click();
    await expect(page.locator('.sft-strip-count')).toHaveText('10 examples');
    await expect(quality).toHaveText('60%');
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-examples-10.png');

    await add.click();
    await expect(page.locator('.sft-strip-count')).toHaveText('100 examples');
    await expect(quality).toHaveText('90%');
    // exact: the explain card also contains "quality beats quantity" in copy
    await expect(page.getByText('Quality beats quantity', { exact: true })).toBeVisible();
    await expect(add).toBeDisabled();
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-examples-100.png');
  });

  test('show a training pair', async ({ page, shot }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');

    await page.getByRole('button', { name: 'Show a training pair' }).click();
    await expect(page.locator('.sft-pair')).toBeVisible();
    await expect(page.getByText('Instruction:')).toBeVisible();
    await expect(page.getByText('Response:')).toBeVisible();
    // Frame the revealed card itself (it sits below the training strip).
    await scrollToSelector(page, '.sft-pair');
    await shot('sft-pair.png');
  });
});
