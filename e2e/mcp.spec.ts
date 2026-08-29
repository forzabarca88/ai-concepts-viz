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

const appBtn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const plugBtn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const unplugBtn = (page: Page) => page.getByRole('button', { name: 'Unplug all', exact: true });
const countLine = (page: Page) => page.locator('.mcp-count');

test.describe('mcp — the USB-C of AI', () => {
  test('initial state — nothing plugged in', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await expect(page.getByRole('heading', { level: 1, name: 'The USB-C of AI' })).toBeVisible();
    await expect(appBtn(page, 'ChatBot')).toHaveAttribute('aria-pressed', 'true');
    await expect(countLine(page)).toHaveText('0 tools ready');
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeVisible();
    await shot('mcp-initial.png');
  });

  test('switch app — CodePal is lit', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    await appBtn(page, 'CodePal').click();
    await expect(appBtn(page, 'CodePal')).toHaveAttribute('aria-pressed', 'true');
    await expect(appBtn(page, 'ChatBot')).toHaveAttribute('aria-pressed', 'false');
    await expect(countLine(page)).toHaveText('0 tools ready');
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-app-codepal.png');
  });

  test('dock Files — it plugs in, the cable draws, a chip appears', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    await plugBtn(page, 'Files').click();
    await expect(plugBtn(page, 'Files')).toHaveAttribute('aria-pressed', 'true');
    // the docked plug + its cable are in the final state in the SVG
    // (a bare horizontal <line> has a 0-height box, so assert by count)
    await expect(page.locator('.mc-cable--files')).toHaveCount(1);
    await expect(page.locator('.mc-docked')).toHaveCount(1);
    await expect(page.getByText('connected: Files', { exact: true })).toBeVisible();
    await expect(countLine(page)).toHaveText('1 tool ready');
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeHidden();
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-docked-files.png');
  });

  test('dock all three — any tool fits the same socket', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    await plugBtn(page, 'Files').click();
    await plugBtn(page, 'Calendar').click();
    await plugBtn(page, 'Maps').click();

    await expect(page.locator('.mc-cable--files')).toHaveCount(1);
    await expect(page.locator('.mc-cable--calendar')).toHaveCount(1);
    await expect(page.locator('.mc-cable--maps')).toHaveCount(1);
    await expect(page.locator('.mc-docked')).toHaveCount(3);
    await expect(page.getByText('connected: Files', { exact: true })).toBeVisible();
    await expect(page.getByText('connected: Calendar', { exact: true })).toBeVisible();
    await expect(page.getByText('connected: Maps', { exact: true })).toBeVisible();
    await expect(countLine(page)).toHaveText('3 tools ready');
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-docked-all.png');
  });

  test('unplug all — back to just words', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    await plugBtn(page, 'Files').click();
    await plugBtn(page, 'Calendar').click();
    await expect(countLine(page)).toHaveText('2 tools ready');

    await unplugBtn(page).click();
    await expect(countLine(page)).toHaveText('0 tools ready');
    await expect(page.locator('.mc-cable--files')).toHaveCount(0);
    await expect(page.locator('.mc-cable--calendar')).toHaveCount(0);
    await expect(page.getByText('connected: Files', { exact: true })).toBeHidden();
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-unplugged.png');
  });
});
