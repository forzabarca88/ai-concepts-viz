import { test, expect } from './helper';

test.describe('environment sanity', () => {
  test('headless chromium can create a WebGL context (SwiftShader)', async ({
    page,
  }) => {
    await page.goto('/');
    const hasWebGL = await page.evaluate(
      () => document.createElement('canvas').getContext('webgl') !== null,
    );
    expect(hasWebGL).toBe(true);
  });

  test('home renders end-to-end (fonts + base path + capture)', async ({
    page,
    shot,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('How machines learn to talk');
    await shot('00-home.png');
  });
});
