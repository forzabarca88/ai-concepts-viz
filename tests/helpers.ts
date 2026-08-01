import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wait for D3 / CSS animations to settle before taking screenshots or assertions.
 * D3 transitions can take 500–1000ms; this adds a buffer to ensure the final
 * rendered state is captured consistently.
 *
 * @param page - Playwright page instance
 * @param selector - Optional CSS selector to wait for (e.g., a chart container)
 * @param duration - Total wait time in ms (default 1500ms)
 */
export async function waitForAnimations(
  page: Page,
  selector?: string,
  duration = 1500
): Promise<void> {
  // Wait for network to idle so assets are loaded
  await page.waitForLoadState('networkidle');

  // If a specific selector is provided, wait until it's visible
  if (selector) {
    await page.waitForSelector(selector, { state: 'visible', timeout: 30_000 });
  }

  // Wait for D3 transitions and CSS animations to complete
  // D3 uses requestAnimationFrame-based transitions; CSS uses transition-duration
  await page.waitForTimeout(duration);
}

/**
 * Take a full-page screenshot and compare against a baseline stored in tests/snapshots/.
 * Use this in visual regression tests (*.visual.spec.ts files).
 *
 * @param page - Playwright page instance
 * @param name - Baseline file name (e.g., "home-page")
 * @param options - Optional screenshot options
 */
export async function expectScreenshot(
  page: Page,
  name: string,
  options?: { threshold?: number; maxDiffPixels?: number }
): Promise<void> {
  const { threshold = 0.1, maxDiffPixels = 300 } = options ?? {};

  await waitForAnimations(page);

  await expect(page).toHaveScreenshot(`${name}.png`, {
    threshold,
    maxDiffPixels,
    fullPage: true,
  });
}

/**
 * Take a screenshot of a specific element and compare against baseline.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param name - Baseline file name (e.g., "sidebar-nav")
 * @param options - Optional screenshot options
 */
export async function expectElementScreenshot(
  page: Page,
  selector: string,
  name: string,
  options?: { threshold?: number; maxDiffPixels?: number }
): Promise<void> {
  const { threshold = 0.1, maxDiffPixels = 300 } = options ?? {};

  await waitForAnimations(page, selector);

  const element = await page.locator(selector);
  await expect(element).toHaveScreenshot(`${name}.png`, {
    threshold,
    maxDiffPixels,
  });
}

/**
 * Navigate to a page and wait for it to fully load (including animations).
 *
 * @param page - Playwright page instance
 * @param url - Relative or absolute URL
 * @param animationWait - Additional wait for animations (default 1500ms)
 */
export async function navigateAndWait(
  page: Page,
  url: string,
  animationWait = 1500
): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(animationWait);
}
