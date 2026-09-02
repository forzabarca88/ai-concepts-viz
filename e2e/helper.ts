/**
 * Shared e2e fixtures — every spec imports `test`/`expect` from here
 * (never directly from '@playwright/test'), so all specs automatically get:
 *
 *  - the freeze protocol: `<html class="pw">` is added via addInitScript
 *    BEFORE any page script runs. base.css then pauses every CSS
 *    animation/transition, and `createStage3D` (src/three/helpers.ts)
 *    detects the class and renders single frames instead of rAF loops.
 *  - `shot(name)`: waits for the self-hosted fonts to finish loading and
 *    fast-forwards any in-flight animations, then asserts a screenshot
 *    with maxDiffPixelRatio 0.02.
 *    NOTE: do NOT add `animations: 'disabled'` to toHaveScreenshot —
 *    under the `.pw` protocol every animation is already paused and
 *    every transition is duration-0 (plus reducedMotion:'reduce' in
 *    playwright.config.ts), so the option has nothing to do; the
 *    minimal capture path is what keeps baselines byte-identical here.
 *    NOTE: in 1.61.1 the name must include the `.png` extension
 *    (e.g. `shot('data-initial.png')`); the file is saved per-platform
 *    (`*-linux.png`) in `e2e/<spec>-snapshots/`.
 */
import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  shot: (name: string) => Promise<void>;
}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // addInitScript runs BEFORE <html> exists, so documentElement is
      // null and a direct classList call throws silently. Watch for the
      // element instead — the mutation microtask lands well before any
      // deferred module script (our app) runs.
      let obs: MutationObserver | null = null;
      const apply = () => {
        if (document.documentElement) {
          document.documentElement.classList.add('pw');
          obs?.disconnect();
        }
      };
      apply();
      obs = new MutationObserver(apply);
      obs.observe(document, { childList: true });
    });
    await use(page);
  },

  shot: async ({ page }, use) => {
    const shot = async (name: string) => {
      if (!name.endsWith('.png')) {
        throw new Error(`shot() name must end with '.png' (got "${name}")`);
      }
      // Wait for every @fontsource face so text is laid out with the
      // final fonts before pixels are compared.
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      // Deterministic capture: fast-forward every in-flight CSS
      // transition/animation to its end state, so nothing may be
      // animating when pixels are read. (Under the .pw freeze this is
      // normally a no-op — paused animations are not even reported —
      // but it keeps captures deterministic if the freeze ever weakens.
      // Infinite animations throw on finish(); skip them.)
      await page.evaluate(() => {
        for (const anim of document.getAnimations()) {
          try {
            anim.finish();
          } catch {
            /* infinite target — leave untouched */
          }
        }
      });
      await expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.02 });
    };
    await use(shot);
  },
});

export { expect };

/**
 * Scroll a selector to sit just below the sticky header (deterministic
 * offset — header height + 24px — so every capture frames the same
 * slice of the page). `edge: 'bottom'` aligns the selector with the
 * viewport bottom instead — used for shots whose subject sits at the
 * foot of a tall stage (below the top-anchored crop). Playwright clicks
 * can auto-scroll the target into view and re-frame the page, so this
 * is re-applied after every interaction before capturing.
 */
export async function scrollToSelector(
  page: Page,
  selector: string,
  edge: 'top' | 'bottom' = 'top',
) {
  await page.evaluate((args) => {
    const [sel, e] = args as [string, 'top' | 'bottom'];
    const el = document.querySelector(sel);
    const header = document.querySelector('.site-header');
    if (!el || !header) return;
    const b = el.getBoundingClientRect();
    const y =
      e === 'top'
        ? b.top + window.scrollY - (header.getBoundingClientRect().height + 24)
        : b.bottom + window.scrollY - window.innerHeight;
    window.scrollTo(0, y);
  }, [selector, edge]);
}
