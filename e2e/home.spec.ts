import { test, expect, scrollToSelector } from './helper';

test.describe('home — the reference section', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'How machines learn to talk' }),
    ).toBeVisible();
    await shot('home-initial.png');
  });

  test('duel: pick the model’s top pick', async ({ page, shot }) => {
    await page.goto('/');
    await scrollToSelector(page, '.nt-stage');
    await page.getByRole('button', { name: /it never ends/ }).click();
    await expect(page.locator('.nt-reveal')).toHaveText(
      'You and the model agree: "it never ends".',
    );
    await shot('home-pick-match.png');
  });

  test('duel: pick a non-argmax candidate', async ({ page, shot }) => {
    await page.goto('/');
    await scrollToSelector(page, '.nt-stage');
    await page.getByRole('button', { name: /you can practice/ }).click();
    await expect(page.locator('.nt-reveal')).toHaveText(
      'You said "you can practice". The model would say "it never ends" (38%). Both are possible — that is the game.',
    );
    await shot('home-pick-mismatch.png');
  });

  test('duel: full walk [0, 1, 0] to the score card', async ({ page, shot }) => {
    await page.goto('/');
    await scrollToSelector(page, '.nt-stage');
    await page.getByRole('button', { name: /it never ends/ }).click();
    await page.getByRole('button', { name: 'Next sentence' }).click();
    await page.getByRole('button', { name: /feel uncomfortable/ }).click();
    await page.getByRole('button', { name: 'Next sentence' }).click();
    await page.getByRole('button', { name: /^word/ }).click();
    await page.getByRole('button', { name: 'See your score' }).click();
    await expect(page.locator('.nt-result-line')).toHaveText(
      'You matched the model 2 out of 3 times.',
    );
    await shot('home-score-2of3.png');
  });

  test('map card keyboard focus', async ({ page, shot }) => {
    await page.goto('/');
    await scrollToSelector(page, '.map-card');
    await page.locator('.map-card').first().focus();
    await shot('home-map-card-focus.png');
  });

  test('mobile: 390x844 with the menu open', async ({ page, shot }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.nav-toggle')).toBeVisible();
    await page.locator('.nav-toggle').click();
    await expect(page.locator('.site-nav')).toBeVisible();
    await shot('home-mobile.png');
  });

  test('full nav: all eleven routes render and mark aria-current', async ({ page }) => {
    await page.goto('/');
    const routes = [
      '',
      'data',
      'tokenisation',
      'parameters',
      'pretraining',
      'sft',
      'preferences',
      'tool-calling',
      'skills',
      'mcp',
      'agent',
    ];
    for (const route of routes) {
      await page.evaluate((r) => {
        window.location.hash = r === '' ? '#/' : `#/${r}`;
      }, route);
      const current =
        route === '' ? page.locator('.brand') : page.locator(`.nav-link[href="#/${route}"]`);
      await expect(current).toHaveAttribute('aria-current', 'page');
      // every route renders a real h1 (no stubs left)
      await expect(page.locator('h1')).not.toBeEmpty();
    }
  });
});
