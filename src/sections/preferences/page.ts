import type { Page } from '../../router';
import { mountPrefExplain, mountPrefViz } from './viz';
import './preferences.css';

/**
 * Preference fine-tuning — "06 · How it's trained". A DOM/CSS-only stage
 * (no 3D, per the Task 8 spec): one prompt over two answer cards with
 * "This one!" votes, a 50/50 reward meter, and a "new model answer"
 * panel that improves with "Train on that" (the shell adds the hero
 * and pager).
 */
export const page: Page = {
  title: 'Showing it which answer is better',
  eyebrow: "06 · How it's trained",
  lede: 'Two answers. One is better. Point at it — the model takes notes.',
  mount(root) {
    const cleanups = [mountPrefViz(root), mountPrefExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
