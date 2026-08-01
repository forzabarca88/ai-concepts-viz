import { test, expect } from '@playwright/test';
import { navigateAndWait } from '../helpers';

test.describe('Skills page', () => {
  test('loads with correct structure', async ({ page }) => {
    await navigateAndWait(page, '/skills');

    // Verify page title
    await expect(page).toHaveTitle('Skills — AI Concepts Visualized');

    // Verify breadcrumbs: Home > Agentic Use > Skills
    const breadcrumbs = page.locator('[aria-label="Breadcrumb"]');
    await expect(breadcrumbs).toBeVisible();

    // Verify hero h1 heading (level 1 to disambiguate from other "Skills" headings)
    await expect(page.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();

    // Verify hero tagline
    await expect(page.getByText('Special abilities the agent can learn.')).toBeVisible();

    // Verify sidebar highlights Skills as active
    const skillsLink = page.locator('.sidebar-nav a[href="/skills"]');
    await expect(skillsLink).toBeVisible();
    const skillsStyle = await skillsLink.getAttribute('style');
    expect(skillsStyle).toContain('teal');
  });

  test('displays all content sections', async ({ page }) => {
    await navigateAndWait(page, '/skills');

    // Verify section headings (use level to disambiguate duplicates)
    await expect(page.getByRole('heading', { name: 'What Are Skills?', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How Agents Learn Skills', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Types of Skills', exact: true })).toBeVisible();
    // "Skill Registry" appears as h2 (page section) and h3 (grid header) — use level: 2
    await expect(page.getByRole('heading', { name: 'Skill Registry', exact: true, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills vs. Tools', exact: true })).toBeVisible();
  });

  test('skill grid renders cards and supports filtering', async ({ page }) => {
    await navigateAndWait(page, '/skills');

    // Wait for client-side JS to render the skill cards
    await page.waitForSelector('.skill-card', { timeout: 10_000 });

    // Verify all 19 skill cards are rendered
    const cards = page.locator('.skill-card');
    await expect(cards).toHaveCount(19);

    // Verify result count shows 19
    await expect(page.locator('[data-skill-count]')).toContainText('19 skills');

    // Verify category filter buttons exist
    const catBtns = page.locator('[data-category-btn]');
    await expect(catBtns).toHaveCount(7); // All + 6 categories

    // Filter by Coding category
    await page.locator('[data-category-btn][data-category="coding"]').click();
    await expect(page.locator('.skill-card')).toHaveCount(4);
    await expect(page.locator('[data-skill-count]')).toContainText('4 skills');

    // Filter by DevOps category
    await page.locator('[data-category-btn][data-category="devops"]').click();
    await expect(page.locator('.skill-card')).toHaveCount(3);
    await expect(page.locator('[data-skill-count]')).toContainText('3 skills');

    // Reset to All
    await page.locator('[data-category-btn][data-category="all"]').click();
    await expect(page.locator('.skill-card')).toHaveCount(19);
  });

  test('search filters skills correctly', async ({ page }) => {
    await navigateAndWait(page, '/skills');
    await page.waitForSelector('.skill-card', { timeout: 10_000 });

    // Search for "debug" - matches 1 skill (Debugging by name and tag)
    await page.type('[data-skill-search]', 'debug', { delay: 30 });
    await page.waitForTimeout(500);
    await expect(page.locator('.skill-card')).toHaveCount(1);
    await expect(page.locator('[data-skill-count]')).toContainText('1 skill');
  });

  test('search for refactoring matches one skill', async ({ page }) => {
    await navigateAndWait(page, '/skills');
    await page.waitForSelector('.skill-card', { timeout: 10_000 });

    // Search for "refactoring" - matches 1 skill (name + tag "refactor")
    await page.type('[data-skill-search]', 'refactoring', { delay: 30 });
    await page.waitForTimeout(500);
    await expect(page.locator('.skill-card')).toHaveCount(1);
  });

  test('search with no results shows empty state', async ({ page }) => {
    // Fresh navigation to avoid debounce race conditions from sequential fills
    await navigateAndWait(page, '/skills');
    await page.waitForSelector('.skill-card', { timeout: 10_000 });

    // Set value directly and dispatch input event to trigger the search
    await page.evaluate(() => {
      const input = document.querySelector('[data-skill-search]') as HTMLInputElement;
      if (input) {
        input.value = 'zzzznotexist';
        // Dispatch input event to trigger the debounce handler
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(1000); // debounce (200ms) + render time + buffer

    await expect(page.locator('.skill-card')).toHaveCount(0);
    await expect(page.locator('[data-skill-empty]')).toBeVisible();
    await expect(page.locator('[data-skill-count]')).toContainText('0 skills');
  });

  test('expand skill card to see details', async ({ page }) => {
    await navigateAndWait(page, '/skills');
    await page.waitForSelector('.skill-card', { timeout: 10_000 });

    // Get the skill-id of the first card before clicking
    const firstCard = page.locator('.skill-card').first();
    const skillId = await firstCard.getAttribute('data-skill-id');
    expect(skillId).not.toBeNull();

    // Click first card to expand
    await firstCard.click();
    await page.waitForTimeout(600); // wait for re-render + CSS transition

    // Re-query the card by its data attribute (JS re-renders the grid on click)
    const expandedCard = page.locator(`.skill-card[data-skill-id="${skillId}"]`);

    // Verify card has expanded class
    const expandedClass = await expandedCard.getAttribute('class');
    expect(expandedClass).toContain('expanded');

    // Verify details panel is visible
    await expect(expandedCard.locator('.skill-card-details')).toBeVisible();

    // Click again to collapse
    await expandedCard.click();
    await page.waitForTimeout(600);

    // Re-query again after second re-render
    const collapsedCard = page.locator(`.skill-card[data-skill-id="${skillId}"]`);
    const collapsedClass = await collapsedCard.getAttribute('class');
    expect(collapsedClass).not.toContain('expanded');
  });

  test('skills vs tools comparison section', async ({ page }) => {
    await navigateAndWait(page, '/skills');

    // Verify the comparison section exists
    await expect(page.getByRole('heading', { name: 'Skills vs. Tools', exact: true })).toBeVisible();

    // Verify the key takeaway text
    await expect(page.getByText(/Skills guide the agent's reasoning; tools give it hands to act/)).toBeVisible();
  });
});
