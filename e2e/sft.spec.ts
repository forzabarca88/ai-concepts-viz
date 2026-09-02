import { test, expect, scrollToSelector } from './helper';

test.describe('sft — "what did it get wrong?" + twin clouds', () => {
  test('initial state — slider at stop 1, no mistake picked', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/sft');
    await expect(
      page.getByRole('heading', { level: 1, name: 'From word-guessing to helping' }),
    ).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Coaching intensity' })).toHaveValue('0');
    await expect(page.locator('.sft-quality-value')).toHaveText('20%');
    await expect(page.locator('.sft-pair')).toBeHidden();
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-initial.png');
  });

  test('mistake 0 — "Rambles on" reveals its coaching pair', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');

    await page.getByRole('button', { name: 'Rambles on' }).click();
    await expect(page.locator('.sft-pair')).toBeVisible();
    await expect(page.getByText('Write a haiku about autumn.')).toBeVisible();
    await expect(
      page.getByText('Red leaves let go slow\na gust takes them all away\none bare branch remains'),
    ).toBeVisible();
    // Frame the picker + the revealed card.
    await scrollToSelector(page, '.sft-mistakes');
    await shot('sft-mistake-0.png');
  });

  test('mistake 1 — "Ignores the question" swaps the pair', async ({ page, shot }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');

    await page.getByRole('button', { name: 'Ignores the question' }).click();
    await expect(page.locator('.sft-pair')).toBeVisible();
    await expect(page.getByText('What color is the sky?')).toBeVisible();
    await scrollToSelector(page, '.sft-mistakes');
    await shot('sft-mistake-1.png');
  });

  test('mistake 2 — "Wrong format" swaps the pair', async ({ page, shot }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');

    await page.getByRole('button', { name: 'Wrong format' }).click();
    await expect(page.locator('.sft-pair')).toBeVisible();
    await expect(
      page.getByText('Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday'),
    ).toBeVisible();
    await scrollToSelector(page, '.sft-mistakes');
    await shot('sft-mistake-2.png');
  });

  test('coaching slider to 100 — the instruct cloud tightens and turns mint', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/sft');
    await scrollToSelector(page, '.sft-stage');
    const slider = page.getByRole('slider', { name: 'Coaching intensity' });

    await slider.focus();
    for (let i = 0; i < 2; i += 1) {
      await page.keyboard.press('ArrowRight');
      await scrollToSelector(page, '.sft-stage');
    }
    await expect(slider).toHaveValue('2');
    await expect(page.locator('.sft-strip-count')).toHaveText('100 examples');
    await expect(page.locator('.sft-quality-value')).toHaveText('90%');
    await expect(page.getByText('Quality beats quantity', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Rambles on' }).click();
    await expect(page.locator('.sft-pair')).toBeVisible();
    await scrollToSelector(page, '.sft-stage');
    await shot('sft-quality-90.png');
  });
});
