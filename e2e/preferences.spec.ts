import type { Page } from '@playwright/test';
import { test, expect, scrollToSelector } from './helper';

/** The "This one!" vote lives inside a card — scope by pair + card to
    keep the strict-mode query unambiguous (the label appears 6 times).
    `pair` is 1-based. */
const voteOn = (page: Page, pair: number, card: 'a' | 'b') =>
  page
    .locator(`.pref-pair:nth-child(${pair}) .pref-card--${card}`)
    .getByRole('button', { name: 'This one!' });

test.describe('preferences — label three pairs, one training run', () => {
  test('initial state — three pairs, no votes, meter "—"', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Showing it which answer is better' }),
    ).toBeVisible();
    await expect(page.locator('.pref-pair')).toHaveCount(3);
    await expect(page.locator('.pref-meter-value--a')).toHaveText('—');
    await expect(page.getByRole('button', { name: 'Train on my votes' })).toBeDisabled();
    await scrollToSelector(page, '.pref-stage');
    await shot('pref-initial.png');
  });

  test('vote A on pair 1 — "Voted A" chip, meter 100', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');

    await voteOn(page, 1, 'a').click();
    await expect(
      page.locator('.pref-pair:nth-child(1) .pref-card--a .pref-voted'),
    ).toHaveText('Voted A');
    await expect(page.locator('.pref-meter-value--a')).toHaveText('100');
    await expect(page.locator('.pref-meter-value--b')).toHaveText('0');
    await expect(page.getByRole('button', { name: 'Train on my votes' })).toBeDisabled();

    await scrollToSelector(page, '.pref-stage');
    await shot('pref-vote-1.png');
  });

  test('votes A, B, A — meter 67, train enabled', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');

    await voteOn(page, 1, 'a').click();
    await voteOn(page, 2, 'b').click();
    await voteOn(page, 3, 'a').click();
    await expect(page.locator('.pref-meter-value--a')).toHaveText('67');
    await expect(page.locator('.pref-meter-value--b')).toHaveText('33');
    await expect(page.getByRole('button', { name: 'Train on my votes' })).toBeEnabled();

    await scrollToSelector(page, '.pref-stage');
    await shot('pref-vote-3.png');
  });

  test('train on my votes — final draft + mixed note', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');
    const train = page.getByRole('button', { name: 'Train on my votes' });
    await expect(train).toBeDisabled();

    await voteOn(page, 1, 'a').click();
    await voteOn(page, 2, 'b').click();
    await voteOn(page, 3, 'a').click();
    await expect(train).toBeEnabled();

    await train.click();
    await expect(page.locator('.pref-level')).toHaveText('trained');
    await expect(
      page.getByText(
        'Trained on your three votes — one of them was B, so the model also learned to be a little more careful with big claims.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Best draft yet: fluffy scrambled eggs in five minutes.')).toBeVisible();
    await expect(train).toBeDisabled();

    await scrollToSelector(page, '.pref-stage', 'bottom');
    await shot('pref-trained.png');
  });

  test('fresh run B, B, B + train — meter 0', async ({ page, shot }) => {
    await page.goto('/#/preferences');
    await scrollToSelector(page, '.pref-stage');

    await voteOn(page, 1, 'b').click();
    await voteOn(page, 2, 'b').click();
    await voteOn(page, 3, 'b').click();
    await expect(page.locator('.pref-meter-value--a')).toHaveText('0');
    await expect(page.locator('.pref-meter-value--b')).toHaveText('100');

    await page.getByRole('button', { name: 'Train on my votes' }).click();
    await expect(page.locator('.pref-level')).toHaveText('trained');

    await scrollToSelector(page, '.pref-stage', 'bottom');
    await shot('pref-all-b.png');
  });
});
