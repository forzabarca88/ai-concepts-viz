import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page). Playwright clicks can auto-scroll the target into
 * view and re-frame the page, so this is re-applied after every click
 * before capturing.
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

test.describe('tokenisation — words into tokens', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await expect(
      page.getByRole('heading', { level: 1, name: "Words aren't words — they're tokens" }),
    ).toBeVisible();
    await shot('tok-initial.png');
  });

  test('clicking a chip opens the inspector', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    // the " AI" chip — the one with the rarest id
    await page.locator('.tok-chip').nth(4).click();
    await expect(page.locator('.tok-insp')).toBeVisible();
    await scrollToSelector(page, '.tok-stage');
    await shot('tok-chip-selected.png');
  });

  test('adding an emoji splits the rocket into three tokens', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    await page.getByRole('button', { name: 'Add an emoji' }).click();
    await expect(page.getByText('Even robots can break!')).toBeVisible();
    await scrollToSelector(page, '.tok-stage');
    await shot('tok-emoji.png');
  });

  test('grain: character, subword, word', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    const slider = page.locator('.tok-grain-slider');
    await slider.focus();
    // subword → character
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('0');
    await scrollToSelector(page, '.tok-stage');
    await shot('tok-grain-char.png');
    // → subword
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('1');
    await scrollToSelector(page, '.tok-stage');
    await shot('tok-grain-subword.png');
    // → word
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('2');
    await scrollToSelector(page, '.tok-stage');
    await shot('tok-grain-word.png');
  });

  test('next-token mini: mat, then moon', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-next');

    await page.getByRole('button', { name: /mat/ }).click();
    await expect(page.locator('.tok-next-explain')).toBeVisible();
    await scrollToSelector(page, '.tok-next');
    await shot('tok-next-mat.png');

    await page.getByRole('button', { name: /moon/ }).click();
    await scrollToSelector(page, '.tok-next');
    await shot('tok-next-moon.png');
  });
});
