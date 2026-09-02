import { test, expect, scrollToSelector } from './helper';

test.describe('tokenisation — words into tokens', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await expect(
      page.getByRole('heading', { level: 1, name: "Words aren't words — they're tokens" }),
    ).toBeVisible();
    await shot('tokenisation-initial.png');
  });

  test('clicking a chip opens the inspector', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    // the " love" chip
    await page.locator('.tok-chip').nth(1).click();
    await expect(page.locator('.tok-insp')).toBeVisible();
    await expect(page.locator('.tok-insp-id')).toHaveText('id 418');
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-chip.png');
  });

  test('grain: character and word', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    const slider = page.locator('.tok-grain-slider');
    await slider.focus();
    // subword → character
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('0');
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-grain-0.png');
    // → subword → word
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('2');
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-grain-2.png');
  });

  test('adding an emoji splits the rocket into three tokens', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-stage');

    await page.getByRole('button', { name: 'Add an emoji' }).click();
    await expect(page.getByText('Even robots can break!')).toBeVisible();
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-emoji.png');
  });

  test('type your own sentence: the same rules apply', async ({ page, shot }) => {
    await page.goto('/#/tokenisation');
    await scrollToSelector(page, '.tok-typed');

    // A sentence of known words plus one punctuation mark: 7 tokens.
    await page.locator('.tok-typed-input').fill('The cat sat on the moon!');
    await page.getByRole('button', { name: 'Tokenise it' }).click();
    await expect(page.locator('.tok-chip')).toHaveCount(7);
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-typed.png');

    // An unfamiliar word fragments into 3-letter pieces.
    await page.locator('.tok-typed-input').fill('xylophone');
    await page.getByRole('button', { name: 'Tokenise it' }).click();
    await expect(page.locator('.tok-chip')).toHaveCount(3);
    await scrollToSelector(page, '.tok-stage');
    await shot('tokenisation-typed-unfamiliar.png');
  });
});
