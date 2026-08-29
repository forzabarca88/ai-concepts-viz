import type { Page } from '@playwright/test';
import { test, expect } from './helper';

/**
 * Scroll a selector to sit just below the sticky header. Deterministic
 * offset (header height + 24px) — no scrollIntoView heuristics — so the
 * captured state is the same on every run.
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

test.describe('home — the reference section', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'How machines learn to talk' }),
    ).toBeVisible();
    await shot('home-initial.png');
  });

  test('next-token demo: before, each pick, new sentence', async ({ page, shot }) => {
    await page.goto('/');
    await scrollToSelector(page, '.nt-stage');
    await shot('home-nexttoken-before.png');

    await page.getByRole('button', { name: /it never ends/ }).click();
    await shot('home-nexttoken-a.png');

    await page.getByRole('button', { name: /you can practice/ }).click();
    await shot('home-nexttoken-b.png');

    await page.getByRole('button', { name: /it's expensive/ }).click();
    await shot('home-nexttoken-c.png');

    await page.getByRole('button', { name: 'New sentence' }).click();
    await shot('home-sentence-2.png');
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
