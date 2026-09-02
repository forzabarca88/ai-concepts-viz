import type { Page } from '@playwright/test';
import { test, expect, scrollToSelector } from './helper';

const appBtn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const plugBtn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const askBtn = (page: Page) => page.getByRole('button', { name: 'Ask the app', exact: true });
const unplugBtn = (page: Page) => page.getByRole('button', { name: 'Unplug all', exact: true });
const countLine = (page: Page) => page.locator('.mcp-count');
const replyText = (page: Page) => page.locator('.mcp-reply-text');

const REPLY_EMPTY = 'Nothing to ask yet — plug something in.';

test.describe('mcp — the USB-C of AI', () => {
  test('initial state — nothing plugged in', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await expect(page.getByRole('heading', { level: 1, name: 'The USB-C of AI' })).toBeVisible();
    await expect(appBtn(page, 'ChatBot')).toHaveAttribute('aria-pressed', 'true');
    await expect(countLine(page)).toHaveText('0 tools ready');
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeVisible();
    await expect(askBtn(page)).toBeDisabled();
    await expect(replyText(page)).toHaveText(REPLY_EMPTY);
    await shot('mcp-initial.png');
  });

  test('dock Files, then ask the app', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    // --- mcp-plug-files: the plug docks, a chip appears, Ask unlocks ---
    await plugBtn(page, 'Files').click();
    await expect(plugBtn(page, 'Files')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('connected: Files', { exact: true })).toBeVisible();
    await expect(countLine(page)).toHaveText('1 tool ready');
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeHidden();
    await expect(askBtn(page)).toBeEnabled();
    await expect(replyText(page)).toHaveText(REPLY_EMPTY);
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-plug-files.png');

    // --- mcp-ask: the app replies through its docked tool ---
    await askBtn(page).click();
    await expect(replyText(page)).toHaveText(
      'ChatBot asked its tools: the hike photos are in Hike 2024.zip.',
    );
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-ask.png');
  });

  test('CodePal checks its tools', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    // switch to CodePal, dock Calendar, ask
    await appBtn(page, 'CodePal').click();
    await expect(appBtn(page, 'CodePal')).toHaveAttribute('aria-pressed', 'true');
    await expect(askBtn(page)).toBeDisabled();
    await plugBtn(page, 'Calendar').click();
    await expect(page.getByText('connected: Calendar', { exact: true })).toBeVisible();
    await expect(countLine(page)).toHaveText('1 tool ready');
    await askBtn(page).click();
    await expect(replyText(page)).toHaveText('CodePal checked its tools: Saturday is free.');
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-codepal.png');
  });

  test('unplug all — back to just words', async ({ page, shot }) => {
    await page.goto('/#/mcp');
    await scrollToSelector(page, '.mcp-stage');

    await plugBtn(page, 'Files').click();
    await plugBtn(page, 'Calendar').click();
    await expect(countLine(page)).toHaveText('2 tools ready');

    await unplugBtn(page).click();
    await expect(countLine(page)).toHaveText('0 tools ready');
    await expect(page.getByText('connected: Files', { exact: true })).toBeHidden();
    await expect(page.getByText('connected: Calendar', { exact: true })).toBeHidden();
    await expect(page.getByText('No tools — just words.', { exact: true })).toBeVisible();
    await expect(askBtn(page)).toBeDisabled();
    await expect(replyText(page)).toHaveText(REPLY_EMPTY);
    await scrollToSelector(page, '.mcp-stage');
    await shot('mcp-unplug.png');
  });
});
