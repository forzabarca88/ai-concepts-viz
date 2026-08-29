import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page). Playwright clicks/keys can auto-scroll the target
 * into view and re-frame the page, so this is re-applied after every
 * click or keypress before capturing.
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

test.describe('parameters — knob cloud (3D)', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Billions of tiny knobs' }),
    ).toBeVisible();
    await shot('par-initial.png');
  });

  test('training: step 1, then step 5', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-stage');

    const train = page.getByRole('button', { name: 'Train one step' });
    await train.click();
    await scrollToSelector(page, '.par-stage');
    await shot('par-step-1.png');

    for (let i = 0; i < 4; i++) {
      await train.click();
    }
    await expect(page.locator('.par-meter-count')).toHaveText('5 of 10 steps');
    await scrollToSelector(page, '.par-stage');
    await shot('par-step-5.png');
  });

  test('model size: 1M, 7B, 70B', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-side');

    const slider = page.locator('.par-size-slider');
    // focus() can re-frame the page; the deterministic scroll is
    // re-applied after every keypress before capturing.
    await slider.focus();

    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('0');
    await scrollToSelector(page, '.par-side');
    await shot('par-size-1m.png');

    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('1');
    await scrollToSelector(page, '.par-side');
    await shot('par-size-7b.png');

    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('2');
    await scrollToSelector(page, '.par-side');
    await shot('par-size-70b.png');
  });

  test('inspecting a knob shows the spotlight card', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-stage');

    await page.getByRole('button', { name: 'Inspect a knob' }).click();
    await expect(page.locator('.par-tip')).toBeVisible();
    await expect(page.locator('.par-tip')).toHaveText('Knob #4,291,114 · value 0.42');
    await scrollToSelector(page, '.par-stage');
    await shot('par-inspected.png');
  });
});
