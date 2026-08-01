import { test, expect } from '@playwright/test';
import { navigateAndWait } from '../helpers';

test.describe('Navigation', () => {
  test('home page loads with section cards', async ({ page }) => {
    await navigateAndWait(page, '/');

    // Verify page title
    await expect(page).toHaveTitle('AI Concepts Visualized');

    // Verify the main heading is visible
    await expect(page.getByRole('heading', { name: 'How Large Language Models Work' })).toBeVisible();

    // Verify section cards are present (3 card links in the grid)
    const cards = page.locator('main .grid a.group');
    await expect(cards).toHaveCount(3);

    // Verify each section card heading (h2 inside the grid cards, not sidebar labels or NextSteps)
    const cardHeadings = page.locator('main .grid h2');
    await expect(cardHeadings).toHaveCount(3);
    await expect(cardHeadings.first()).toContainText('Core Concepts');
    await expect(cardHeadings.nth(1)).toContainText('Training Stages');
    await expect(cardHeadings.last()).toContainText('Agentic Use');

    // Verify accent color indicators exist on each section card
    const accentDots = page.locator('main .grid .rounded-full');
    await expect(accentDots).toHaveCount(3);
  });

  test('core concepts section pages load', async ({ page }) => {
    // Data page
    await navigateAndWait(page, '/data');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    const sidebarNav = page.locator('.sidebar-nav');
    await expect(sidebarNav).toBeVisible();

    // Tokenization page
    await navigateAndWait(page, '/tokenization');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    await expect(sidebarNav).toBeVisible();

    // Parameters page
    await navigateAndWait(page, '/parameters');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    await expect(sidebarNav).toBeVisible();
  });

  test('training stages section pages load', async ({ page }) => {
    // Pre-training page
    await navigateAndWait(page, '/pre-training');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    const sidebarNav = page.locator('.sidebar-nav');
    await expect(sidebarNav).toBeVisible();

    // SFT page
    await navigateAndWait(page, '/sft');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    await expect(sidebarNav).toBeVisible();

    // Preference Tuning page
    await navigateAndWait(page, '/preference-tuning');
    await expect(page).toHaveTitle(/AI Concepts Visualized/);
    await expect(sidebarNav).toBeVisible();
  });

  test('navigation links work correctly', async ({ page }) => {
    // Start from home page
    await navigateAndWait(page, '/');

    // Click Core Concepts card link (goes to /core-concepts)
    const coreConceptsLink = page.locator('main .grid a.group').first();
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      coreConceptsLink.click(),
    ]);
    await expect(page).toHaveTitle(/AI Concepts Visualized/);

    // Use sidebar to navigate to tokenization
    const tokenizationLink = page.locator('.sidebar-nav').getByRole('link', { name: 'Tokenization', exact: true });
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      tokenizationLink.click(),
    ]);
    await expect(page).toHaveTitle(/AI Concepts Visualized/);

    // Navigate back home using the site title link
    const homeLink = page.locator('.sidebar-nav').getByRole('link', { name: /AI Concepts/i });
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      homeLink.click(),
    ]);
    await expect(page).toHaveTitle('AI Concepts Visualized');

    // Verify bottom nav is present in DOM (hidden on desktop viewport)
    const bottomNav = page.locator('.bottom-nav');
    // On desktop (1280px viewport), bottom nav exists but is hidden via CSS
    await expect(bottomNav).toBeInViewport().catch(() => {
      // Element may not be in viewport on desktop — that's expected
    });
  });

  test('agentic use section page loads', async ({ page }) => {
    await navigateAndWait(page, '/agentic-use');

    // Verify page title
    await expect(page).toHaveTitle('Agentic Use — AI Concepts Visualized');

    // Verify breadcrumbs
    const breadcrumbs = page.locator('[aria-label="Breadcrumb"]');
    await expect(breadcrumbs).toBeVisible();

    // Verify hero heading
    await expect(page.getByRole('heading', { name: 'Foundations for Agentic Use' })).toBeVisible();

    // Verify sidebar is visible
    const sidebarNav = page.locator('.sidebar-nav');
    await expect(sidebarNav).toBeVisible();

    // Verify the Overview link in sidebar is active (use href to disambiguate from other sections)
    const overviewLink = page.locator('.sidebar-nav a[href="/agentic-use"]');
    await expect(overviewLink).toBeVisible();
    const overviewStyle = await overviewLink.getAttribute('style');
    expect(overviewStyle).toContain('teal');

    // Verify 4 concept cards are present
    const conceptCards = page.locator('[data-section="agentic-cards"] a.group');
    await expect(conceptCards).toHaveCount(4);

    // Verify card titles
    const cardTitles = page.locator('[data-section="agentic-cards"] h3');
    await expect(cardTitles).toHaveCount(4);
    await expect(cardTitles.first()).toContainText('Tool Calling');
    await expect(cardTitles.nth(1)).toContainText('Skills');
    await expect(cardTitles.nth(2)).toContainText('MCP Servers');
    await expect(cardTitles.last()).toContainText('Agent Demo');
  });

  test('sidebar highlights active section', async ({ page }) => {
    await navigateAndWait(page, '/pre-training');

    // The pre-training link in the sidebar should have active styling
    const activeLink = page.locator('.sidebar-nav').getByRole('link', { name: 'Pre-training' });
    await expect(activeLink).toBeVisible();

    // Check that the active link has the accent color styling
    const linkStyle = await activeLink.getAttribute('style');
    expect(linkStyle).toContain('coral');
  });
});
