import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // SwiftShader WebGL + 7.6 GB RAM: keep concurrency low (see PLAN, Risks #7).
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/ai-concepts-viz/',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    // In @playwright/test 1.61.1, browser-context options such as
    // reducedMotion live under `contextOptions` (verified in the installed
    // types); they are not top-level `use` keys.
    contextOptions: {
      reducedMotion: 'reduce',
    },
    // NOTE: `animations: 'disabled'` is NOT a valid `use` option in
    // @playwright/test 1.61.1 (verified in playwright-core types — it only
    // exists on screenshot options). The design freeze for screenshots is
    // the `<html class="pw">` CSS protocol in base.css (paused animations,
    // no transitions) plus reducedMotion above; the screenshot-option
    // variant is deliberately NOT used because it has nothing left to do
    // under that freeze (see e2e/helper.ts).
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: {
    command: 'npm run build && vite preview --port 4173 --strictPort',
    // 1.61.1: `port` XOR `url` — using `url` (waits for an actual HTTP
    // response, which also proves the /ai-concepts-viz/ base path works).
    url: 'http://127.0.0.1:4173/ai-concepts-viz/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
