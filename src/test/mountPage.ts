import { renderPageTemplate } from '../router';
import type { Page } from '../router';

export interface MountedPage {
  /** Outer element appended to the container; the rendered tree root. */
  root: HTMLElement;
  /** The `.page-content` host the page's `mount()` rendered into. */
  host: HTMLElement;
  /** Runs the page's cleanup and removes the rendered tree. */
  unmount(): void;
}

/**
 * Render a `Page` through the real router template (no mocks) for unit
 * tests that exercise a section's interactive elements in jsdom.
 */
export function mountPage(
  page: Page,
  container: ParentNode = document.body,
): MountedPage {
  const root = document.createElement('div');
  container.appendChild(root);
  renderPageTemplate(page, root, 'test');
  const host = root.querySelector<HTMLElement>('.page-content');
  if (!host) {
    throw new Error('renderPageTemplate did not produce a .page-content host');
  }
  const cleanup = page.mount(host);
  return {
    root,
    host,
    unmount() {
      cleanup();
      root.remove();
    },
  };
}
