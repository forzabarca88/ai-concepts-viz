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

test.describe('skills — teaching it a job', () => {
  test('initial state', async ({ page, shot }) => {
    await page.goto('/#/skills');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Teaching it a job' }),
    ).toBeVisible();
    await shot('skill-initial.png');
  });

  test('teach a skill — the fixed cycle of three, then the button locks', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/skills');
    await scrollToSelector(page, '.skill-stage');
    const teach = page.getByRole('button', { name: 'Teach a skill', exact: true });

    await teach.click();
    await expect(page.getByText('Browse the web', { exact: true })).toBeVisible();
    await expect(page.getByText('Learned!', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.skill-stage');
    await shot('skill-one.png');

    await teach.click();
    await expect(page.getByText('Write code', { exact: true })).toBeVisible();

    await teach.click();
    await expect(page.getByText('Summarize', { exact: true })).toBeVisible();
    await expect(page.locator('.skill-inv-count')).toHaveText('3 / 3');
    await expect(teach).toBeDisabled();
    await scrollToSelector(page, '.skill-stage');
    await shot('skill-three.png');
  });

  test('task board — ready when the needed skill is learned', async ({
    page,
    shot,
  }) => {
    await page.goto('/#/skills');
    await scrollToSelector(page, '.skill-stage');
    const teach = page.getByRole('button', { name: 'Teach a skill', exact: true });
    await teach.click();
    await teach.click();
    await teach.click();

    await page
      .getByRole('button', { name: /Find Portland's best hiking trail/ })
      .click();
    await expect(page.getByText('Ready! 🎒', { exact: true })).toBeVisible();
    await expect(page.locator('.skill-card--needed')).toHaveText(/Browse the web/);
    await scrollToSelector(page, '.skill-stage');
    await shot('skill-task-ready.png');
  });

  test('task board — missing skill reads Not ready', async ({ page, shot }) => {
    await page.goto('/#/skills');
    await scrollToSelector(page, '.skill-stage');
    await page.getByRole('button', { name: 'Teach a skill', exact: true }).click();

    await page
      .getByRole('button', { name: /Write a script to rename files/ })
      .click();
    await expect(page.getByText('Not ready', { exact: true })).toBeVisible();
    await expect(page.getByText('Missing: Write code', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.skill-stage');
    await shot('skill-task-missing.png');
  });

  test('forget a skill — the card goes, readiness flips', async ({ page, shot }) => {
    await page.goto('/#/skills');
    await scrollToSelector(page, '.skill-stage');
    await page.getByRole('button', { name: 'Teach a skill', exact: true }).click();
    await page
      .getByRole('button', { name: /Find Portland's best hiking trail/ })
      .click();
    await expect(page.getByText('Ready! 🎒', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Forget', exact: true }).click();
    await expect(
      page.getByText('No skills yet — just a very smart mind', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Not ready', { exact: true })).toBeVisible();
    await expect(page.getByText('Missing: Browse the web', { exact: true })).toBeVisible();
    await scrollToSelector(page, '.skill-stage');
    await shot('skill-forgotten.png');
  });
});
