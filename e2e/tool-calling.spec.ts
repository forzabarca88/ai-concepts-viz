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

const toolsSwitch = (page: Page) => page.getByRole('switch', { name: 'Tools: on/off' });
const stepBtn = (page: Page) => page.getByRole('button', { name: 'Step through the call' });

test.describe('tool-calling — teaching it to use a calculator', () => {
  test('initial state — tools off', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Teaching it to use a calculator' }),
    ).toBeVisible();
    // exact: the flow answer must not be confused with any prose copy
    await expect(
      page.getByText("I can't check that — I can't see the world!", { exact: true }),
    ).toBeVisible();
    await expect(stepBtn(page)).toBeDisabled();
    await shot('tool-initial.png');
  });

  test('tools on — the tool card appears', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await expect(page.locator('.tv-tool-call')).toHaveText('get_weather("Tokyo")');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 21°C, sunny');
    await expect(page.locator('.tv-answer-text')).toHaveText("It's 21°C and sunny in Tokyo.");
    await expect(stepBtn(page)).toBeEnabled();
    await scrollToSelector(page, '.tool-stage');
    await shot('tool-on.png');
  });

  test('step through the call — beats 2 and 4', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await expect(stepBtn(page)).toBeDisabled();
    await toolsSwitch(page).click();
    await expect(stepBtn(page)).toBeEnabled();

    // beat 1: Think
    await stepBtn(page).click();
    await expect(page.locator('.tool-caption')).toContainText('Think —');
    await scrollToSelector(page, '.tool-stage');

    // beat 2: Call tool — the tool card is highlighted
    await stepBtn(page).click();
    await expect(page.locator('.tool-caption')).toContainText('Call tool —');
    await scrollToSelector(page, '.tool-stage');
    await shot('tool-step-2.png');

    // beats 3 + 4: Read result, then Answer — the button locks
    await stepBtn(page).click();
    await expect(page.locator('.tool-caption')).toContainText('Read result —');
    await scrollToSelector(page, '.tool-stage');
    await stepBtn(page).click();
    await expect(page.locator('.tool-caption')).toContainText('Answer —');
    await expect(stepBtn(page)).toBeDisabled();
    await scrollToSelector(page, '.tool-stage');
    await shot('tool-step-4.png');
  });

  test('question picker — time in Sydney', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await page.getByRole('button', { name: 'Time in Sydney' }).click();
    await expect(page.locator('.tv-user-text')).toHaveText('What time is it in Sydney?');
    await expect(page.locator('.tv-tool-call')).toHaveText('get_time("Sydney")');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 3:40 pm');
    await expect(page.locator('.tv-answer-text')).toHaveText("It's 3:40 pm in Sydney.");
    await scrollToSelector(page, '.tool-stage');
    await shot('tool-time.png');
  });

  test('question picker — 13 × 7', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await page.getByRole('button', { name: '13 × 7' }).click();
    await expect(page.locator('.tv-user-text')).toHaveText('What is 13 × 7?');
    await expect(page.locator('.tv-tool-call')).toHaveText('calculator(13 × 7)');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 91');
    await expect(page.locator('.tv-answer-text')).toHaveText('13 × 7 is 91.');
    await scrollToSelector(page, '.tool-stage');
    await shot('tool-calc.png');
  });
});
