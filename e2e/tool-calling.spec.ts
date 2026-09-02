import type { Page } from '@playwright/test';
import { test, expect, scrollToSelector } from './helper';

const toolsSwitch = (page: Page) => page.getByRole('switch', { name: 'Tools: on/off' });
const tryTool = (page: Page, label: string) => page.getByRole('button', { name: label });

test.describe('tool-calling — pick the right tool, one-click run', () => {
  test('tc-initial — tools off', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Teaching it to use a calculator' }),
    ).toBeVisible();
    // exact: the flow answer must not be confused with any prose copy
    await expect(
      page.getByText("I can't check that — I can't see the world!", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.tool-choose')).toBeHidden();
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-initial.png');
  });

  test('tc-tools-on — the "which tool" picker appears', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    const tryButtons = page.locator('.tool-try');
    await expect(tryButtons).toHaveCount(3);
    await expect(tryButtons.nth(0)).toBeEnabled();
    // the tool card is still a placeholder until a tool is picked
    await expect(page.locator('.tv-tool-call')).toHaveText('?');
    await expect(page.locator('.tool-caption')).toHaveText(
      'Four beats: Think → Call tool → Read result → Answer.',
    );
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-tools-on.png');
  });

  test('tc-wrong — q0 + calculator fails', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await tryTool(page, 'calculator').click();
    await expect(page.locator('.tv-tool-call')).toHaveText('calculator("Tokyo")');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ Error: not a number');
    await expect(page.locator('.tv-answer-text')).toHaveText(
      'I got an error back. That is not a forecast.',
    );
    await expect(page.getByText('Wrong tool', { exact: true })).toBeVisible();
    // the retired tool carries its (aria-hidden) "Tried — no help" tag
    const triedTag = page.locator('.tool-try-tag:not([hidden])');
    await expect(triedTag).toHaveCount(1);
    await expect(triedTag).toHaveText('Tried — no help');
    await expect(page.locator('.tool-caption')).toHaveText(
      'The model picked the wrong tool — it can try again.',
    );
    // the model can still try another tool
    await expect(tryTool(page, 'get_weather')).toBeEnabled();
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-wrong.png');
  });

  test('tc-run — q0 + weather: four beats, one click', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await tryTool(page, 'get_weather').click();
    await expect(page.locator('.tv-tool-call')).toHaveText('get_weather("Tokyo")');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 21°C, sunny');
    await expect(page.locator('.tv-answer-text')).toHaveText("It's 21°C and sunny in Tokyo.");
    await expect(page.locator('.tool-caption')).toHaveText(
      'Four beats, one click: Think → Call tool → Read result → Answer.',
    );
    const tryButtons = page.locator('.tool-try');
    await expect(tryButtons.nth(0)).toBeDisabled();
    await expect(tryButtons.nth(1)).toBeDisabled();
    await expect(tryButtons.nth(2)).toBeDisabled();
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-run.png');
  });

  test('tc-time — q1 run', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await page.getByRole('button', { name: 'Time in Sydney' }).click();
    await expect(page.locator('.tv-user-text')).toHaveText('What time is it in Sydney?');
    await tryTool(page, 'get_time').click();
    await expect(page.locator('.tv-tool-call')).toHaveText('get_time("Sydney")');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 3:40 pm');
    await expect(page.locator('.tv-answer-text')).toHaveText("It's 3:40 pm in Sydney.");
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-time.png');
  });

  test('tc-calc — q2 run', async ({ page, shot }) => {
    await page.goto('/#/tool-calling');
    await scrollToSelector(page, '.tool-stage');

    await toolsSwitch(page).click();
    await page.getByRole('button', { name: '13 × 7' }).click();
    await expect(page.locator('.tv-user-text')).toHaveText('What is 13 × 7?');
    await tryTool(page, 'calculator').click();
    await expect(page.locator('.tv-tool-call')).toHaveText('calculator(13 × 7)');
    await expect(page.locator('.tv-tool-result')).toHaveText('→ 91');
    await expect(page.locator('.tv-answer-text')).toHaveText('13 × 7 is 91.');
    await scrollToSelector(page, '.tool-stage');
    await shot('tc-calc.png');
  });
});
