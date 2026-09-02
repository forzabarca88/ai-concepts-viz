import { test, expect, scrollToSelector } from './helper';

test.describe('parameters — pick what it learns (knob cloud, 3D)', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Billions of tiny knobs' }),
    ).toBeVisible();
    await expect(page.locator('.par-status')).toHaveText(
      'Step 0 of 10 — every knob is still at its factory setting.',
    );
    await scrollToSelector(page, '.par-stage');
    await shot('par-initial.png');
  });

  test('topic + training: milestones 3, 6, then done with the answer revealed', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-side');

    // Pick the Poetry course (the default) — the side panel is the focus.
    await page.getByRole('button', { name: 'Poetry' }).click();
    await scrollToSelector(page, '.par-side');
    await shot('par-topic-poetry.png');

    const train = page.getByRole('button', { name: 'Train one step' });

    // Three steps → the poetry milestone-3 caption.
    for (let i = 0; i < 3; i += 1) await train.click();
    await expect(page.locator('.par-status')).toHaveText(
      'It can rhyme "rose" with "goes" — barely.',
    );
    await scrollToSelector(page, '.par-stage');
    await shot('par-step-3.png');

    // Three more → milestone-6.
    for (let i = 0; i < 3; i += 1) await train.click();
    await expect(page.locator('.par-status')).toHaveText(
      'It writes passable haiku with a suspicious amount of "moon".',
    );
    await scrollToSelector(page, '.par-stage');
    await shot('par-step-6.png');

    // Four more → done: the test card unlocks and the answer is revealed.
    for (let i = 0; i < 4; i += 1) await train.click();
    await expect(page.locator('.par-test-prompt')).toHaveText('Write a haiku about coffee');
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(page.locator('.par-test-answer')).toHaveText(
      'Steam curls, then stills — / the cup holds the morning sun / one sip, and the day starts',
    );
    await expect(page.getByRole('button', { name: 'Reveal answer' })).toBeDisabled();
    await scrollToSelector(page, '.par-stage');
    await shot('par-done.png');
  });

  test('knob card: selecting the "moon"-in-poems knob spotlights it', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-side');

    await page.locator('.par-knob-card').nth(1).click();
    await expect(page.locator('.par-tip')).toBeVisible();
    await expect(page.locator('.par-tip')).toHaveText('Knob #612,084 · value 0.87');
    await scrollToSelector(page, '.par-stage');
    await shot('par-knob-inspect.png');
  });

  test('model size: 70B', async ({ page, shot }) => {
    await page.goto('/#/parameters');
    await page.evaluate(() => document.fonts.ready);
    await scrollToSelector(page, '.par-side');

    const slider = page.locator('.par-size-slider');
    // focus() can re-frame the page; the deterministic scroll is
    // re-applied after every keypress before capturing.
    await slider.focus();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('2');
    await expect(page.locator('.par-tick--active')).toHaveText('70B');
    await scrollToSelector(page, '.par-side');
    await shot('par-size-70b.png');
  });
});
