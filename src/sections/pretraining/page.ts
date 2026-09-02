import type { Page } from '../../router';
import { mountPreExplain, mountPreViz } from './viz';
import './pretraining.css';

/**
 * Pre-training — "04 · How it's trained". A DOM/CSS-only "training gym"
 * stage (no 3D, per the Task 6 spec): log token counter up to Llama
 * 3.1's real 15T, a "guess the next word" practice feed, skill badges
 * and the base-model reveal (the shell adds the hero and pager).
 */
export const page: Page = {
  title: 'Guess the next word. A trillion times.',
  eyebrow: "04 · How it's trained",
  lede: 'The first lesson is simple: keep guessing what comes next. Forever.',
  mount(root) {
    const cleanups = [mountPreViz(root), mountPreExplain(root)];
    return () => cleanups.forEach((fn) => fn());
  },
};
