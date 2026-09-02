import { test, expect, scrollToSelector } from './helper';

test.describe('pretraining — pick the diet, watch the bowl light up', () => {
  test('initial state — mixed diet, empty bowl', async ({ page, shot }) => {
    await page.goto('/#/pretraining');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Guess the next word. A trillion times.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Everything mixed' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.pre-badge-at')).toHaveText(['200', '300', '1B', '15T']);
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-initial.png');
  });

  test('switch to Math & code — the trade-off re-shares the thresholds', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');

    await page.getByRole('button', { name: 'Math & code' }).click();
    await expect(page.getByRole('button', { name: 'Math & code' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.pre-badge-at')).toHaveText(['100', '800', '200M', '15T']);
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-diet-math.png');
  });

  test('Math & code diet: three batches → 300 tokens, Counting only', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');

    await page.getByRole('button', { name: 'Math & code' }).click();
    const batch = page.getByRole('button', { name: 'Teach a batch' });
    for (let i = 0; i < 3; i += 1) await batch.click();
    await expect(page.locator('.pre-counter')).toHaveText('300');
    await expect(page.locator('.pre-skill-count')).toHaveText('Skills unlocked: 1 / 4');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-batch-3.png');
  });

  test('log slider to 15T — the real Llama 3.1 figure, every skill unlocked', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');
    const slider = page.locator('.pre-scale-slider');
    const counter = page.locator('.pre-counter');

    await slider.focus();
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('ArrowRight');
      await scrollToSelector(page, '.pre-stage');
    }
    await expect(slider).toHaveValue('3');
    await expect(counter).toHaveText('15T');
    await expect(page.getByRole('button', { name: 'Teach a batch' })).toBeDisabled();
    await expect(page.locator('.pre-skill-count')).toHaveText('Skills unlocked: 4 / 4');
    await scrollToSelector(page, '.pre-stage');
    await shot('pre-15t.png');
  });

  test('see the raw model — the base-model reflex', async ({ page, shot }) => {
    await page.goto('/#/pretraining');
    await scrollToSelector(page, '.pre-stage');

    await page.getByRole('switch', { name: 'See the raw model' }).click();
    await expect(page.locator('.pre-raw')).toBeVisible();
    await expect(page.getByText('No meaning yet — just the next-word reflex.')).toBeVisible();
    // Frame the revealed panel itself (it sits below the stage bar).
    await scrollToSelector(page, '.pre-raw');
    await shot('pre-raw.png');
  });
});
