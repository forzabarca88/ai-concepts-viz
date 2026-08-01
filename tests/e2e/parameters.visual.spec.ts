import { test, expect } from '@playwright/test';
import { navigateAndWait } from '../helpers';

test('parameters page renders correctly', async ({ page }) => {
  await navigateAndWait(page, '/core-concepts/parameters');

  // Verify page title
  await expect(page).toHaveTitle('Parameters — AI Concepts Visualized');

  // Verify breadcrumbs
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs.getByText('Home')).toBeVisible();
  await expect(breadcrumbs.getByText('Core Concepts')).toBeVisible();
  await expect(breadcrumbs.getByText('Parameters')).toBeVisible();

  // Verify hero section
  const hero = page.locator('header').first();
  await expect(hero).toBeVisible();
  await expect(hero.locator('h1')).toContainText('Parameters');

  // Verify ModelAnatomy component is present
  const anatomyRoot = page.locator('[data-anatomy-root]');
  await expect(anatomyRoot).toBeVisible();

  // Verify preset buttons
  await expect(page.getByRole('button', { name: 'Tiny' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Small' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Large' })).toBeVisible();

  // Verify slider
  const slider = page.locator('[data-anatomy-slider]');
  await expect(slider).toBeVisible();

  // Verify SVG visualization renders (use [role=img] to avoid matching icon SVGs)
  const svg = anatomyRoot.locator('svg[role="img"]');
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('viewBox', '0 0 900 340');

  // Verify summary bar
  await expect(page.locator('[data-anatomy-total-params]')).toBeVisible();
  await expect(page.locator('[data-anatomy-total-weights]')).toBeVisible();
  await expect(page.locator('[data-anatomy-total-biases]')).toBeVisible();
  await expect(page.locator('[data-anatomy-disk-size]')).toBeVisible();

  // Verify content sections
  await expect(page.getByText('What are parameters?')).toBeVisible();
  await expect(page.getByText('How parameters get their values')).toBeVisible();
  await expect(page.getByText('The scaling story')).toBeVisible();
  await expect(page.getByText('The tradeoffs of scale')).toBeVisible();
  await expect(page.getByText('Key takeaways')).toBeVisible();
});

test('model anatomy preset switching', async ({ page }) => {
  await navigateAndWait(page, '/core-concepts/parameters');

  // Wait for initial render
  await page.waitForSelector('[data-anatomy-root] svg');

  // Click Small preset
  await page.getByRole('button', { name: 'Small' }).click();
  await page.waitForTimeout(500);

  // Verify total params changed (small model has more params than tiny)
  const totalParams = page.locator('[data-anatomy-total-params]');
  await expect(totalParams).toBeVisible();
  const smallParams = await totalParams.textContent();
  expect(smallParams).toContain('M'); // Small model has millions of params

  // Click Large preset
  await page.getByRole('button', { name: 'Large' }).click();
  await page.waitForTimeout(500);

  const largeParams = await totalParams.textContent();
  expect(largeParams).toContain('B'); // Large model has billions of params

  // Verify slider label updates
  await expect(page.locator('[data-anatomy-slider-label]')).toContainText('Large');
});

test('model anatomy slider interaction', async ({ page }) => {
  await navigateAndWait(page, '/core-concepts/parameters');

  await page.waitForSelector('[data-anatomy-root] svg');

  const slider = page.locator('[data-anatomy-slider]');

  // Move slider to middle
  const sliderBounding = await slider.boundingBox();
  if (sliderBounding) {
    const midX = sliderBounding.x + sliderBounding.width * 0.5;
    const midY = sliderBounding.y;
    await page.mouse.move(sliderBounding.x + sliderBounding.width * 0.01, midY);
    await page.mouse.down();
    await page.mouse.move(midX, midY);
    await page.mouse.up();
    await page.waitForTimeout(300);
  }

  // Verify slider label updates
  const label = page.locator('[data-anatomy-slider-label]');
  await expect(label).toBeVisible();

  // Verify SVG still renders (use [role=img] to avoid matching icon SVGs)
  const svg = page.locator('[data-anatomy-svg-container] svg[role="img"]');
  await expect(svg).toBeVisible();
});

test('model anatomy layer click expands detail', async ({ page }) => {
  await navigateAndWait(page, '/core-concepts/parameters');

  // Wait for SVG to render
  await page.waitForSelector('[data-anatomy-svg-container] svg[role="img"]');

  // Focus the first anatomy node and press Enter
  // The nodes have tabindex="0" and D3's keydown handler triggers on Enter/Space
  await page.evaluate(() => {
    const node = document.querySelector('.anatomy-node');
    if (node) (node as HTMLElement).focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Verify detail panel shows
  const detailPanel = page.locator('[data-anatomy-detail]');
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel).not.toHaveClass('hidden');

  // Verify detail content
  await expect(page.locator('[data-detail-title]')).toBeVisible();
  await expect(page.locator('[data-detail-weights]')).toBeVisible();
  await expect(page.locator('[data-detail-biases]')).toBeVisible();
  await expect(page.locator('[data-detail-total]')).toBeVisible();

  // Close detail — the panel uses style="display: none" not a "hidden" class
  await page.locator('[data-detail-close]').click();
  await page.waitForTimeout(300);
  const displayStyle = await detailPanel.evaluate(el => el.style.display);
  expect(displayStyle).toBe('none');
});

test('navigation links work', async ({ page }) => {
  await navigateAndWait(page, '/core-concepts/parameters');

  // NextSteps cards are at the bottom of the page
  const nextStepsCards = page.locator('.next-step-card');
  await expect(nextStepsCards).toHaveCount(2);

  // Previous link (Tokenization)
  const prevLink = nextStepsCards.nth(0);
  await expect(prevLink).toBeVisible();
  await expect(prevLink).toHaveAttribute('href', '/tokenization');

  // Next link (Pre-training)
  const nextLink = nextStepsCards.nth(1);
  await expect(nextLink).toBeVisible();
  await expect(nextLink).toHaveAttribute('href', '/pre-training');
});
